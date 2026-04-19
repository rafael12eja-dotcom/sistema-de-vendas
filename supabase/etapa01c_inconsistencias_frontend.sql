-- Etapa 1 — Bloco 3 — suporte opcional ao frontend de inconsistências
alter table if exists public.inconsistencias
  add column if not exists observacao text,
  add column if not exists responsavel text,
  add column if not exists resolvida_em timestamptz;

comment on column public.inconsistencias.observacao is 'Justificativa operacional ou nota de tratamento da inconsistência';
comment on column public.inconsistencias.responsavel is 'Responsável pelo tratamento operacional da inconsistência';
comment on column public.inconsistencias.resolvida_em is 'Momento em que a inconsistência foi marcada como resolvida';
