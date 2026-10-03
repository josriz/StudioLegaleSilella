-- Privacy portal integration
alter table public.studio_consensi_portale
  add column if not exists informativa_id uuid references public.studio_privacy_informative(id) on delete set null;

create index if not exists idx_studio_consensi_portale_informativa
  on public.studio_consensi_portale(informativa_id);

drop policy if exists "privacy_informative_public_active" on public.studio_privacy_informative;
create policy "privacy_informative_public_active"
on public.studio_privacy_informative
for select to anon, authenticated
using (stato='attiva' and tipo='clienti');

drop policy if exists "consensi_portale_studio_select" on public.studio_consensi_portale;
create policy "consensi_portale_studio_select"
on public.studio_consensi_portale
for select to authenticated
using (is_studio_user());

drop policy if exists "consensi_portale_studio_update" on public.studio_consensi_portale;
create policy "consensi_portale_studio_update"
on public.studio_consensi_portale
for update to authenticated
using (is_studio_user())
with check (is_studio_user());

revoke all on table public.studio_privacy_informative from anon;
grant select on table public.studio_privacy_informative to anon;