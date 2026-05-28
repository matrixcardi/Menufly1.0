
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-images', 'campaign-images', true);

CREATE POLICY "Anyone can view campaign images" ON storage.objects FOR SELECT USING (bucket_id = 'campaign-images');

CREATE POLICY "Authenticated users can upload campaign images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-images');

CREATE POLICY "Authenticated users can update campaign images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'campaign-images');

CREATE POLICY "Authenticated users can delete campaign images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-images');
