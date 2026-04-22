create table if not exists public.fechamentos_mensais (
  periodo text primary key,
  status text not null default 'aberto',
  bloqueado_por_inconsistencias boolean not null default false,
  bloqueios_total integer not null default 0,
  responsavel text,
  observacao text,
  fechado_em timestamp,
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now(),
  constraint fechamentos_mensais_status_check check (status in ('aberto','em_revisao','fechado'))
);

create index if not exists idx_fechamentos_mensais_status on public.fechamentos_mensais(status);

alter table public.inconsistencias
add column if not exists bloqueia_fechamento boolean not null default false;

update public.inconsistencias
set bloqueia_fechamento = true
where severidade = 'critica';
