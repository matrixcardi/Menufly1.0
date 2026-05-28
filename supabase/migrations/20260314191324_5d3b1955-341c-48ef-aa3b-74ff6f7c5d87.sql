create policy "Masters can update any restaurant"
on public.restaurants
for update
to authenticated
using (public.has_role(auth.uid(), 'master'))
with check (public.has_role(auth.uid(), 'master'));