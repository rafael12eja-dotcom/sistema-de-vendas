create extension if not exists pgcrypto;

alter table public.eventos
add column if not exists nome_cliente text;

update public.eventos
set nome_cliente = coalesce(nome_cliente, cliente)
where nome_cliente is null;

alter table public.eventos
add column if not exists telefone_cliente text;

alter table public.eventos
add column if not exists unidade text;

alter table public.eventos
add column if not exists valor_vendido numeric;

alter table public.eventos
add column if not exists valor_recebido numeric default 0;

alter table public.eventos
add column if not exists status text default 'pendente';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'eventos'
      and column_name = 'valor_a_receber'
  ) then
    execute 'alter table public.eventos add column valor_a_receber numeric generated always as (coalesce(valor_vendido,0) - coalesce(valor_recebido,0)) stored';
  end if;
end $$;

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  arquivo_path text not null,
  url_arquivo text,
  mime_type text,
  extensao text,
  tamanho_bytes bigint,
  categoria_sugerida text not null default 'pendente',
  status_processamento text not null default 'pendente',
  status_confirmacao text not null default 'pendente',
  confianca_leitura numeric(5,2) not null default 0,
  evento_id uuid references public.eventos(id) on delete set null,
  dados_extraidos jsonb not null default '{}'::jsonb,
  dados_sugeridos jsonb not null default '{}'::jsonb,
  pendencias jsonb not null default '[]'::jsonb,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_documentos_criado_em on public.documentos(criado_em desc);
create index if not exists idx_documentos_evento_id on public.documentos(evento_id);
create index if not exists idx_documentos_categoria on public.documentos(categoria_sugerida);
create index if not exists idx_documentos_status on public.documentos(status_processamento, status_confirmacao);

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

alter table public.documentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documentos'
      and policyname = 'documentos_select_publico'
  ) then
    create policy documentos_select_publico
    on public.documentos
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documentos'
      and policyname = 'documentos_insert_publico'
  ) then
    create policy documentos_insert_publico
    on public.documentos
    for insert
    to anon, authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documentos'
      and policyname = 'documentos_update_publico'
  ) then
    create policy documentos_update_publico
    on public.documentos
    for update
    to anon, authenticated
    using (true)
    with check (true);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-homefest',
  'documentos-homefest',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_documentos_select_publico'
  ) then
    create policy storage_documentos_select_publico
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'documentos-homefest');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_documentos_insert_publico'
  ) then
    create policy storage_documentos_insert_publico
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'documentos-homefest');
  end if;
end $$;
