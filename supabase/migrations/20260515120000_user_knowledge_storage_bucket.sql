-- user-knowledge storage: bucket + scoped RLS (knowledge uploads + profile avatars)
-- Knowledge paths: "{auth.uid()}/..."
-- Avatar paths: "avatars/{auth.uid()}-..."

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-knowledge',
  'user-knowledge',
  false,
  10485760, -- 10MB (matches KnowledgeUpload client cap)
  NULL       -- allow varied MIME types (incl. images for avatars, Office docs for knowledge)
)
ON CONFLICT (id) DO NOTHING;

-- Replace any broad legacy policies on this bucket name with user-scoped rules
DROP POLICY IF EXISTS "user_knowledge_storage_insert" ON storage.objects;
CREATE POLICY "user_knowledge_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-knowledge'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
      )
    )
  );

DROP POLICY IF EXISTS "user_knowledge_storage_select" ON storage.objects;
CREATE POLICY "user_knowledge_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-knowledge'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
      )
    )
  );

DROP POLICY IF EXISTS "user_knowledge_storage_update" ON storage.objects;
CREATE POLICY "user_knowledge_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-knowledge'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'user-knowledge'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
      )
    )
  );

DROP POLICY IF EXISTS "user_knowledge_storage_delete" ON storage.objects;
CREATE POLICY "user_knowledge_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-knowledge'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) LIKE auth.uid()::text || '-%'
      )
    )
  );
