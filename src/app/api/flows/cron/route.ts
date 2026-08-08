import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { resolveFallbackPolicy } from '@/lib/flows/fallback'
import { resumeDueWaits } from '@/lib/flows/engine'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

/**
 * Sweep abandoned active flow runs, then resume any run parked at a
 * `wait` node whose timer has elapsed.
 *
 * Timeout sweep: reads each active run's parent-flow
 * `fallback_policy.on_timeout_hours` to compute the staleness cutoff
 * (default 24h), then marks any run past its cutoff as `timed_out`.
 * Writes a matching `flow_run_events` row for the audit trail.
 *
 * Without this sweep, a customer who abandons a flow mid-conversation
 * keeps a row in `idx_one_active_run_per_contact` (the partial unique
 * index on `flow_runs WHERE status='active'`) forever — blocking any
 * new triggers for them. The cron is therefore not optional.
 *
 * Wait resume: `resumeDueWaits` (engine.ts) advances every run whose
 * `resume_at` has passed — the only mechanism that continues a `wait`
 * node's flow, since the engine otherwise only advances in response to
 * an inbound webhook. This makes wait-node precision dependent on how
 * often this endpoint is actually hit — see the hosting note below.
 *
 * Auth: accepts either Vercel Cron's auto-sent `Authorization: Bearer
 * $CRON_SECRET` (see `vercel.json`) or the GitHub Actions workflow's
 * `x-cron-secret: $AUTOMATION_CRON_SECRET` — see `isAuthorizedCronRequest`.
 * Kept as two redundant pingers since GitHub's schedule trigger alone
 * has proven unreliable. The two endpoints (`/api/automations/cron`
 * and this one) are independent operations; we keep them on separate
 * URLs so one failing doesn't block the other.
 *
 * Hosting: hit on a schedule (Vercel Cron / GitHub Actions / external
 * pinger). A 5-minute interval is more than enough for the 24h timeout
 * sweep, but now also bounds wait-node precision — a flow with a
 * 2-minute wait will actually resume anywhere in [2, interval+2)
 * minutes. Tighten the interval if wait nodes need to be closer to
 * exact.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date()

  // Pull all currently-active runs along with their parent flow's
  // fallback_policy. Joined in one query — the small set of active
  // runs per tenant keeps this cheap.
  const { data: runs, error } = await admin
    .from('flow_runs')
    .select(
      'id, flow_id, user_id, contact_id, last_advanced_at, flows ( fallback_policy )',
    )
    .eq('status', 'active')

  if (error) {
    console.error('[flows-cron] active-run scan failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!runs?.length) return NextResponse.json({ swept: 0 })

  type Row = {
    id: string
    flow_id: string
    user_id: string
    contact_id: string | null
    last_advanced_at: string
    flows: { fallback_policy: unknown } | { fallback_policy: unknown }[] | null
  }

  let swept = 0
  for (const r of runs as Row[]) {
    const flowsField = Array.isArray(r.flows) ? r.flows[0] : r.flows
    const policy = resolveFallbackPolicy(flowsField?.fallback_policy ?? null)
    const lastAdvanced = new Date(r.last_advanced_at)
    const ageHours = (now.getTime() - lastAdvanced.getTime()) / (1000 * 60 * 60)
    if (ageHours < policy.on_timeout_hours) continue

    // Mark timed_out — guarded by the precondition `status='active'`
    // so concurrent advance from a late inbound doesn't overwrite a
    // legitimate update.
    const { data: updated } = await admin
      .from('flow_runs')
      .update({
        status: 'timed_out',
        ended_at: now.toISOString(),
        end_reason: 'stale_sweep',
      })
      .eq('id', r.id)
      .eq('status', 'active')
      .select('id')

    if (Array.isArray(updated) && updated.length > 0) {
      await admin.from('flow_run_events').insert({
        flow_run_id: r.id,
        event_type: 'timeout',
        payload: {
          age_hours: Math.round(ageHours * 10) / 10,
          policy_hours: policy.on_timeout_hours,
        },
      })
      swept += 1
    }
  }

  const { resumed } = await resumeDueWaits(admin)

  return NextResponse.json({ swept, resumed })
}
