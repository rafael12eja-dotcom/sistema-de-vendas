-- ETAPA 04B :: Canonicalização da tabela documentos
-- Objetivo: alinhar a estrutura real ao contrato definitivo do sistema
-- Regra: frontend passa a operar com modelo canônico, sem depender de colunas transitórias

create extension if not exists pgcrypto;

alter table public.documentos
  add column if not exists tipo_documento text,
  add column if not exists confianca numeric(5,2),
  add column if not exists confirmado boolean,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now();

update public.documentos
set
  tipo_documento = coalesce(tipo_documento, categoria_sugerida, 'pendente'),
  confianca = coalesce(confianca, confianca_leitura, 0),
  confirmado = coalesce(confirmado, status_confirmacao = 'confirmado', false),
  url_arquivo = coalesce(url_arquivo, ''),
  dados_extraidos = coalesce(dados_extraidos, '{}'::jsonb),
  dados_sugeridos = coalesce(dados_sugeridos, '{}'::jsonb)
where true;

alter table public.documentos
  alter column nome_arquivo set not null,
  alter column tipo_documento set not null,
  alter column status_processamento set not null,
  alter column confianca set not null,
  alter column dados_extraidos set not null,
  alter column dados_sugeridos set not null,
  alter column confirmado set not null;

alter table public.documentos
  alter column tipo_documento set default 'pendente',
  alter column status_processamento set default 'pendente',
  alter column confianca set default 0,
  alter column dados_extraidos set default '{}'::jsonb,
  alter column dados_sugeridos set default '{}'::jsonb,
  alter column confirmado set default false;

create index if not exists idx_documentos_tipo_documento on public.documentos(tipo_documento);
create index if not exists idx_documentos_confirmado on public.documentos(confirmado);
create index if not exists idx_documentos_status_processamento on public.documentos(status_processamento);
create index if not exists idx_documentos_criado_em_v2 on public.documentos(criado_em desc);

create or replace function public.atualizar_timestamp_documentos()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_documentos_atualizado_em on public.documentos;
create trigger trg_documentos_atualizado_em
before update on public.documentos
for each row execute function public.atualizar_timestamp_documentos();

comment on table public.documentos is 'Base documental canônica da Home Fest. Confirmação humana obrigatória antes de qualquer uso operacional.';
comment on column public.documentos.tipo_documento is 'Categoria canônica do documento.';
comment on column public.documentos.confirmado is 'Confirmação humana obrigatória. Nunca automatizar lançamento financeiro sem validação.';
comment on column public.documentos.confianca is 'Confiança da leitura/sugestão em percentual.';
