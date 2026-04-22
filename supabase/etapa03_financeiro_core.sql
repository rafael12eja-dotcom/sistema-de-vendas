create table if not exists public.financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar','receber')),
  descricao text not null,
  cliente_fornecedor text,
  valor numeric not null default 0,
  vencimento date,
  competencia text not null,
  status text not null default 'pendente' check (status in ('pendente','pago','recebido','conciliado','vencido')),
  conciliado boolean not null default false,
  conciliado_em timestamp with time zone,
  pago_recebido_em timestamp with time zone,
  origem_tipo text,
  origem_id uuid,
  evento_id uuid,
  observacao text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

create index if not exists idx_financeiro_lancamentos_competencia on public.financeiro_lancamentos (competencia);
create index if not exists idx_financeiro_lancamentos_status on public.financeiro_lancamentos (status);
create index if not exists idx_financeiro_lancamentos_tipo on public.financeiro_lancamentos (tipo);
create index if not exists idx_financeiro_lancamentos_origem on public.financeiro_lancamentos (origem_tipo, origem_id);

create or replace function public.touch_financeiro_lancamentos_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_financeiro_lancamentos_atualizado_em on public.financeiro_lancamentos;
create trigger trg_financeiro_lancamentos_atualizado_em
before update on public.financeiro_lancamentos
for each row execute function public.touch_financeiro_lancamentos_atualizado_em();
