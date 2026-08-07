-- ============================================================
-- 038_automation_media.sql
--
-- Adds the `automation-media` Supabase Storage bucket used by a new
-- `send_media` automation step type — lets an automation (e.g.
-- "New message received → Wait 5h → Send Media") attach an image /
-- video / document to its outbound message, not just plain text.
--
-- Mirrors `chat-media` (migration 023), which itself mirrors
-- `flow-media` (migrations 016 + 020): a separate bucket per feature
-- so retention/size policy can diverge later, same account-scoped
-- write policy, same MIME allowlist (no audio — automations don't
-- send voice notes).
--
-- Path convention:
--   automation-media/account-<account_id>/<timestamp>-<basename>.<ext>
-- The bucket is public so Meta can fetch the URL without auth; writes
-- are scoped to account members via the path's first segment.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. automation-media storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'automation-media',
  'automation-media',
  TRUE,
  16777216, -- 16 MB (Meta video cap; documents/images fit under this)
  ARRAY[
    -- Images
    'image/png', 'image/jpeg', 'image/webp',
    -- Videos
    'video/mp4', 'video/3gpp',
    -- Documents
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. Storage RLS — account-scoped writes, public reads
--
-- Same predicate shape as migration 023's chat-media policies: writes
-- are allowed when the path's first segment is `account-<account_id>`
-- for an account the caller belongs to. Reads are public.
--
-- Drop-then-create (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================
DROP POLICY IF EXISTS "Automation media is publicly readable" ON storage.objects;
CREATE POLICY "Automation media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'automation-media');

DROP POLICY IF EXISTS "Members can upload automation media" ON storage.objects;
CREATE POLICY "Members can upload automation media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'automation-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update automation media" ON storage.objects;
CREATE POLICY "Members can update automation media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'automation-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete automation media" ON storage.objects;
CREATE POLICY "Members can delete automation media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'automation-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
