
CREATE POLICY "Authenticated users can upload to product-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can read product-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');
