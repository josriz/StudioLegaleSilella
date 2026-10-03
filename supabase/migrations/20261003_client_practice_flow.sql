-- Client -> practice linkage and lifecycle fields
alter table public.studio_pratiche
  add column if not exists client_id uuid references public.studio_clienti(id) on delete set null,
  add column if not exists intake_source text not null default 'studio',
  add column if not exists accepted_at timestamptz,
  add column if not exists closed_at timestamptz;
create index if not exists idx_studio_pratiche_client_id on public.studio_pratiche(client_id);
create index if not exists idx_studio_pratiche_status on public.studio_pratiche(status);
