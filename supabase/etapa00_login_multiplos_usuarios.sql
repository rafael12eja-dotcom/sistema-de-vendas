create extension if not exists pgcrypto;

create table if not exists public.app_usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  perfil text not null default 'operacao',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_app_usuarios_email on public.app_usuarios(email);
create index if not exists idx_app_usuarios_status on public.app_usuarios(status);

insert into public.app_usuarios (nome, email, senha_hash, perfil, status)
values (
  'Administrador Home Fest',
  'admin@homefest.local',
  encode(digest('HomeFest2026!', 'sha256'), 'hex'),
  'admin',
  'ativo'
)
on conflict (email) do update set
  nome = excluded.nome,
  senha_hash = excluded.senha_hash,
  perfil = excluded.perfil,
  status = excluded.status,
  atualizado_em = now();
