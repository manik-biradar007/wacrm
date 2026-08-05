-- ============================================================
-- 037_flow_wait_node.sql
--
-- Adds a 'wait' node type to the Flow engine — pauses a run for a
-- configured duration before advancing, instead of the engine's usual
-- synchronous-to-completion dispatch.
--
--   1. New 'wait' value on `flow_nodes.node_type` CHECK constraint.
--      Mirrors the same drop-and-recreate pattern migrations 010/016
--      used to land 'send_media'. Node config (duration_value,
--      duration_unit, next_node_key) lives in JSONB and is
--      shape-checked by the validator + TS types, not the DB.
--
--   2. `flow_runs.resume_at` — timestamp a run parked at a `wait`
--      node should resume at. NULL for every other run, including
--      runs parked at send_buttons/collect_input awaiting a reply
--      (those resume on the customer's next message, not a timer).
--      Picked up by the existing `/api/flows/cron` sweep alongside
--      the timeout sweep it already runs.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. flow_nodes.node_type — add 'wait'
-- ============================================================
ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end',
    'wait'
  ));

-- ============================================================
-- 2. flow_runs.resume_at
-- ============================================================
ALTER TABLE flow_runs
  ADD COLUMN IF NOT EXISTS resume_at TIMESTAMPTZ;

-- Cron sweep query: "find active runs whose wait has elapsed" needs to
-- be index-supported, same reasoning as idx_flow_runs_active_advanced
-- in migration 010.
CREATE INDEX IF NOT EXISTS idx_flow_runs_active_resume
  ON flow_runs(resume_at)
  WHERE status = 'active' AND resume_at IS NOT NULL;
