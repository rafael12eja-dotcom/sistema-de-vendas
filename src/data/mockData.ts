export const summary = {
  vendido: 184500,
  recebido: 121870,
  aReceber: 62630,
  custosEventos: 68240,
  despesasFixas: 24150,
  investimentos: 12800,
};

export const resultadoReal =
  summary.vendido -
  summary.custosEventos -
  summary.despesasFixas -
  summary.investimentos;

export const eventos = [
  { codigo: "HF-260401", cliente: "Família Andrade", unidade: "Infantil", data: "26/04/2026", vendido: 12500, recebido: 7500, receber: 5000, status: "Confirmado" },
  { codigo: "HF-260402", cliente: "Grupo Veredas", unidade: "Adulto", data: "30/04/2026", vendido: 18800, recebido: 9400, receber: 9400, status: "Parcial" },
  { codigo: "HF-260403", cliente: "Churrasco Prime", unidade: "BBQ / Fire", data: "04/05/2026", vendido: 26300, recebido: 26300, receber: 0, status: "Quitado" },
];

export const alertas = [
  "2 eventos com recebimento parcial",
  "1 investimento lançado neste mês",
  "Resultado real positivo no período",
];

export function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}
