-- ============================================================
-- 039_flow_inbound_dedup.sql
--
-- The flow runner's Meta-retry idempotency check was a SELECT-then-
-- INSERT (see engine.ts `isDuplicateInbound`), which has two holes:
--
--   1. It only looked at 'reply_received' events. A retry of the
--      message that STARTED a run (logged as event_type='started')
--      arriving after the run had already advanced wasn't recognized
--      as a duplicate — it got reprocessed as a mismatched reply and
--      triggered a spurious reprompt.
--   2. Check-then-act is racy: two concurrent deliveries of the same
--      retried message can both pass the SELECT before either has
--      written its event, both advance the run, and both send the
--      node's prompt.
--
-- Fix: a partial unique index makes "have we already processed this
-- Meta message for this run" an atomic INSERT-or-conflict instead of
-- a SELECT-then-INSERT — and it covers 'started' the same as
-- 'reply_received' since both events carry meta_message_id.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_run_events_dedup
  ON flow_run_events (flow_run_id, (payload->>'meta_message_id'))
  WHERE payload->>'meta_message_id' IS NOT NULL;
