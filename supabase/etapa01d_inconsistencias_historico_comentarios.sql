alter table if exists public.inconsistencias
  add column if not exists responsavel text,
  add column if not exists observacao text,
  add column if not exists resolvida_em timestamptz;

create table if not exists public.inconsistencias_historico (
  id uuid primary key default gen_random_uuid(),
  inconsistencia_id uuid not null references public.inconsistencias(id) on delete cascade,
  acao text not null default 'atualizacao',
  status_anterior text,
  status_novo text,
  observacao text,
  responsavel text,
  criado_em timestamptz not null default now()
);

create table if not exists public.inconsistencias_comentarios (
  id uuid primary key default gen_random_uuid(),
  inconsistencia_id uuid not null references public.inconsistencias(id) on delete cascade,
  comentario text not null,
  responsavel text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_inconsistencias_historico_inconsistencia_id on public.inconsistencias_historico(inconsistencia_id, criado_em desc);
create index if not exists idx_inconsistencias_comentarios_inconsistencia_id on public.inconsistencias_comentarios(inconsistencia_id, criado_em desc);
