-- Etapa 04 - apoio opcional para leitura gerencial
-- Este arquivo não é obrigatório para o frontend funcionar.
-- Ele cria apenas uma view simples de apoio a consultas no banco.

create or replace view public.v_dre_financeiro_resumo as
select
  competencia,
  sum(case when tipo = 'receber' then valor else 0 end) as total_receber,
  sum(case when tipo = 'pagar' then valor else 0 end) as total_pagar,
  sum(case when status = 'recebido' then valor else 0 end) as recebido,
  sum(case when status = 'pago' then valor else 0 end) as pago,
  sum(case when conciliado = true then valor else 0 end) as conciliado
from public.financeiro_lancamentos
group by competencia;
