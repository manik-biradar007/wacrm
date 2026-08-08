import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

/**
 * Authorizes an internal cron GET request from either of the two
 * redundant pingers hitting `/api/automations/cron` and
 * `/api/flows/cron`:
 *
 *  - Vercel Cron (`vercel.json`), which auto-sends
 *    `Authorization: Bearer $CRON_SECRET` — no way to customize the
 *    header, so this is Vercel's fixed contract.
 *  - The GitHub Actions workflow (`.github/workflows/cron.yml`),
 *    which sends `x-cron-secret: $AUTOMATION_CRON_SECRET`. Kept as a
 *    second pinger since GitHub's schedule trigger alone has proven
 *    unreliable (best-effort, can silently skip runs).
 *
 * Constant-time comparisons throughout so a caller who can hit the
 * endpoint can't recover either secret byte-by-byte from response
 * timing.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const vercelSecret = process.env.CRON_SECRET
  if (vercelSecret) {
    const auth = request.headers.get('authorization') ?? ''
    if (safeEqual(auth, `Bearer ${vercelSecret}`)) return true
  }
  const ghSecret = process.env.AUTOMATION_CRON_SECRET
  if (ghSecret) {
    const supplied = request.headers.get('x-cron-secret') ?? ''
    if (safeEqual(supplied, ghSecret)) return true
  }
  return false
}
