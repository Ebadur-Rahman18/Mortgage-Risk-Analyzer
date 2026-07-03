-- Create storage buckets for user-scoped file storage
-- user-knowledge: private documents uploaded by users for AI processing
-- avatars: user profile images (publicly viewable, user-scoped writes)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('user-knowledge', 'user-knowledge', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- user-knowledge bucket policies
-- Object paths: {userId}/filename.ext
-- ============================================

CREATE POLICY "Users can view their own knowledge files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'user-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own knowledge files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own knowledge files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'user-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own knowledge files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'user-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- avatars bucket policies
-- Object paths: {userId}-... (filename prefix)
-- ============================================

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND storage.filename(name) LIKE (auth.uid()::text || '-%')
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND storage.filename(name) LIKE (auth.uid()::text || '-%')
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND storage.filename(name) LIKE (auth.uid()::text || '-%')
);
