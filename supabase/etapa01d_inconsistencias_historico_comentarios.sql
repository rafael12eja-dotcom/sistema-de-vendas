-- Compatibilização do módulo de inconsistências com histórico e comentários
alter table public.inconsistencias
add column if not exists resolvida_em timestamp,
add column if not exists observacao text,
add column if not exists responsavel text;

create table if not exists public.inconsistencias_historico (
  id uuid default gen_random_uuid() primary key,
  inconsistencia_id uuid not null references public.inconsistencias(id) on delete cascade,
  acao text,
  status_anterior text,
  status_novo text,
  observacao text,
  responsavel text,
  autor text,
  criado_em timestamp default now(),
  alterado_em timestamp default now()
);

create table if not exists public.inconsistencias_comentarios (
  id uuid default gen_random_uuid() primary key,
  inconsistencia_id uuid not null references public.inconsistencias(id) on delete cascade,
  comentario text not null,
  responsavel text,
  autor text,
  criado_em timestamp default now()
);

create index if not exists idx_inconsistencia_hist on public.inconsistencias_historico(inconsistencia_id);
create index if not exists idx_inconsistencia_hist_criado_em on public.inconsistencias_historico(criado_em desc);
create index if not exists idx_inconsistencia_coment on public.inconsistencias_comentarios(inconsistencia_id);
create index if not exists idx_inconsistencia_coment_criado_em on public.inconsistencias_comentarios(criado_em desc);
