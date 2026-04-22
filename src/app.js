
import { appData } from './data/appData.js';
import { env } from './env.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx'];
const APP_SESSION_KEY = 'hf_fin_session_v1';
const VIEW_IDS = ['dashboard', 'events', 'documents', 'inconsistencies', 'governance', 'finance', 'dre'];


const state = {
  view: getInitialView(),
  auth: {
    session: loadStoredSession(),
    message: '',
    submitting: false,
    bootstrapChecked: false,
  },
  supabase: null,
  documents: [],
  events: [],
  uploadQueue: [],
  uploading: false,
  documentFilter: 'todos',
  selectedPreview: null,
  statusMessage: '',
  loadingDocuments: false,
  inconsistencies: [],
  loadingInconsistencies: false,
  inconsistencyFilters: {
    status: 'todas',
    severidade: 'todas',
    modulo: 'todos',
    busca: '',
  },
  selectedInconsistencyId: null,
  inconsistencyActionMessage: '',
  inconsistencyHistory: [],
  inconsistencyComments: [],
  loadingInconsistencyDetail: false,
  selectedDashboardSeverity: '',
  newInconsistencyComment: '',
  governance: {
    periodo: '',
    status: 'aberto',
    bloqueado_por_inconsistencias: false,
    bloqueios_total: 0,
    responsavel: '',
    observacao: '',
    fechado_em: null,
    atualizado_em: null,
  },
  loadingGovernance: false,
  governanceMessage: '',
  governanceNoteDraft: '',
  financialEntries: [],
  loadingFinancialEntries: false,
  financialMessage: '',
  financialFilters: {
    tipo: 'todos',
    status: 'todos',
    competencia: '',
    busca: '',
  },
  financialForm: {
    tipo: 'pagar',
    descricao: '',
    cliente_fornecedor: '',
    valor: '',
    vencimento: '',
    competencia: currentPeriodKey(),
    status: 'pendente',
  },
  dreCosts: [],
  dreFixedExpenses: [],
  dreInvestments: [],
  loadingDreData: false,
  dreMessage: '',
  dreFilters: {
    competencia: '',
    destaque: 'todos',
  },
};

function money(v) { return BRL.format(Number(v || 0)); }

function sanitizeFileName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function badge(text, tone='neutral') {
  return `<span class="badge badge-${tone}">${text}</span>`;
}

function navItem(id, label) {
  const active = state.view === id ? 'nav-item active' : 'nav-item';
  return `<button class="${active}" data-view="${id}">${label}</button>`;
}

function getInitialView() {
  const fromHash = String(window.location.hash || '').replace('#', '').trim();
  return VIEW_IDS.includes(fromHash) ? fromHash : 'dashboard';
}

function syncHashWithView() {
  const nextHash = `#${state.view}`;
  if (window.location.hash !== nextHash) {
    history.replaceState(null, '', nextHash);
  }
}

function setView(view, { render = true, load = true } = {}) {
  const nextView = VIEW_IDS.includes(view) ? view : 'dashboard';
  state.view = nextView;
  syncHashWithView();
  if (render) renderApp();
  if (load) hydrateView(nextView);
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(APP_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveStoredSession(session) {
  localStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(APP_SESSION_KEY);
}

async function hashPassword(value) {
  const data = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function currentUserName() {
  return state.auth.session?.nome || 'Operação Home Fest';
}

function canUseSupabase() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function getSupabase() {
  if (!canUseSupabase()) return null;
  if (!state.supabase) {
    state.supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return state.supabase;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusTone(status) {
  if (status === 'confirmado') return 'ok';
  if (status === 'erro') return 'danger';
  if (status === 'analisado') return 'warn';
  return 'neutral';
}

function inconsistencySeverityTone(severity) {
  if (severity === 'critica') return 'danger';
  if (severity === 'alta') return 'warn';
  if (severity === 'media') return 'gold';
  if (severity === 'baixa') return 'neutral';
  return 'neutral';
}

function inconsistencyStatusTone(status) {
  if (status === 'resolvida') return 'ok';
  if (status === 'em_analise') return 'warn';
  if (status === 'ignorada') return 'neutral';
  return 'danger';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function currentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodLabel(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '-';
  const [year, month] = period.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function normalizeGovernanceRow(row = {}) {
  return {
    periodo: row.periodo || currentPeriodKey(),
    status: row.status || 'aberto',
    bloqueado_por_inconsistencias: Boolean(row.bloqueado_por_inconsistencias),
    bloqueios_total: Number(row.bloqueios_total || 0),
    responsavel: row.responsavel || currentUserName(),
    observacao: row.observacao || '',
    fechado_em: row.fechado_em || null,
    criado_em: row.criado_em || null,
    atualizado_em: row.atualizado_em || row.updated_at || null,
  };
}

function getGovernanceMetrics() {
  const unresolved = unresolvedInconsistencies();
  const critical = unresolved.filter((item) => item.severidade === 'critica').length;
  const high = unresolved.filter((item) => item.severidade === 'alta').length;
  const medium = unresolved.filter((item) => item.severidade === 'media').length;
  return {
    unresolved: unresolved.length,
    critical,
    high,
    medium,
    blockers: critical,
    canClose: critical === 0,
  };
}

function getGovernanceTone() {
  const metrics = getGovernanceMetrics();
  if (metrics.critical) return 'critical';
  if (metrics.high) return 'high';
  if (metrics.medium) return 'medium';
  return 'ok';
}

function currentCompetencia() {
  return state.financialFilters?.competencia || currentPeriodKey();
}

function normalizeFinancialRow(row) {
  const tipo = row.tipo || 'pagar';
  const status = row.status || 'pendente';
  const competencia = row.competencia || (row.vencimento ? String(row.vencimento).slice(0,7) : currentPeriodKey());
  return {
    id: row.id,
    tipo,
    descricao: row.descricao || 'Lançamento financeiro',
    cliente_fornecedor: row.cliente_fornecedor || row.cliente || row.fornecedor || '',
    valor: Number(row.valor || 0),
    vencimento: row.vencimento || null,
    competencia,
    status,
    conciliado: Boolean(row.conciliado),
    conciliado_em: row.conciliado_em || null,
    pago_recebido_em: row.pago_recebido_em || null,
    origem_tipo: row.origem_tipo || '',
    origem_id: row.origem_id || null,
    evento_id: row.evento_id || null,
    observacao: row.observacao || '',
    criado_em: row.criado_em || row.created_at || null,
    atualizado_em: row.atualizado_em || row.updated_at || null,
  };
}

function financialStatusTone(status) {
  if (status === 'conciliado') return 'ok';
  if (status === 'recebido' || status === 'pago') return 'gold';
  if (status === 'vencido') return 'danger';
  return 'neutral';
}

function getFinancialEntriesFiltered() {
  const { tipo, status, competencia, busca } = state.financialFilters;
  const q = (busca || '').trim().toLowerCase();
  return state.financialEntries.filter((item) => {
    if (tipo !== 'todos' && item.tipo !== tipo) return false;
    if (status !== 'todos' && item.status !== status) return false;
    if (competencia && item.competencia !== competencia) return false;
    if (q) {
      const hay = `${item.descricao} ${item.cliente_fornecedor} ${item.origem_tipo} ${item.observacao}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function getFinancialMetrics() {
  const rows = state.financialEntries;
  return rows.reduce((acc, item) => {
    const isReceber = item.tipo === 'receber';
    const isPagar = item.tipo === 'pagar';
    if (isReceber) acc.totalReceber += item.valor;
    if (isPagar) acc.totalPagar += item.valor;
    if (isReceber && (item.status === 'pendente' || item.status === 'vencido')) acc.receberPendente += item.valor;
    if (isPagar && (item.status === 'pendente' || item.status === 'vencido')) acc.pagarPendente += item.valor;
    if (item.status === 'recebido') acc.recebido += item.valor;
    if (item.status === 'pago') acc.pago += item.valor;
    if (item.status === 'conciliado') acc.conciliado += item.valor;
    if (item.status === 'vencido') acc.vencidos += 1;
    if (item.conciliado) acc.totalConciliados += 1;
    if (!item.conciliado && (item.status === 'recebido' || item.status === 'pago')) acc.prontosParaConciliar += 1;
    return acc;
  }, {
    totalReceber: 0,
    totalPagar: 0,
    receberPendente: 0,
    pagarPendente: 0,
    recebido: 0,
    pago: 0,
    conciliado: 0,
    vencidos: 0,
    totalConciliados: 0,
    prontosParaConciliar: 0,
  });
}

function monthInputFromPeriod(period) {
  return /^\d{4}-\d{2}$/.test(period || '') ? period : '';
}

function statusLabelFinance(item) {
  if (item.conciliado || item.status === 'conciliado') return 'conciliado';
  return item.status.replaceAll('_',' ');
}

function syncFinancialFormCompetencia() {
  if (!state.financialForm.competencia) state.financialForm.competencia = currentPeriodKey();
}

function buildReceivableFromEvent(evento) {
  const cliente = evento.nome_cliente || evento.cliente || 'Cliente do evento';
  const valor = Number(evento.valor_a_receber || 0);
  if (!valor || valor <= 0) return null;
  const competencia = evento.data_evento ? String(evento.data_evento).slice(0,7) : currentPeriodKey();
  return {
    tipo: 'receber',
    descricao: `Recebimento pendente • ${cliente}`,
    cliente_fornecedor: cliente,
    valor,
    vencimento: evento.data_evento || null,
    competencia,
    status: 'pendente',
    origem_tipo: 'evento',
    origem_id: evento.id,
    evento_id: evento.id,
    observacao: 'Gerado automaticamente a partir do saldo a receber do evento.',
  };
}

function parseMesReferencia(value) {
  if (!value) return '';
  const clean = String(value).trim().toLowerCase();
  const map = {
    janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04', maio: '05', junho: '06',
    julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
  };
  const match = clean.match(/([a-zçãé]+)\s+(\d{4})/i);
  if (!match) return '';
  const month = map[match[1]];
  return month ? `${match[2]}-${month}` : '';
}

function normalizeClientName(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeDreEventRow(row, index = 0) {
  return {
    id: row.id || `app-event-${index}`,
    cliente: row.nome_cliente || row.cliente || 'Evento sem cliente',
    data_evento: row.data_evento || row.dataEvento || row.mes || null,
    competencia: (row.data_evento || row.dataEvento || row.mes || '').slice(0,7),
    tipo: row.unidade || row.tipo || '-',
    valor_vendido: Number(row.valor_vendido ?? row.valorVenda ?? 0),
    valor_recebido: Number(row.valor_recebido ?? row.recebido ?? 0),
    valor_a_receber: Number(row.valor_a_receber ?? row.aReceber ?? 0),
  };
}

function normalizeDreCostRow(row) {
  return {
    evento_id: row.evento_id || null,
    cliente: row.cliente || row.nome_cliente || '',
    valor_real: Number(row.valor_real ?? row.custoReal ?? 0),
    data_lancamento: row.data_lancamento || row.dataEvento || null,
    origem: row.origem || '',
  };
}

function normalizeDreFixedRow(row) {
  return {
    competencia: row.competencia || row.mes_referencia || parseMesReferencia(row.mesReferencia),
    valor: Number(row.valor || row.valor_real || 0),
    descricao: row.descricao || row.categoria || 'Despesa fixa',
  };
}

function normalizeDreInvestmentRow(row) {
  return {
    competencia: row.competencia || row.data_compra?.slice?.(0,7) || row.data_lancamento?.slice?.(0,7) || row.data?.slice?.(0,7) || '',
    valor: Number(row.valor || 0),
    descricao: row.item || row.descricao || row.categoria || 'Investimento',
    status: row.status || '',
  };
}

function getDreEvents() {
  const source = state.events.length ? state.events : appData.events;
  return source.map(normalizeDreEventRow);
}

function getDreCosts() {
  if (state.dreCosts.length) return state.dreCosts.map(normalizeDreCostRow);
  return appData.costsReal.map(normalizeDreCostRow);
}

function getDreFixedExpenses() {
  if (state.dreFixedExpenses.length) return state.dreFixedExpenses.map(normalizeDreFixedRow);
  return appData.fixedExpenses.map(normalizeDreFixedRow);
}

function getDreInvestments() {
  if (state.dreInvestments.length) return state.dreInvestments.map(normalizeDreInvestmentRow);
  return appData.investments.map(normalizeDreInvestmentRow);
}

function buildCostLookups(events, costs) {
  const byEventId = new Map();
  const byClient = new Map();
  costs.forEach((row) => {
    if (row.evento_id) byEventId.set(String(row.evento_id), (byEventId.get(String(row.evento_id)) || 0) + Number(row.valor_real || 0));
    const clientKey = normalizeClientName(row.cliente || row.origem);
    if (clientKey) byClient.set(clientKey, (byClient.get(clientKey) || 0) + Number(row.valor_real || 0));
  });
  const usedClientKeys = new Set();
  const totalFromEvents = events.reduce((sum, event) => {
    if (byEventId.has(String(event.id))) return sum + (byEventId.get(String(event.id)) || 0);
    const key = normalizeClientName(event.cliente);
    if (key && byClient.has(key) && !usedClientKeys.has(key)) {
      usedClientKeys.add(key);
      return sum + (byClient.get(key) || 0);
    }
    return sum;
  }, 0);
  return { byEventId, byClient, totalFromEvents };
}

function getDreEventRows() {
  const events = getDreEvents();
  const costs = getDreCosts();
  const lookups = buildCostLookups(events, costs);
  const consumedClients = new Set();
  return events
    .map((event) => {
      let custo = lookups.byEventId.get(String(event.id)) || 0;
      if (!custo) {
        const key = normalizeClientName(event.cliente);
        if (key && lookups.byClient.has(key) && !consumedClients.has(key)) {
          consumedClients.add(key);
          custo = lookups.byClient.get(key) || 0;
        }
      }
      const lucroBruto = event.valor_vendido - custo;
      const margem = event.valor_vendido > 0 ? (lucroBruto / event.valor_vendido) * 100 : 0;
      return { ...event, custo_evento: custo, lucro_bruto: lucroBruto, margem };
    })
    .sort((a, b) => String(a.data_evento || '').localeCompare(String(b.data_evento || '')));
}

function getDreMonthlyRows() {
  const rows = new Map();
  const touch = (competencia) => {
    if (!competencia) return null;
    if (!rows.has(competencia)) rows.set(competencia, { competencia, vendas: 0, custos: 0, despesasFixas: 0, investimentos: 0, resultadoReal: 0 });
    return rows.get(competencia);
  };

  getDreEventRows().forEach((event) => {
    const bucket = touch(event.competencia);
    if (!bucket) return;
    bucket.vendas += event.valor_vendido;
    bucket.custos += event.custo_evento;
  });

  getDreFixedExpenses().forEach((item) => {
    const bucket = touch(item.competencia);
    if (!bucket) return;
    bucket.despesasFixas += item.valor;
  });

  getDreInvestments().forEach((item) => {
    const bucket = touch(item.competencia);
    if (!bucket) return;
    bucket.investimentos += item.valor;
  });

  return Array.from(rows.values())
    .map((item) => ({ ...item, resultadoReal: item.vendas - item.custos - item.despesasFixas - item.investimentos }))
    .sort((a, b) => String(a.competencia).localeCompare(String(b.competencia)));
}

function getDreExecutiveSummary() {
  const monthlyRows = getDreMonthlyRows();
  const eventRows = getDreEventRows();
  const investments = getDreInvestments();
  const semCompetenciaInvestimentos = investments.filter((item) => !item.competencia && item.valor > 0).reduce((sum, item) => sum + item.valor, 0);
  const totals = monthlyRows.reduce((acc, item) => {
    acc.vendas += item.vendas;
    acc.custos += item.custos;
    acc.despesasFixas += item.despesasFixas;
    acc.investimentos += item.investimentos;
    acc.resultadoReal += item.resultadoReal;
    return acc;
  }, { vendas: 0, custos: 0, despesasFixas: 0, investimentos: 0, resultadoReal: 0 });
  const lucroBrutoTotal = eventRows.reduce((sum, item) => sum + item.lucro_bruto, 0);
  const margemMedia = totals.vendas > 0 ? (totals.resultadoReal / totals.vendas) * 100 : 0;
  return { ...totals, lucroBrutoTotal, margemMedia, semCompetenciaInvestimentos, eventos: eventRows.length, meses: monthlyRows.length };
}

function getFilteredDreMonthlyRows() {
  const rows = getDreMonthlyRows();
  const { competencia, destaque } = state.dreFilters;
  return rows.filter((item) => {
    if (competencia && item.competencia !== competencia) return false;
    if (destaque === 'negativo' && item.resultadoReal >= 0) return false;
    if (destaque === 'positivo' && item.resultadoReal < 0) return false;
    return true;
  });
}


function normalizeHistoryRow(row) {
  return {
    id: row.id,
    inconsistencia_id: row.inconsistencia_id,
    acao: row.acao || row.tipo_acao || 'atualizacao',
    status_anterior: row.status_anterior || '',
    status_novo: row.status_novo || '',
    observacao: row.observacao || row.descricao || '',
    responsavel: row.responsavel || row.autor || currentUserName(),
    criado_em: row.criado_em || row.alterado_em || row.created_at || null,
  };
}

function normalizeCommentRow(row) {
  return {
    id: row.id,
    inconsistencia_id: row.inconsistencia_id,
    comentario: row.comentario || row.texto || '',
    responsavel: row.responsavel || row.autor || currentUserName(),
    criado_em: row.criado_em || row.alterado_em || row.created_at || null,
  };
}

function currentInconsistency() {
  return state.inconsistencies.find((entry) => String(entry.id) === String(state.selectedInconsistencyId)) || null;
}

function historyLabel(item) {
  const parts = [];
  if (item.status_anterior) parts.push(item.status_anterior.replaceAll('_', ' '));
  if (item.status_novo) parts.push(item.status_novo.replaceAll('_', ' '));
  if (parts.length === 2) return `${parts[0]} → ${parts[1]}`;
  if (parts.length === 1) return parts[0];
  return item.acao.replaceAll('_', ' ');
}

function appendLocalHistory(inconsistenciaId, payload) {
  const entry = normalizeHistoryRow({
    id: `local-h-${Date.now()}`,
    inconsistencia_id: inconsistenciaId,
    ...payload,
    criado_em: new Date().toISOString(),
  });
  state.inconsistencyHistory = [entry, ...state.inconsistencyHistory].sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}

function appendLocalComment(inconsistenciaId, comentario) {
  const entry = normalizeCommentRow({
    id: `local-c-${Date.now()}`,
    inconsistencia_id: inconsistenciaId,
    comentario,
    responsavel: currentUserName(),
    criado_em: new Date().toISOString(),
  });
  state.inconsistencyComments = [entry, ...state.inconsistencyComments].sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeInconsistencyRow(row) {
  return {
    ...row,
    id: row.id,
    codigo_regra: row.codigo_regra || '-',
    modulo: row.modulo || '-',
    entidade_tipo: row.entidade_tipo || '-',
    titulo: row.titulo || 'Inconsistência sem título',
    severidade: row.severidade || 'media',
    status: row.status || 'aberta',
    descricao: row.descricao || row.detalhes || '',
    responsavel: row.responsavel || '',
    observacao: row.observacao || '',
    criada_em: row.criada_em || row.created_at || null,
    atualizada_em: row.atualizada_em || row.updated_at || null,
    resolvida_em: row.resolvida_em || null,
    hash_ocorrencia: row.hash_ocorrencia || '',
    entidade_id: row.entidade_id || '',
  };
}

function sortInconsistencies(rows) {
  const severityRank = { critica: 1, alta: 2, media: 3, baixa: 4 };
  return [...rows].sort((a, b) => {
    const ar = severityRank[a.severidade] || 9;
    const br = severityRank[b.severidade] || 9;
    if (ar !== br) return ar - br;
    const at = a.criada_em ? new Date(a.criada_em).getTime() : 0;
    const bt = b.criada_em ? new Date(b.criada_em).getTime() : 0;
    return bt - at;
  });
}

function getInconsistencyMetrics() {
  return state.inconsistencies.reduce((acc, item) => {
    acc.total += 1;
    if (item.status === 'aberta') acc.abertas += 1;
    if (item.status === 'em_analise') acc.emAnalise += 1;
    if (item.status === 'resolvida') acc.resolvidas += 1;
    if (item.status === 'ignorada') acc.ignoradas += 1;
    if (item.severidade === 'critica') acc.criticas += 1;
    if (item.severidade === 'alta') acc.altas += 1;
    if (item.severidade === 'media') acc.medias += 1;
    if (item.severidade === 'baixa') acc.baixas += 1;
    if (item.severidade === 'critica' || item.severidade === 'alta') acc.prioridadeAlta += 1;
    return acc;
  }, { total: 0, abertas: 0, emAnalise: 0, resolvidas: 0, ignoradas: 0, prioridadeAlta: 0, criticas: 0, altas: 0, medias: 0, baixas: 0 });
}

function unresolvedInconsistencies() {
  return state.inconsistencies.filter((item) => item.status !== 'resolvida' && item.status !== 'ignorada');
}

function getDashboardPriorityState() {
  const unresolved = unresolvedInconsistencies();
  const critical = unresolved.filter((item) => item.severidade === 'critica').length;
  const high = unresolved.filter((item) => item.severidade === 'alta').length;
  const medium = unresolved.filter((item) => item.severidade === 'media').length;
  const low = unresolved.filter((item) => item.severidade === 'baixa').length;

  if (critical) {
    return {
      tone: 'critical',
      title: 'Atenção imediata',
      text: `${critical} inconsistência(s) crítica(s) exigem ação agora. O sistema já está apontando risco operacional alto.`,
      cta: 'Abrir críticas',
      severity: 'critica',
    };
  }

  if (high) {
    return {
      tone: 'high',
      title: 'Prioridade alta ativa',
      text: `${high} inconsistência(s) de alta prioridade precisam de tratamento antes de contaminar o fechamento.`,
      cta: 'Abrir altas',
      severity: 'alta',
    };
  }

  if (medium) {
    return {
      tone: 'medium',
      title: 'Pendências médias em aberto',
      text: `${medium} inconsistência(s) médias seguem abertas e devem ser tratadas na rotina operacional.`,
      cta: 'Abrir médias',
      severity: 'media',
    };
  }

  return {
    tone: 'ok',
    title: 'Painel operacional controlado',
    text: low ? `${low} inconsistência(s) baixa(s) seguem monitoradas.` : 'Nenhuma inconsistência crítica, alta ou média aberta neste momento.',
    cta: 'Ver central completa',
    severity: '',
  };
}

function confidenceTone(value) {
  const confidence = Number(value || 0);
  if (confidence >= 85) return 'ok';
  if (confidence >= 60) return 'warn';
  return 'danger';
}

function inferCategory(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.includes('contrato')) return { categoria: 'contrato', confianca: 91, pendencias: ['Validar cliente', 'Validar valor contratado'] };
  if (name.includes('pix') || name.includes('comprovante') || name.includes('pagamento')) return { categoria: 'pagamento_cliente', confianca: 82, pendencias: ['Validar vínculo com evento'] };
  if (name.includes('nota') || name.includes('cupom') || name.includes('compra') || type.startsWith('image/')) return { categoria: 'comprovante_compra', confianca: 76, pendencias: ['Revisar itens e total'] };
  if (type.includes('pdf')) return { categoria: 'contrato', confianca: 68, pendencias: ['Classificação pendente'] };
  return { categoria: 'pendente', confianca: 42, pendencias: ['Classificação manual necessária'] };
}

function buildSuggestedPayload(file, categoryInfo) {
  const base = {
    arquivo: file.name,
    categoria: categoryInfo.categoria,
    tamanho: file.size,
  };

  if (categoryInfo.categoria === 'contrato') {
    return {
      ...base,
      cliente: extractLikelyClientName(file.name),
      valor_contratado: null,
      data_evento: null,
    };
  }

  if (categoryInfo.categoria === 'pagamento_cliente') {
    return {
      ...base,
      cliente: extractLikelyClientName(file.name),
      valor_recebido: null,
      data_pagamento: null,
    };
  }

  if (categoryInfo.categoria === 'comprovante_compra') {
    return {
      ...base,
      fornecedor: extractLikelyClientName(file.name),
      valor_total: null,
      itens: [],
    };
  }

  return base;
}

function extractLikelyClientName(name) {
  const normalized = name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim();
  const chunks = normalized.split(/\s+/).filter(Boolean);
  if (!chunks.length) return '';
  return chunks.slice(0, 3).join(' ');
}

function filePreviewType(fileName, mimeType) {
  const lower = (fileName || '').toLowerCase();
  if ((mimeType || '').startsWith('image/')) return 'image';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return 'file';
}

function getDocumentPreview(documento) {
  const previewType = filePreviewType(documento.nome_arquivo, documento.mime_type);
  if (previewType === 'image') {
    return `<img src="${documento.url_arquivo}" alt="${documento.nome_arquivo}" class="preview-image" />`;
  }
  if (previewType === 'pdf') {
    return `<iframe src="${documento.url_arquivo}" title="${documento.nome_arquivo}" class="preview-frame"></iframe>`;
  }
  return `
    <div class="preview-fallback">
      <div class="preview-icon">${previewType === 'docx' ? 'DOCX' : previewType === 'xlsx' ? 'XLSX' : 'ARQ'}</div>
      <strong>${documento.nome_arquivo}</strong>
      <span>Pré-visualização segura</span>
    </div>
  `;
}


function normalizeDocumentRow(row) {
  const tipoDocumento = row.tipo_documento ?? row.categoria_sugerida ?? 'pendente';
  const confianca = Number(row.confianca ?? row.confianca_leitura ?? 0);
  const confirmado = typeof row.confirmado === 'boolean'
    ? row.confirmado
    : (row.status_confirmacao === 'confirmado');

  const pendencias = Array.isArray(row.pendencias)
    ? row.pendencias
    : Array.isArray(row.dados_extraidos?.pendencias)
      ? row.dados_extraidos.pendencias
      : [];

  const createdAt = row.criado_em ?? row.created_at ?? row.atualizado_em ?? row.updated_at ?? null;
  const ext = row.extensao || ((row.nome_arquivo || '').split('.').pop()?.toLowerCase()) || '';
  const mime = row.mime_type || row.tipo_mime || null;
  const statusProcessamento = row.status_processamento || (confirmado ? 'analisado' : 'pendente');

  return {
    ...row,
    nome_arquivo: row.nome_arquivo || row.nome_original || 'Arquivo sem nome',
    url_arquivo: row.url_arquivo || row.public_url || '',
    tipo_documento: tipoDocumento,
    status_processamento: statusProcessamento,
    confianca,
    confirmado,
    evento_id: row.evento_id || null,
    dados_extraidos: row.dados_extraidos && typeof row.dados_extraidos === 'object' ? row.dados_extraidos : {},
    dados_sugeridos: row.dados_sugeridos && typeof row.dados_sugeridos === 'object' ? row.dados_sugeridos : {},
    pendencias,
    createdAt,
    extensao: ext,
    mime_type: mime,
    tamanho_bytes: Number(row.tamanho_bytes || row.tamanho || 0),
  };
}

function sortDocuments(rows) {
  return [...rows].sort((a, b) => {
    const av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bv - av;
  });
}

function buildCanonicalDocumentPayload(file, preview, publicUrl) {
  return {
    nome_arquivo: file.name,
    url_arquivo: publicUrl,
    tipo_documento: preview.categoria,
    status_processamento: 'analisado',
    confianca: preview.confianca,
    dados_extraidos: {
      nome_arquivo: file.name,
      mime_type: file.type || '',
      tamanho_bytes: file.size,
      origem_leitura: 'heuristica_inicial',
      pendencias: preview.pendencias,
    },
    dados_sugeridos: buildSuggestedPayload(file, preview),
    confirmado: false,
  };
}

function buildLegacyDocumentPayload(file, preview, storagePath, publicUrl, ext) {
  return {
    nome_arquivo: file.name,
    arquivo_path: storagePath,
    url_arquivo: publicUrl,
    mime_type: file.type || null,
    extensao: ext,
    tamanho_bytes: file.size,
    categoria_sugerida: preview.categoria,
    status_processamento: 'analisado',
    status_confirmacao: 'pendente',
    confianca_leitura: preview.confianca,
    dados_extraidos: {
      nome_arquivo: file.name,
      mime_type: file.type || '',
      tamanho_bytes: file.size,
      origem_leitura: 'heuristica_inicial',
    },
    dados_sugeridos: buildSuggestedPayload(file, preview),
    pendencias: preview.pendencias,
  };
}

async function insertDocumentRecord(supabase, file, preview, storagePath, publicUrl, ext) {
  const canonicalPayload = buildCanonicalDocumentPayload(file, preview, publicUrl);
  const canonicalAttempt = await supabase
    .from('documentos')
    .insert(canonicalPayload)
    .select('*')
    .single();

  if (!canonicalAttempt.error) {
    return { data: normalizeDocumentRow(canonicalAttempt.data), error: null, schema: 'canonical' };
  }

  const legacyPayload = buildLegacyDocumentPayload(file, preview, storagePath, publicUrl, ext);
  const legacyAttempt = await supabase
    .from('documentos')
    .insert(legacyPayload)
    .select('*')
    .single();

  if (!legacyAttempt.error) {
    return { data: normalizeDocumentRow(legacyAttempt.data), error: null, schema: 'legacy' };
  }

  return {
    data: null,
    error: legacyAttempt.error || canonicalAttempt.error,
    schema: 'unknown',
  };
}

function buildDocumentUpdatePatch(patch) {
  const next = {};

  if ('evento_id' in patch) next.evento_id = patch.evento_id;
  if ('status_processamento' in patch) next.status_processamento = patch.status_processamento;

  if ('confirmado' in patch) next.confirmado = patch.confirmado;
  if ('tipo_documento' in patch) next.tipo_documento = patch.tipo_documento;
  if ('confianca' in patch) next.confianca = patch.confianca;
  if ('dados_extraidos' in patch) next.dados_extraidos = patch.dados_extraidos;
  if ('dados_sugeridos' in patch) next.dados_sugeridos = patch.dados_sugeridos;

  if ('confirmado' in patch) {
    next.status_confirmacao = patch.confirmado ? 'confirmado' : 'pendente';
  }

  return next;
}

function renderDashboard() {
  const m = appData.metrics;
  const inc = appData.inconsistencies;
  const connected = canUseSupabase();
  const metrics = getInconsistencyMetrics();
  const unresolved = unresolvedInconsistencies();
  const priority = getDashboardPriorityState();
  const unresolvedBySeverity = {
    critica: unresolved.filter((item) => item.severidade === 'critica').length,
    alta: unresolved.filter((item) => item.severidade === 'alta').length,
    media: unresolved.filter((item) => item.severidade === 'media').length,
    baixa: unresolved.filter((item) => item.severidade === 'baixa').length,
  };

  return `
    <section class="hero-card ${priority.tone !== 'ok' ? `hero-card-priority hero-${priority.tone}` : ''}">
      <div>
        <div class="eyebrow">Home Fest & Eventos</div>
        <h1>Painel financeiro executivo</h1>
        <p>Base operacional preparada para eventos, financeiro e documentos com ingestão assistida. A regra central permanece protegida em toda a estrutura.</p>
      </div>
      <div class="hero-side">
        <div class="hero-metric">
          <span>Resultado real</span>
          <strong class="${m.resultReal >= 0 ? 'positive' : 'negative'}">${money(m.resultReal)}</strong>
        </div>
        <div class="hero-note">Resultado Real = Vendas - Custos de Evento - Despesas Fixas - Investimentos</div>
      </div>
    </section>

    <section class="priority-banner tone-${priority.tone}">
      <div>
        <div class="eyebrow">Radar operacional</div>
        <h2>${priority.title}</h2>
        <p>${priority.text}</p>
      </div>
      <div class="priority-banner-actions">
        <div class="priority-summary">
          <span>Em aberto</span>
          <strong>${unresolved.length}</strong>
        </div>
        <button class="action-btn ${priority.tone === 'ok' ? 'ghost' : 'gold'}" ${priority.severity ? `data-dashboard-filter-severity="${priority.severity}"` : 'data-dashboard-go-inconsistencies'}>${priority.cta}</button>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card">
        <span>Vendas totais</span>
        <strong>${money(m.salesTotal)}</strong>
      </article>
      <article class="stat-card">
        <span>Custos reais de evento</span>
        <strong>${money(m.realCostsTotal)}</strong>
      </article>
      <article class="stat-card">
        <span>Despesas fixas realizadas</span>
        <strong>${money(m.fixedRealizedTotal)}</strong>
      </article>
      <article class="stat-card">
        <span>Investimentos lançados</span>
        <strong>${money(m.investmentsTotal)}</strong>
      </article>
      <article class="stat-card">
        <span>Documentos na base</span>
        <strong>${state.documents.length}</strong>
      </article>
      <article class="stat-card">
        <span>Conexão operacional</span>
        <strong class="${connected ? 'positive' : 'negative'}">${connected ? 'Supabase ativo' : 'Configuração pendente'}</strong>
      </article>
    </section>

    <section class="dashboard-alert-grid">
      <button class="alert-chip critical" data-dashboard-filter-severity="critica"><span>Críticas</span><strong>${unresolvedBySeverity.critica}</strong></button>
      <button class="alert-chip high" data-dashboard-filter-severity="alta"><span>Altas</span><strong>${unresolvedBySeverity.alta}</strong></button>
      <button class="alert-chip medium" data-dashboard-filter-severity="media"><span>Médias</span><strong>${unresolvedBySeverity.media}</strong></button>
      <button class="alert-chip low" data-dashboard-filter-severity="baixa"><span>Baixas</span><strong>${unresolvedBySeverity.baixa}</strong></button>
    </section>

    <section class="quick-actions-grid">
      <article class="panel compact-panel">
        <div class="panel-title">Ação imediata</div>
        <p class="muted-copy">Entre direto na central filtrada para tratar o que está aberto agora.</p>
        <div class="quick-actions-row">
          <button class="mini-btn" data-dashboard-go-status="aberta">Abertas (${metrics.abertas})</button>
          <button class="mini-btn" data-dashboard-go-status="em_analise">Em análise (${metrics.emAnalise})</button>
          <button class="mini-btn" data-dashboard-go-inconsistencies>Central completa</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Resumo do motor</div>
        <div class="summary-list">
          <div><span>Total monitorado</span><strong>${metrics.total}</strong></div>
          <div><span>Resolvidas</span><strong class="positive">${metrics.resolvidas}</strong></div>
          <div><span>Ignoradas</span><strong>${metrics.ignoradas}</strong></div>
        </div>
      </article>
    </section>

    <section class="panel-grid governance-highlight">
      <article class="panel compact-panel">
        <div class="panel-title">Governança do período</div>
        <div class="summary-list">
          <div><span>Período</span><strong>${formatPeriodLabel(state.governance.periodo)}</strong></div>
          <div><span>Status</span><strong>${state.governance.status.replaceAll('_', ' ')}</strong></div>
          <div><span>Bloqueios críticos</span><strong class="${getGovernanceMetrics().blockers ? 'negative' : 'positive'}">${getGovernanceMetrics().blockers}</strong></div>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" data-view-governance>Governança</button>
          <button class="mini-btn" data-dashboard-filter-severity="critica">Ver bloqueios</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Fechamento mensal</div>
        <ul class="alert-list">
          <li>${badge(getGovernanceMetrics().canClose ? 'Liberado' : 'Bloqueado', getGovernanceMetrics().canClose ? 'ok' : 'danger')} Fechamento depende de inconsistências críticas zeradas.</li>
          <li>${badge(state.governance.fechado_em ? 'Último fechamento salvo' : 'Sem fechamento registrado', state.governance.fechado_em ? 'ok' : 'warn')} ${state.governance.fechado_em ? formatDateTime(state.governance.fechado_em) : 'Período ainda aberto.'}</li>
        </ul>
      </article>
    </section>

    <section class="panel-grid finance-highlight">
      <article class="panel compact-panel">
        <div class="panel-title">Financeiro core</div>
        <div class="summary-list">
          <div><span>Lançamentos</span><strong>${state.financialEntries.length}</strong></div>
          <div><span>A receber</span><strong class="positive">${money(getFinancialMetrics().receberPendente)}</strong></div>
          <div><span>A pagar</span><strong class="negative">${money(getFinancialMetrics().pagarPendente)}</strong></div>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" data-view-finance>Abrir financeiro</button>
          <button class="mini-btn" id="dashboard-generate-receivables-inline">Gerar recebíveis</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Conciliação</div>
        <ul class="alert-list">
          <li>${badge(`${getFinancialMetrics().prontosParaConciliar} pronto(s)`, getFinancialMetrics().prontosParaConciliar ? 'warn' : 'ok')} Pagamentos e recebimentos aguardando conciliação.</li>
          <li>${badge(`${getFinancialMetrics().vencidos} vencido(s)`, getFinancialMetrics().vencidos ? 'danger' : 'ok')} Lançamentos que já passaram do prazo.</li>
        </ul>
      </article>
    </section>

    <section class="panel-grid dre-highlight">
      <article class="panel compact-panel">
        <div class="panel-title">DRE gerencial</div>
        <div class="summary-list">
          <div><span>Resultado real</span><strong class="${getDreExecutiveSummary().resultadoReal >= 0 ? 'positive' : 'negative'}">${money(getDreExecutiveSummary().resultadoReal)}</strong></div>
          <div><span>Lucro bruto</span><strong>${money(getDreExecutiveSummary().lucroBrutoTotal)}</strong></div>
          <div><span>Margem real</span><strong>${getDreExecutiveSummary().margemMedia.toFixed(1)}%</strong></div>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" data-view-dre>Abrir DRE</button>
          <button class="mini-btn" data-dre-set-negative>Meses negativos</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Leitura executiva</div>
        <ul class="alert-list">
          <li>${badge(`${getDreExecutiveSummary().meses} mês(es)`, 'ok')} Base mensal consolidada para leitura gerencial.</li>
          <li>${badge(`${getDreExecutiveSummary().eventos} evento(s)`, 'ok')} Visão por evento com lucro bruto e margem.</li>
          <li>${badge(getDreExecutiveSummary().semCompetenciaInvestimentos ? 'Ajustar competência' : 'Competências ok', getDreExecutiveSummary().semCompetenciaInvestimentos ? 'warn' : 'ok')} ${getDreExecutiveSummary().semCompetenciaInvestimentos ? 'Há investimentos sem competência mensal e eles ficam fora da leitura por mês.' : 'Investimentos com competência conseguem entrar na leitura mensal.'}</li>
        </ul>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel">
        <div class="panel-title">Alertas de consistência</div>
        <ul class="alert-list">
          <li>${badge(`${inc.eventosSemCustoReal.length} evento(s) sem custo real`, inc.eventosSemCustoReal.length ? 'warn' : 'ok')} ${inc.eventosSemCustoReal.join(', ') || 'Nenhum'}</li>
          <li>${badge(`${inc.investimentosSemValor.length} investimento(s) sem valor`, inc.investimentosSemValor.length ? 'warn' : 'ok')} ${inc.investimentosSemValor.slice(0,6).join(', ') || 'Nenhum'}</li>
          <li>${badge(`${inc.eventosSemRecebimentoInformado.length} evento(s) sem caixa informado`, inc.eventosSemRecebimentoInformado.length ? 'warn' : 'ok')} ${inc.eventosSemRecebimentoInformado.slice(0,6).join(', ') || 'Nenhum'}</li>
        </ul>
      </article>
      <article class="panel">
        <div class="panel-title">O que o dashboard já controla</div>
        <ul class="alert-list">
          <li>${badge('Motor ativo', 'ok')} Contadores por severidade e atalhos clicáveis para a central.</li>
          <li>${badge('Histórico', 'ok')} Cada mudança de status pode ser registrada e auditada.</li>
          <li>${badge('Operação', unresolved.length ? 'warn' : 'ok')} Pendências abertas ficam visíveis logo no topo.</li>
        </ul>
      </article>
    </section>
  `;
}

function renderDocuments() {
  const filtered = state.documents.filter((doc) => {
    if (state.documentFilter === 'todos') return true;
    if (state.documentFilter === 'pendentes') return !doc.confirmado;
    if (state.documentFilter === 'confirmados') return doc.confirmado;
    return doc.tipo_documento === state.documentFilter;
  });

  const queue = state.uploadQueue.map((item, index) => `
    <article class="queue-card">
      <div class="queue-main">
        <strong>${item.file.name}</strong>
        <span>${formatBytes(item.file.size)} • ${item.preview.categoria.replaceAll('_', ' ')}</span>
      </div>
      <div class="queue-meta">
        ${badge(`${item.preview.confianca}%`, confidenceTone(item.preview.confianca))}
        ${badge(item.statusLabel, item.statusTone)}
        <button class="mini-btn" data-remove-queue="${index}">Remover</button>
      </div>
    </article>
  `).join('');

  const cards = filtered.map((doc) => {
    const tipoDocumento = (doc.tipo_documento || 'pendente').replaceAll('_', ' ');
    const nomeArquivo = doc.nome_arquivo || 'Arquivo sem nome';
    const confianca = Number(doc.confianca || 0);
    const confirmacaoLabel = doc.confirmado ? 'confirmado' : 'pendente';
    const pendencias = Array.isArray(doc.pendencias) ? doc.pendencias : [];

    return `
      <article class="document-card">
        <div class="document-preview" data-open-preview="${doc.id}">
          ${getDocumentPreview(doc)}
        </div>
        <div class="document-body">
          <div class="document-head">
            <div>
              <strong>${nomeArquivo}</strong>
              <span>${(doc.extensao || 'arq').toUpperCase()} • ${formatBytes(doc.tamanho_bytes)}</span>
            </div>
            <div class="document-badges">
              ${badge(tipoDocumento, 'neutral')}
              ${badge(`${confianca}%`, confidenceTone(confianca))}
            </div>
          </div>
          <div class="document-status-line">
            ${badge(`Processamento: ${doc.status_processamento || 'pendente'}`, statusTone(doc.status_processamento))}
            ${badge(`Confirmação: ${confirmacaoLabel}`, statusTone(confirmacaoLabel))}
          </div>
          <div class="document-grid">
            <div>
              <span class="muted-label">Extraído</span>
              <pre>${JSON.stringify(doc.dados_extraidos || {}, null, 2)}</pre>
            </div>
            <div>
              <span class="muted-label">Sugerido</span>
              <pre>${JSON.stringify(doc.dados_sugeridos || {}, null, 2)}</pre>
            </div>
          </div>
          <div class="pendencias">
            ${pendencias.map((p) => `<span>${p}</span>`).join('') || '<span>Nenhuma pendência</span>'}
          </div>
          <div class="document-actions">
            <select data-event-link="${doc.id}">
              <option value="">Vincular evento</option>
              ${state.events.map((event) => `
                <option value="${event.id}" ${doc.evento_id === event.id ? 'selected' : ''}>
                  ${(event.nome_cliente || event.cliente || 'Evento sem cliente')} • ${event.data_evento || '-'}
                </option>
              `).join('')}
            </select>
            <button class="action-btn ghost" data-open-file="${doc.url_arquivo || ''}">Abrir</button>
            <button class="action-btn" data-confirm-document="${doc.id}">Confirmar</button>
            <button class="action-btn ghost" data-mark-pending="${doc.id}">Pendente</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="page-head documents-head">
      <div>
        <div class="eyebrow">Módulo Documentos</div>
        <h1>Ingestão documental assistida</h1>
        <p>Receber, armazenar, sugerir e confirmar. Nenhum documento gera lançamento automático.</p>
      </div>
      <div class="head-actions">
        <button class="filter-btn ${state.documentFilter === 'todos' ? 'active' : ''}" data-filter="todos">Todos</button>
        <button class="filter-btn ${state.documentFilter === 'pendentes' ? 'active' : ''}" data-filter="pendentes">Pendentes</button>
        <button class="filter-btn ${state.documentFilter === 'confirmados' ? 'active' : ''}" data-filter="confirmados">Confirmados</button>
      </div>
    </section>

    ${renderConnectionWarning()}

    <section class="documents-layout">
      <article class="panel upload-panel">
        <div class="panel-title">Receber arquivos</div>
        <label class="dropzone" id="dropzone">
          <input id="file-input" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx" hidden />
          <div class="dropzone-icon">+</div>
          <strong>Arraste e solte aqui</strong>
          <span>Ou toque para selecionar vários arquivos</span>
          <small>Formatos aceitos: JPG, PNG, PDF, DOCX e XLSX</small>
        </label>
        <div class="upload-actions">
          <button class="action-btn" id="select-files-btn">Selecionar arquivos</button>
          <button class="action-btn gold" id="upload-files-btn" ${state.uploadQueue.length ? '' : 'disabled'}>
            ${state.uploading ? 'Enviando...' : 'Enviar para a base'}
          </button>
        </div>
        <div class="upload-state">${state.statusMessage || 'Fila pronta para análise assistida.'}</div>
        <div class="queue-list">${queue || '<div class="empty-state compact">Nenhum arquivo na fila.</div>'}</div>
      </article>

      <article class="panel records-panel">
        <div class="panel-title">Base documental</div>
        <div class="records-toolbar">
          <select id="category-filter">
            <option value="todos" ${state.documentFilter === 'todos' ? 'selected' : ''}>Todas as categorias</option>
            <option value="comprovante_compra" ${state.documentFilter === 'comprovante_compra' ? 'selected' : ''}>Comprovantes de compra</option>
            <option value="pagamento_cliente" ${state.documentFilter === 'pagamento_cliente' ? 'selected' : ''}>Pagamentos de clientes</option>
            <option value="contrato" ${state.documentFilter === 'contrato' ? 'selected' : ''}>Contratos</option>
            <option value="pendente" ${state.documentFilter === 'pendente' ? 'selected' : ''}>Pendentes</option>
          </select>
          <button class="action-btn ghost" id="refresh-documents-btn">${state.loadingDocuments ? 'Atualizando...' : 'Atualizar'}</button>
        </div>
        <div class="documents-feed">${cards || '<div class="empty-state">Nenhum documento encontrado na base.</div>'}</div>
      </article>
    </section>
  `;
}


function renderInconsistencies() {
  const metrics = getInconsistencyMetrics();
  const filters = state.inconsistencyFilters;
  const filtered = state.inconsistencies.filter((item) => {
    const statusOk = filters.status === 'todas' || item.status === filters.status;
    const severityOk = filters.severidade === 'todas' || item.severidade === filters.severidade;
    const moduleOk = filters.modulo === 'todos' || item.modulo === filters.modulo;
    const searchBase = `${item.codigo_regra} ${item.titulo} ${item.modulo} ${item.entidade_tipo} ${item.observacao}`.toLowerCase();
    const searchOk = !filters.busca || searchBase.includes(filters.busca.toLowerCase());
    return statusOk && severityOk && moduleOk && searchOk;
  });

  const modules = [...new Set(state.inconsistencies.map((item) => item.modulo).filter(Boolean))].sort();

  const cards = filtered.map((item) => `
    <article class="inconsistency-card severity-${item.severidade}">
      <div class="inconsistency-top">
        <div>
          <div class="eyebrow">${escapeHtml(item.codigo_regra)}</div>
          <h3>${escapeHtml(item.titulo)}</h3>
          <p>${escapeHtml(item.modulo)} • ${escapeHtml(item.entidade_tipo)} ${item.entidade_id ? `• ${escapeHtml(item.entidade_id)}` : ''}</p>
        </div>
        <div class="document-badges">
          ${badge(item.severidade, inconsistencySeverityTone(item.severidade))}
          ${badge(item.status.replaceAll('_', ' '), inconsistencyStatusTone(item.status))}
        </div>
      </div>
      <div class="inconsistency-meta">
        <span>Criada em ${formatDateTime(item.criada_em)}</span>
        ${item.resolvida_em ? `<span>Resolvida em ${formatDateTime(item.resolvida_em)}</span>` : ''}
        ${item.responsavel ? `<span>Responsável: ${escapeHtml(item.responsavel)}</span>` : ''}
        <span>Comentários: ${state.inconsistencyComments.filter((entry) => String(entry.inconsistencia_id) === String(item.id)).length}</span>
      </div>
      ${item.observacao ? `<div class="inconsistency-note">${escapeHtml(item.observacao)}</div>` : ''}
      <div class="document-actions">
        <button class="action-btn ghost" data-open-inconsistency="${item.id}">Ver detalhe</button>
        <button class="action-btn" data-mark-inconsistency-analysis="${item.id}" ${item.status === 'em_analise' ? 'disabled' : ''}>Em análise</button>
        <button class="action-btn gold" data-resolve-inconsistency="${item.id}" ${item.status === 'resolvida' ? 'disabled' : ''}>Resolver</button>
        <button class="action-btn ghost" data-ignore-inconsistency="${item.id}" ${item.status === 'ignorada' ? 'disabled' : ''}>Ignorar</button>
      </div>
    </article>
  `).join('');

  return `
    <section class="page-head documents-head">
      <div>
        <div class="eyebrow">Motor de inconsistências</div>
        <h1>Centro de controle operacional</h1>
        <p>Detectar, priorizar, acompanhar e resolver ocorrências antes que virem erro financeiro ou operacional.</p>
      </div>
      <div class="head-actions">
        <button class="action-btn ghost" id="refresh-inconsistencies-btn">${state.loadingInconsistencies ? 'Atualizando...' : 'Atualizar'}</button>
      </div>
    </section>

    ${renderConnectionWarning()}

    <section class="stats-grid">
      <article class="stat-card"><span>Total</span><strong>${metrics.total}</strong></article>
      <article class="stat-card"><span>Abertas</span><strong class="negative">${metrics.abertas}</strong></article>
      <article class="stat-card"><span>Em análise</span><strong>${metrics.emAnalise}</strong></article>
      <article class="stat-card"><span>Resolvidas</span><strong class="positive">${metrics.resolvidas}</strong></article>
      <article class="stat-card"><span>Ignoradas</span><strong>${metrics.ignoradas}</strong></article>
      <article class="stat-card"><span>Prioridade alta</span><strong class="${metrics.prioridadeAlta ? 'negative' : 'positive'}">${metrics.prioridadeAlta}</strong></article>
    </section>

    <section class="panel">
      <div class="panel-title">Filtros operacionais</div>
      <div class="filters-grid">
        <label>
          <span class="muted-label">Status</span>
          <select id="inconsistency-status-filter">
            <option value="todas" ${filters.status === 'todas' ? 'selected' : ''}>Todas</option>
            <option value="aberta" ${filters.status === 'aberta' ? 'selected' : ''}>Abertas</option>
            <option value="em_analise" ${filters.status === 'em_analise' ? 'selected' : ''}>Em análise</option>
            <option value="resolvida" ${filters.status === 'resolvida' ? 'selected' : ''}>Resolvidas</option>
            <option value="ignorada" ${filters.status === 'ignorada' ? 'selected' : ''}>Ignoradas</option>
          </select>
        </label>
        <label>
          <span class="muted-label">Severidade</span>
          <select id="inconsistency-severity-filter">
            <option value="todas" ${filters.severidade === 'todas' ? 'selected' : ''}>Todas</option>
            <option value="critica" ${filters.severidade === 'critica' ? 'selected' : ''}>Crítica</option>
            <option value="alta" ${filters.severidade === 'alta' ? 'selected' : ''}>Alta</option>
            <option value="media" ${filters.severidade === 'media' ? 'selected' : ''}>Média</option>
            <option value="baixa" ${filters.severidade === 'baixa' ? 'selected' : ''}>Baixa</option>
          </select>
        </label>
        <label>
          <span class="muted-label">Módulo</span>
          <select id="inconsistency-module-filter">
            <option value="todos" ${filters.modulo === 'todos' ? 'selected' : ''}>Todos</option>
            ${modules.map((modulo) => `<option value="${escapeHtml(modulo)}" ${filters.modulo === modulo ? 'selected' : ''}>${escapeHtml(modulo)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span class="muted-label">Busca</span>
          <input id="inconsistency-search" type="text" value="${escapeHtml(filters.busca)}" placeholder="Código, título, módulo ou observação" />
        </label>
      </div>
      <div class="upload-state">${state.inconsistencyActionMessage || 'Acompanhe e trate cada ocorrência sem apagar histórico.'}</div>
      ${state.selectedDashboardSeverity ? `<div class="active-filter-banner">Filtro rápido do dashboard ativo: <strong>${escapeHtml(state.selectedDashboardSeverity)}</strong> <button class="mini-btn" id="clear-dashboard-severity">Limpar</button></div>` : ''}
    </section>

    <section class="inconsistency-list">
      ${cards || '<div class="empty-state">Nenhuma inconsistência encontrada com os filtros atuais.</div>'}
    </section>
  `;
}

function renderInconsistencyModal() {
  if (!state.selectedInconsistencyId) return '';
  const item = currentInconsistency();
  if (!item) return '';

  const historyHtml = state.inconsistencyHistory.length
    ? state.inconsistencyHistory.map((entry) => `
        <div class="timeline-item">
          <div class="timeline-head">
            <strong>${escapeHtml(historyLabel(entry))}</strong>
            <span>${formatDateTime(entry.criado_em)}</span>
          </div>
          <div class="timeline-meta">${escapeHtml(entry.responsavel || currentUserName())} • ${escapeHtml(entry.acao.replaceAll('_', ' '))}</div>
          ${entry.observacao ? `<div class="timeline-note">${escapeHtml(entry.observacao)}</div>` : ''}
        </div>
      `).join('')
    : '<div class="empty-state compact">Nenhum histórico detalhado encontrado para esta inconsistência.</div>';

  const commentsHtml = state.inconsistencyComments.length
    ? state.inconsistencyComments.map((entry) => `
        <div class="comment-item">
          <div class="timeline-head">
            <strong>${escapeHtml(entry.responsavel || currentUserName())}</strong>
            <span>${formatDateTime(entry.criado_em)}</span>
          </div>
          <div class="timeline-note">${escapeHtml(entry.comentario)}</div>
        </div>
      `).join('')
    : '<div class="empty-state compact">Nenhum comentário operacional registrado ainda.</div>';

  return `
    <div class="modal-backdrop" id="inconsistency-backdrop">
      <div class="modal-card modal-card-wide">
        <div class="modal-head">
          <div>
            <div class="eyebrow">Detalhe da inconsistência</div>
            <strong>${escapeHtml(item.codigo_regra)} • ${escapeHtml(item.titulo)}</strong>
          </div>
          <button class="icon-btn" id="close-inconsistency-btn">✕</button>
        </div>
        <div class="modal-content">
          <div class="detail-grid">
            <div class="detail-box">
              <span class="muted-label">Status</span>
              <strong>${badge(item.status.replaceAll('_', ' '), inconsistencyStatusTone(item.status))}</strong>
            </div>
            <div class="detail-box">
              <span class="muted-label">Severidade</span>
              <strong>${badge(item.severidade, inconsistencySeverityTone(item.severidade))}</strong>
            </div>
            <div class="detail-box">
              <span class="muted-label">Módulo</span>
              <strong>${escapeHtml(item.modulo)}</strong>
            </div>
            <div class="detail-box">
              <span class="muted-label">Entidade</span>
              <strong>${escapeHtml(item.entidade_tipo)} ${item.entidade_id ? `• ${escapeHtml(item.entidade_id)}` : ''}</strong>
            </div>
            <div class="detail-box">
              <span class="muted-label">Criada em</span>
              <strong>${formatDateTime(item.criada_em)}</strong>
            </div>
            <div class="detail-box">
              <span class="muted-label">Resolvida em</span>
              <strong>${formatDateTime(item.resolvida_em)}</strong>
            </div>
          </div>
          <div class="detail-grid detail-grid-2cols">
            <div class="detail-box full-mobile">
              <span class="muted-label">Descrição / observação</span>
              <pre>${escapeHtml(item.descricao || item.observacao || 'Sem descrição complementar registrada.')}</pre>
            </div>
            <div class="detail-box full-mobile">
              <span class="muted-label">Ações rápidas</span>
              <div class="document-actions top-gap">
                <button class="action-btn" data-mark-inconsistency-analysis="${item.id}" ${item.status === 'em_analise' ? 'disabled' : ''}>Em análise</button>
                <button class="action-btn gold" data-resolve-inconsistency="${item.id}" ${item.status === 'resolvida' ? 'disabled' : ''}>Resolver</button>
                <button class="action-btn ghost" data-ignore-inconsistency="${item.id}" ${item.status === 'ignorada' ? 'disabled' : ''}>Ignorar</button>
              </div>
            </div>
            <div class="detail-box full-mobile">
              <span class="muted-label">Histórico operacional</span>
              <div class="timeline-list ${state.loadingInconsistencyDetail ? 'loading-block' : ''}">${historyHtml}</div>
            </div>
            <div class="detail-box full-mobile">
              <span class="muted-label">Comentários</span>
              <div class="comment-form">
                <textarea id="inconsistency-comment-text" placeholder="Registrar comentário operacional, decisão tomada ou contexto da equipe...">${escapeHtml(state.newInconsistencyComment)}</textarea>
                <div class="document-actions">
                  <button class="action-btn gold" id="save-inconsistency-comment" data-inconsistency-comment-id="${item.id}">Salvar comentário</button>
                </div>
              </div>
              <div class="timeline-list ${state.loadingInconsistencyDetail ? 'loading-block' : ''}">${commentsHtml}</div>
            </div>
          </div>
          <div class="detail-box full">
            <span class="muted-label">Payload operacional</span>
            <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPreviewModal() {
  if (!state.selectedPreview) return '';
  const doc = state.documents.find((item) => String(item.id) === String(state.selectedPreview));
  if (!doc) return '';
  return `
    <div class="modal-backdrop" id="preview-backdrop">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <div class="eyebrow">Pré-visualização</div>
            <strong>${doc.nome_arquivo}</strong>
          </div>
          <button class="icon-btn" id="close-preview-btn">✕</button>
        </div>
        <div class="modal-content">
          ${getDocumentPreview(doc)}
        </div>
      </div>
    </div>
  `;
}

function renderGovernance() {
  const governance = state.governance;
  const metrics = getGovernanceMetrics();
  const tone = getGovernanceTone();
  const blockerList = unresolvedInconsistencies().filter((item) => item.severidade === 'critica').slice(0, 8);

  return `
    <section class="page-head documents-head">
      <div>
        <div class="eyebrow">Governança operacional</div>
        <h1>Fechamento mensal e travas de risco</h1>
        <p>O sistema deixa de ser apenas visual e passa a proteger o fechamento quando há inconsistências críticas abertas.</p>
      </div>
      <div class="head-actions">
        <button class="action-btn ghost" id="refresh-governance-btn">${state.loadingGovernance ? 'Atualizando...' : 'Atualizar'}</button>
      </div>
    </section>

    ${renderConnectionWarning()}

    <section class="priority-banner tone-${tone}">
      <div>
        <div class="eyebrow">Status do período</div>
        <h2>${governance.bloqueado_por_inconsistencias ? 'Fechamento bloqueado' : governance.status === 'fechado' ? 'Período fechado' : governance.status === 'em_revisao' ? 'Período em revisão' : 'Período aberto'}</h2>
        <p>${governance.bloqueado_por_inconsistencias ? `${metrics.blockers} inconsistência(s) crítica(s) aberta(s) impedem o fechamento normal.` : governance.status === 'fechado' ? 'Período encerrado com registro de governança salvo.' : 'Período disponível para operação, revisão e fechamento controlado.'}</p>
      </div>
      <div class="priority-banner-actions">
        <div class="priority-summary">
          <span>Período atual</span>
          <strong>${formatPeriodLabel(governance.periodo)}</strong>
        </div>
        <div class="quick-actions-row">
          <button class="mini-btn" id="governance-open-review-btn">Iniciar revisão</button>
          <button class="mini-btn" id="governance-reopen-btn">Reabrir</button>
          <button class="action-btn ${metrics.canClose ? 'gold' : 'ghost'}" id="governance-close-btn">Fechar período</button>
        </div>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card"><span>Status</span><strong>${governance.status.replaceAll('_', ' ')}</strong></article>
      <article class="stat-card"><span>Bloqueios críticos</span><strong class="${metrics.blockers ? 'negative' : 'positive'}">${metrics.blockers}</strong></article>
      <article class="stat-card"><span>Pendências abertas</span><strong>${metrics.unresolved}</strong></article>
      <article class="stat-card"><span>Responsável</span><strong>${escapeHtml(governance.responsavel || currentUserName())}</strong></article>
      <article class="stat-card"><span>Atualizado em</span><strong>${formatDateTime(governance.atualizado_em)}</strong></article>
      <article class="stat-card"><span>Fechado em</span><strong>${formatDateTime(governance.fechado_em)}</strong></article>
    </section>

    <section class="panel-grid finance-highlight">
      <article class="panel compact-panel">
        <div class="panel-title">Financeiro core</div>
        <div class="summary-list">
          <div><span>Lançamentos</span><strong>${state.financialEntries.length}</strong></div>
          <div><span>A receber</span><strong class="positive">${money(getFinancialMetrics().receberPendente)}</strong></div>
          <div><span>A pagar</span><strong class="negative">${money(getFinancialMetrics().pagarPendente)}</strong></div>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" data-view-finance>Abrir financeiro</button>
          <button class="mini-btn" id="dashboard-generate-receivables-inline">Gerar recebíveis</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Conciliação</div>
        <ul class="alert-list">
          <li>${badge(`${getFinancialMetrics().prontosParaConciliar} pronto(s)`, getFinancialMetrics().prontosParaConciliar ? 'warn' : 'ok')} Pagamentos e recebimentos aguardando conciliação.</li>
          <li>${badge(`${getFinancialMetrics().vencidos} vencido(s)`, getFinancialMetrics().vencidos ? 'danger' : 'ok')} Lançamentos que já passaram do prazo.</li>
        </ul>
      </article>
    </section>

    <section class="panel-grid dre-highlight">
      <article class="panel compact-panel">
        <div class="panel-title">DRE gerencial</div>
        <div class="summary-list">
          <div><span>Resultado real</span><strong class="${getDreExecutiveSummary().resultadoReal >= 0 ? 'positive' : 'negative'}">${money(getDreExecutiveSummary().resultadoReal)}</strong></div>
          <div><span>Lucro bruto</span><strong>${money(getDreExecutiveSummary().lucroBrutoTotal)}</strong></div>
          <div><span>Margem real</span><strong>${getDreExecutiveSummary().margemMedia.toFixed(1)}%</strong></div>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" data-view-dre>Abrir DRE</button>
          <button class="mini-btn" data-dre-set-negative>Meses negativos</button>
        </div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Leitura executiva</div>
        <ul class="alert-list">
          <li>${badge(`${getDreExecutiveSummary().meses} mês(es)`, 'ok')} Base mensal consolidada para leitura gerencial.</li>
          <li>${badge(`${getDreExecutiveSummary().eventos} evento(s)`, 'ok')} Visão por evento com lucro bruto e margem.</li>
          <li>${badge(getDreExecutiveSummary().semCompetenciaInvestimentos ? 'Ajustar competência' : 'Competências ok', getDreExecutiveSummary().semCompetenciaInvestimentos ? 'warn' : 'ok')} ${getDreExecutiveSummary().semCompetenciaInvestimentos ? 'Há investimentos sem competência mensal e eles ficam fora da leitura por mês.' : 'Investimentos com competência conseguem entrar na leitura mensal.'}</li>
        </ul>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel">
        <div class="panel-title">Resumo de bloqueio</div>
        <ul class="alert-list">
          <li>${badge(`${metrics.critical} crítica(s)`, metrics.critical ? 'danger' : 'ok')} Fecham a porta do período até resolução.</li>
          <li>${badge(`${metrics.high} alta(s)`, metrics.high ? 'warn' : 'ok')} Exigem priorização antes de contaminar o fechamento.</li>
          <li>${badge(`${metrics.medium} média(s)`, metrics.medium ? 'gold' : 'ok')} Seguem monitoradas na rotina operacional.</li>
        </ul>
        <div class="top-gap">
          <button class="mini-btn" data-dashboard-filter-severity="critica">Abrir críticas</button>
          <button class="mini-btn" data-dashboard-go-inconsistencies>Central de inconsistências</button>
        </div>
      </article>
      <article class="panel">
        <div class="panel-title">Observação do período</div>
        <textarea id="governance-note-text" placeholder="Registrar decisão da revisão, contexto do fechamento ou motivo da reabertura...">${escapeHtml(state.governanceNoteDraft || governance.observacao || '')}</textarea>
        <div class="document-actions top-gap">
          <button class="action-btn gold" id="save-governance-note-btn">Salvar observação</button>
        </div>
        <div class="upload-state">${state.governanceMessage || 'Governança pronta para operar com trava por inconsistência crítica.'}</div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-title">Bloqueios críticos em aberto</div>
      <div class="documents-feed">
        ${blockerList.length ? blockerList.map((item) => `
          <article class="inconsistency-card severity-${item.severidade}">
            <div class="inconsistency-top">
              <div>
                <div class="eyebrow">${escapeHtml(item.codigo_regra)}</div>
                <h3>${escapeHtml(item.titulo)}</h3>
                <p>${escapeHtml(item.modulo)} • ${escapeHtml(item.entidade_tipo)}</p>
              </div>
              <div class="document-badges">
                ${badge(item.severidade, inconsistencySeverityTone(item.severidade))}
                ${badge(item.status.replaceAll('_', ' '), inconsistencyStatusTone(item.status))}
              </div>
            </div>
            <div class="document-actions">
              <button class="action-btn ghost" data-open-inconsistency="${item.id}">Ver detalhe</button>
              <button class="action-btn" data-mark-inconsistency-analysis="${item.id}">Em análise</button>
            </div>
          </article>
        `).join('') : '<div class="empty-state">Nenhum bloqueio crítico aberto. O período pode avançar para fechamento quando a operação decidir.</div>'}
      </div>
    </section>
  `;
}

function renderFinance() {
  syncFinancialFormCompetencia();
  const metrics = getFinancialMetrics();
  const rows = getFinancialEntriesFiltered();
  const entries = rows.map((item) => `
    <tr>
      <td>${badge(item.tipo === 'receber' ? 'receber' : 'pagar', item.tipo === 'receber' ? 'ok' : 'warn')}</td>
      <td>
        <strong>${escapeHtml(item.descricao)}</strong>
        <div class="table-subtitle">${escapeHtml(item.cliente_fornecedor || '-')}</div>
      </td>
      <td>${money(item.valor)}</td>
      <td>${item.vencimento ? formatDateTime(`${item.vencimento}T12:00:00`) : '-'}</td>
      <td>${formatPeriodLabel(item.competencia)}</td>
      <td>${badge(statusLabelFinance(item), financialStatusTone(item.status))}</td>
      <td>${item.conciliado ? badge('sim', 'ok') : badge('não', 'neutral')}</td>
      <td>
        <div class="table-actions">
          ${item.tipo === 'pagar' ? `<button class="mini-btn" data-financial-status="pago" data-financial-id="${item.id}">Marcar pago</button>` : `<button class="mini-btn" data-financial-status="recebido" data-financial-id="${item.id}">Marcar recebido</button>`}
          <button class="mini-btn" data-financial-status="pendente" data-financial-id="${item.id}">Voltar pendente</button>
          <button class="mini-btn" data-financial-conciliate="${item.id}">${item.conciliado ? 'Reabrir conciliação' : 'Conciliar'}</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <section class="page-head documents-head">
      <div>
        <div class="eyebrow">Financeiro core</div>
        <h1>Contas a pagar, receber e conciliação</h1>
        <p>Controle operacional do caixa real da Home Fest, com previsões, vencimentos e confirmação do que foi pago ou recebido.</p>
      </div>
      <div class="head-actions">
        <button class="action-btn ghost" id="refresh-finance-btn">${state.loadingFinancialEntries ? 'Atualizando...' : 'Atualizar'}</button>
        <button class="action-btn gold" id="generate-receivables-btn">Gerar contas a receber dos eventos</button>
      </div>
    </section>

    ${renderConnectionWarning()}

    <section class="stats-grid">
      <article class="stat-card"><span>Total a receber</span><strong>${money(metrics.totalReceber)}</strong></article>
      <article class="stat-card"><span>Total a pagar</span><strong>${money(metrics.totalPagar)}</strong></article>
      <article class="stat-card"><span>Pendente a receber</span><strong class="positive">${money(metrics.receberPendente)}</strong></article>
      <article class="stat-card"><span>Pendente a pagar</span><strong class="negative">${money(metrics.pagarPendente)}</strong></article>
      <article class="stat-card"><span>Prontos para conciliar</span><strong>${metrics.prontosParaConciliar}</strong></article>
      <article class="stat-card"><span>Vencidos</span><strong class="${metrics.vencidos ? 'negative' : 'positive'}">${metrics.vencidos}</strong></article>
    </section>

    <section class="panel-grid finance-grid">
      <article class="panel compact-panel">
        <div class="panel-title">Novo lançamento financeiro</div>
        <div class="filters-grid finance-form-grid">
          <label>Tipo
            <select id="financial-form-tipo">
              <option value="pagar" ${state.financialForm.tipo === 'pagar' ? 'selected' : ''}>Conta a pagar</option>
              <option value="receber" ${state.financialForm.tipo === 'receber' ? 'selected' : ''}>Conta a receber</option>
            </select>
          </label>
          <label>Descrição
            <input id="financial-form-descricao" value="${escapeHtml(state.financialForm.descricao)}" placeholder="Ex.: Compra de insumos" />
          </label>
          <label>Cliente / fornecedor
            <input id="financial-form-cliente" value="${escapeHtml(state.financialForm.cliente_fornecedor)}" placeholder="Nome do cliente ou fornecedor" />
          </label>
          <label>Valor
            <input id="financial-form-valor" type="number" step="0.01" min="0" value="${escapeHtml(state.financialForm.valor)}" placeholder="0,00" />
          </label>
          <label>Vencimento
            <input id="financial-form-vencimento" type="date" value="${escapeHtml(state.financialForm.vencimento)}" />
          </label>
          <label>Competência
            <input id="financial-form-competencia" type="month" value="${escapeHtml(monthInputFromPeriod(state.financialForm.competencia))}" />
          </label>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="action-btn gold" id="save-financial-entry-btn">Salvar lançamento</button>
        </div>
        <div class="upload-state">${state.financialMessage || 'Financeiro pronto para registrar contas e conciliar movimentações.'}</div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Resumo do caixa operacional</div>
        <div class="summary-list">
          <div><span>Recebido</span><strong class="positive">${money(metrics.recebido)}</strong></div>
          <div><span>Pago</span><strong class="negative">${money(metrics.pago)}</strong></div>
          <div><span>Conciliado</span><strong>${money(metrics.conciliado)}</strong></div>
          <div><span>Saldo líquido previsto</span><strong class="${(metrics.totalReceber - metrics.totalPagar) >= 0 ? 'positive' : 'negative'}">${money(metrics.totalReceber - metrics.totalPagar)}</strong></div>
        </div>
      </article>
    </section>

    <section class="panel">
      <div class="panel-title">Filtros do financeiro</div>
      <div class="filters-grid">
        <label>Tipo
          <select id="financial-filter-tipo">
            <option value="todos" ${state.financialFilters.tipo === 'todos' ? 'selected' : ''}>Todos</option>
            <option value="pagar" ${state.financialFilters.tipo === 'pagar' ? 'selected' : ''}>Pagar</option>
            <option value="receber" ${state.financialFilters.tipo === 'receber' ? 'selected' : ''}>Receber</option>
          </select>
        </label>
        <label>Status
          <select id="financial-filter-status">
            <option value="todos" ${state.financialFilters.status === 'todos' ? 'selected' : ''}>Todos</option>
            <option value="pendente" ${state.financialFilters.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="pago" ${state.financialFilters.status === 'pago' ? 'selected' : ''}>Pago</option>
            <option value="recebido" ${state.financialFilters.status === 'recebido' ? 'selected' : ''}>Recebido</option>
            <option value="conciliado" ${state.financialFilters.status === 'conciliado' ? 'selected' : ''}>Conciliado</option>
            <option value="vencido" ${state.financialFilters.status === 'vencido' ? 'selected' : ''}>Vencido</option>
          </select>
        </label>
        <label>Competência
          <input id="financial-filter-competencia" type="month" value="${escapeHtml(monthInputFromPeriod(state.financialFilters.competencia))}" />
        </label>
        <label>Busca
          <input id="financial-filter-busca" value="${escapeHtml(state.financialFilters.busca)}" placeholder="cliente, fornecedor, descrição..." />
        </label>
      </div>
    </section>

    <section class="table-panel">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Vencimento</th>
            <th>Competência</th>
            <th>Status</th>
            <th>Conciliação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${entries || `<tr><td colspan="8"><div class="empty-state compact">Nenhum lançamento encontrado com os filtros atuais.</div></td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function renderDre() {
  const summary = getDreExecutiveSummary();
  const monthlyRows = getFilteredDreMonthlyRows();
  const eventRows = getDreEventRows();
  const filteredEvents = state.dreFilters.competencia ? eventRows.filter((item) => item.competencia === state.dreFilters.competencia) : eventRows;
  const monthlyTable = monthlyRows.map((item) => `
    <tr>
      <td>${formatPeriodLabel(item.competencia)}</td>
      <td>${money(item.vendas)}</td>
      <td>${money(item.custos)}</td>
      <td>${money(item.despesasFixas)}</td>
      <td>${money(item.investimentos)}</td>
      <td><strong class="${item.resultadoReal >= 0 ? 'positive' : 'negative'}">${money(item.resultadoReal)}</strong></td>
    </tr>
  `).join('');
  const eventTable = filteredEvents.map((item) => `
    <tr>
      <td>${escapeHtml(item.cliente)}</td>
      <td>${escapeHtml(item.tipo)}</td>
      <td>${item.data_evento ? formatDateTime(`${item.data_evento}T12:00:00`) : '-'}</td>
      <td>${money(item.valor_vendido)}</td>
      <td>${money(item.custo_evento)}</td>
      <td><strong class="${item.lucro_bruto >= 0 ? 'positive' : 'negative'}">${money(item.lucro_bruto)}</strong></td>
      <td>${item.margem.toFixed(1)}%</td>
      <td>${money(item.valor_recebido)}</td>
      <td>${money(item.valor_a_receber)}</td>
    </tr>
  `).join('');

  return `
    <section class="page-head documents-head">
      <div>
        <div class="eyebrow">DRE gerencial</div>
        <h1>Resultado real por mês e por evento</h1>
        <p>Leitura executiva da Home Fest com base na regra oficial: vendas - custos de evento - despesas fixas - investimentos.</p>
      </div>
      <div class="head-actions">
        <button class="action-btn ghost" id="refresh-dre-btn">${state.loadingDreData ? 'Atualizando...' : 'Atualizar DRE'}</button>
      </div>
    </section>

    ${renderConnectionWarning()}

    <section class="stats-grid">
      <article class="stat-card"><span>Vendas consolidadas</span><strong>${money(summary.vendas)}</strong></article>
      <article class="stat-card"><span>Custos de evento</span><strong>${money(summary.custos)}</strong></article>
      <article class="stat-card"><span>Despesas fixas</span><strong>${money(summary.despesasFixas)}</strong></article>
      <article class="stat-card"><span>Investimentos com competência</span><strong>${money(summary.investimentos)}</strong></article>
      <article class="stat-card"><span>Lucro bruto</span><strong class="${summary.lucroBrutoTotal >= 0 ? 'positive' : 'negative'}">${money(summary.lucroBrutoTotal)}</strong></article>
      <article class="stat-card"><span>Resultado real</span><strong class="${summary.resultadoReal >= 0 ? 'positive' : 'negative'}">${money(summary.resultadoReal)}</strong></article>
    </section>

    <section class="panel-grid dre-grid">
      <article class="panel compact-panel">
        <div class="panel-title">Filtro gerencial</div>
        <div class="filters-grid finance-form-grid">
          <label>Competência
            <input id="dre-filter-competencia" type="month" value="${escapeHtml(monthInputFromPeriod(state.dreFilters.competencia))}" />
          </label>
          <label>Destaque
            <select id="dre-filter-destaque">
              <option value="todos" ${state.dreFilters.destaque === 'todos' ? 'selected' : ''}>Todos os meses</option>
              <option value="negativo" ${state.dreFilters.destaque === 'negativo' ? 'selected' : ''}>Somente resultado negativo</option>
              <option value="positivo" ${state.dreFilters.destaque === 'positivo' ? 'selected' : ''}>Somente resultado positivo</option>
            </select>
          </label>
        </div>
        <div class="quick-actions-row top-gap">
          <button class="mini-btn" id="dre-clear-filters-btn">Limpar filtros</button>
          <button class="mini-btn" data-view-finance>Abrir financeiro</button>
        </div>
        <div class="upload-state">${state.dreMessage || 'DRE pronto para leitura executiva e comparação por competência.'}</div>
      </article>
      <article class="panel compact-panel">
        <div class="panel-title">Leitura executiva</div>
        <ul class="alert-list">
          <li>${badge(`${summary.eventos} evento(s)`, 'ok')} Eventos já entram com receita, custo e margem por cliente.</li>
          <li>${badge(`${summary.meses} mês(es)`, 'ok')} Competências consolidadas para visão gerencial.</li>
          <li>${badge(summary.semCompetenciaInvestimentos ? money(summary.semCompetenciaInvestimentos) : 'R$ 0,00', summary.semCompetenciaInvestimentos ? 'warn' : 'ok')} Investimentos sem competência mensal cadastrada.</li>
        </ul>
      </article>
    </section>

    <section class="table-panel">
      <div class="panel-title">DRE mensal</div>
      <table>
        <thead>
          <tr>
            <th>Competência</th>
            <th>Vendas</th>
            <th>Custos</th>
            <th>Despesas fixas</th>
            <th>Investimentos</th>
            <th>Resultado real</th>
          </tr>
        </thead>
        <tbody>${monthlyTable || `<tr><td colspan="6"><div class="empty-state compact">Nenhuma competência encontrada com os filtros atuais.</div></td></tr>`}</tbody>
      </table>
    </section>

    <section class="table-panel top-gap-lg">
      <div class="panel-title">Resultado por evento</div>
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Unidade</th>
            <th>Data</th>
            <th>Vendas</th>
            <th>Custo de evento</th>
            <th>Lucro bruto</th>
            <th>Margem</th>
            <th>Recebido</th>
            <th>A receber</th>
          </tr>
        </thead>
        <tbody>${eventTable || `<tr><td colspan="9"><div class="empty-state compact">Nenhum evento encontrado para a competência selecionada.</div></td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function renderEvents() {
  const rows = appData.events.map(e => `
    <tr>
      <td>${e.cliente}</td>
      <td>${e.tipo}</td>
      <td>${e.dataEvento || '-'}</td>
      <td>${e.convidados}</td>
      <td>${money(e.valorVenda)}</td>
      <td>${money(e.recebido)}</td>
      <td>${money(e.aReceber)}</td>
    </tr>
  `).join('');
  return `
    <section class="page-head">
      <h1>Eventos</h1>
      <p>Visão operacional dos eventos já inseridos na base consolidada.</p>
    </section>
    <section class="table-panel">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Unidade</th>
            <th>Data</th>
            <th>Convidados</th>
            <th>Receita</th>
            <th>Recebido</th>
            <th>A receber</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderLogin() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="auth-brand">
          <div class="logo">HF</div>
          <div>
            <div class="brand-title">Home Fest</div>
            <div class="brand-subtitle">Sistema financeiro • acesso multiusuário</div>
          </div>
        </div>
        <div class="eyebrow">Login</div>
        <h1>Acesse o sistema</h1>
        <p class="panel-copy">Cada usuário terá seu próprio acesso. Nesta etapa, o login já está preparado para múltiplos usuários usando a tabela <code>public.app_usuarios</code> no Supabase.</p>
        <form class="auth-form" id="login-form">
          <label>
            <span>E-mail</span>
            <input id="login-email" type="email" placeholder="voce@homefest.com.br" required />
          </label>
          <label>
            <span>Senha</span>
            <input id="login-password" type="password" placeholder="Sua senha" required />
          </label>
          <button class="action-btn gold" type="submit">${state.auth.submitting ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div class="upload-state">${state.auth.message || 'Execute o SQL de login multiusuário no Supabase antes do primeiro acesso.'}</div>
        <div class="auth-help">
          <strong>Primeiro acesso</strong>
          <p>Rode o arquivo <code>supabase/etapa00_login_multiplos_usuarios.sql</code> no SQL Editor do Supabase. Ele cria a tabela de usuários e já deixa um administrador inicial pronto para uso.</p>
          <div class="code-box">
            <div><strong>Usuário inicial:</strong> admin@homefest.local</div>
            <div><strong>Senha inicial:</strong> HomeFest2026!</div>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById('login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await signInWithAppUser();
  });
}

function renderApp() {
  if (!state.auth.session) {
    renderLogin();
    return;
  }
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo">HF</div>
          <div>
            <div class="brand-title">Home Fest</div>
            <div class="brand-subtitle">Sistema financeiro</div>
          </div>
        </div>
        <div class="user-chip">
          <div>
            <strong>${currentUserName()}</strong>
            <span>${state.auth.session?.perfil || 'operacao'}</span>
          </div>
          <button class="mini-btn" id="logout-btn">Sair</button>
        </div>
        <nav class="nav">
          ${navItem('dashboard', 'Dashboard')}
          ${navItem('events', 'Eventos')}
          ${navItem('documents', 'Documentos')}
          ${navItem('inconsistencies', `Inconsistências${unresolvedInconsistencies().length ? ` (${unresolvedInconsistencies().length})` : ''}`)}
          ${navItem('governance', `Governança${getGovernanceMetrics().blockers ? ` (${getGovernanceMetrics().blockers})` : ''}`)}
          ${navItem('finance', `Financeiro${state.financialEntries.length ? ` (${state.financialEntries.length})` : ''}`)}
          ${navItem('dre', 'DRE')}
        </nav>
      </aside>
      <main class="main-content">
        ${state.view === 'dashboard' ? renderDashboard() : ''}
        ${state.view === 'events' ? renderEvents() : ''}
        ${state.view === 'documents' ? renderDocuments() : ''}
        ${state.view === 'inconsistencies' ? renderInconsistencies() : ''}
        ${state.view === 'governance' ? renderGovernance() : ''}
        ${state.view === 'finance' ? renderFinance() : ''}
        ${state.view === 'dre' ? renderDre() : ''}
      </main>
    </div>
    ${renderPreviewModal()}
    ${renderInconsistencyModal()}
  `;

  bindGlobalActions();
}

function bindGlobalActions() {
  document.querySelectorAll('[data-dashboard-filter-severity]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDashboardSeverity = button.dataset.dashboardFilterSeverity;
      state.inconsistencyFilters.severidade = button.dataset.dashboardFilterSeverity;
      setView('inconsistencies');
    });
  });

  document.querySelectorAll('[data-dashboard-go-inconsistencies]').forEach((button) => {
    button.addEventListener('click', () => {
      setView('inconsistencies');
    });
  });

  document.querySelectorAll('[data-dashboard-go-status]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDashboardSeverity = '';
      state.inconsistencyFilters.status = button.dataset.dashboardGoStatus;
      setView('inconsistencies');
    });
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setView(button.dataset.view);
    });
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.documentFilter = button.dataset.filter;
      renderApp();
    });
  });

  document.querySelector('#category-filter')?.addEventListener('change', (event) => {
    state.documentFilter = event.target.value;
    renderApp();
  });

  document.querySelector('#select-files-btn')?.addEventListener('click', () => {
    document.querySelector('#file-input')?.click();
  });

  document.querySelector('#file-input')?.addEventListener('change', (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  });

  document.querySelector('#upload-files-btn')?.addEventListener('click', uploadQueuedFiles);
  document.querySelector('#refresh-documents-btn')?.addEventListener('click', async () => {
    await Promise.all([loadDocuments(), loadEvents()]);
  });

  document.querySelectorAll('[data-remove-queue]').forEach((button) => {
    button.addEventListener('click', () => {
      state.uploadQueue.splice(Number(button.dataset.removeQueue), 1);
      renderApp();
    });
  });

  document.querySelectorAll('[data-open-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPreview = button.dataset.openPreview;
      renderApp();
    });
  });

  document.querySelector('#close-preview-btn')?.addEventListener('click', () => {
    state.selectedPreview = null;
    renderApp();
  });

  document.querySelector('#preview-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'preview-backdrop') {
      state.selectedPreview = null;
      renderApp();
    }
  });

  document.querySelectorAll('[data-open-file]').forEach((button) => {
    button.addEventListener('click', () => {
      window.open(button.dataset.openFile, '_blank', 'noopener,noreferrer');
    });
  });

  document.querySelectorAll('[data-confirm-document]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateDocument(button.dataset.confirmDocument, {
        confirmado: true,
        status_processamento: 'analisado',
      });
    });
  });

  document.querySelectorAll('[data-mark-pending]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateDocument(button.dataset.markPending, {
        confirmado: false,
      });
    });
  });

  document.querySelectorAll('[data-event-link]').forEach((select) => {
    select.addEventListener('change', async () => {
      await updateDocument(select.dataset.eventLink, {
        evento_id: select.value || null,
      });
    });
  });


  document.querySelector('#refresh-inconsistencies-btn')?.addEventListener('click', async () => {
    await loadInconsistencies();
  });
  document.querySelectorAll('[data-view-governance]').forEach((button) => {
    button.addEventListener('click', () => {
      setView('governance');
    });
  });

  document.querySelectorAll('[data-view-finance]').forEach((button) => {
    button.addEventListener('click', () => {
      setView('finance');
    });
  });

  document.querySelectorAll('[data-view-dre]').forEach((button) => {
    button.addEventListener('click', () => {
      setView('dre');
    });
  });

  document.querySelectorAll('[data-dre-set-negative]').forEach((button) => {
    button.addEventListener('click', () => {
      state.dreFilters.destaque = 'negativo';
      setView('dre');
    });
  });

  document.querySelector('#dashboard-generate-receivables-inline')?.addEventListener('click', async () => {
    setView('finance', { load: false });
    await generateReceivablesFromEvents();
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearStoredSession();
    state.auth.session = null;
    state.auth.message = 'Sessão encerrada com sucesso.';
    renderApp();
  });

  document.querySelector('#refresh-governance-btn')?.addEventListener('click', async () => {
    await loadGovernance();
  });

  document.querySelector('#refresh-finance-btn')?.addEventListener('click', async () => {
    await loadFinancialEntries();
  });

  document.querySelector('#refresh-dre-btn')?.addEventListener('click', async () => {
    await loadDreSupportData();
  });

  document.querySelector('#dre-filter-competencia')?.addEventListener('input', (event) => {
    state.dreFilters.competencia = event.target.value;
    renderApp();
  });

  document.querySelector('#dre-filter-destaque')?.addEventListener('change', (event) => {
    state.dreFilters.destaque = event.target.value;
    renderApp();
  });

  document.querySelector('#dre-clear-filters-btn')?.addEventListener('click', () => {
    state.dreFilters.competencia = '';
    state.dreFilters.destaque = 'todos';
    renderApp();
  });

  document.querySelector('#generate-receivables-btn')?.addEventListener('click', async () => {
    await generateReceivablesFromEvents();
  });

  document.querySelector('#save-financial-entry-btn')?.addEventListener('click', async () => {
    await createFinancialEntryFromForm();
  });

  document.querySelector('#financial-form-tipo')?.addEventListener('change', (event) => {
    state.financialForm.tipo = event.target.value;
  });
  document.querySelector('#financial-form-descricao')?.addEventListener('input', (event) => {
    state.financialForm.descricao = event.target.value;
  });
  document.querySelector('#financial-form-cliente')?.addEventListener('input', (event) => {
    state.financialForm.cliente_fornecedor = event.target.value;
  });
  document.querySelector('#financial-form-valor')?.addEventListener('input', (event) => {
    state.financialForm.valor = event.target.value;
  });
  document.querySelector('#financial-form-vencimento')?.addEventListener('input', (event) => {
    state.financialForm.vencimento = event.target.value;
    if (event.target.value && !state.financialForm.competencia) state.financialForm.competencia = event.target.value.slice(0,7);
  });
  document.querySelector('#financial-form-competencia')?.addEventListener('input', (event) => {
    state.financialForm.competencia = event.target.value;
  });

  document.querySelector('#financial-filter-tipo')?.addEventListener('change', (event) => {
    state.financialFilters.tipo = event.target.value;
    renderApp();
  });
  document.querySelector('#financial-filter-status')?.addEventListener('change', (event) => {
    state.financialFilters.status = event.target.value;
    renderApp();
  });
  document.querySelector('#financial-filter-competencia')?.addEventListener('input', (event) => {
    state.financialFilters.competencia = event.target.value;
    renderApp();
  });
  document.querySelector('#financial-filter-busca')?.addEventListener('input', (event) => {
    state.financialFilters.busca = event.target.value;
    renderApp();
  });

  document.querySelectorAll('[data-financial-status]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateFinancialEntryStatus(button.dataset.financialId, button.dataset.financialStatus);
    });
  });

  document.querySelectorAll('[data-financial-conciliate]').forEach((button) => {
    button.addEventListener('click', async () => {
      await toggleFinancialConciliation(button.dataset.financialConciliate);
    });
  });

  document.querySelector('#governance-note-text')?.addEventListener('input', (event) => {
    state.governanceNoteDraft = event.target.value;
  });

  document.querySelector('#save-governance-note-btn')?.addEventListener('click', async () => {
    await saveGovernanceNote();
  });

  document.querySelector('#governance-open-review-btn')?.addEventListener('click', async () => {
    await updateGovernanceStatus('em_revisao');
  });

  document.querySelector('#governance-reopen-btn')?.addEventListener('click', async () => {
    await updateGovernanceStatus('aberto');
  });

  document.querySelector('#governance-close-btn')?.addEventListener('click', async () => {
    await closeGovernancePeriod();
  });


  document.querySelector('#inconsistency-status-filter')?.addEventListener('change', (event) => {
    state.inconsistencyFilters.status = event.target.value;
    renderApp();
  });

  document.querySelector('#inconsistency-severity-filter')?.addEventListener('change', (event) => {
    state.inconsistencyFilters.severidade = event.target.value;
    renderApp();
  });

  document.querySelector('#inconsistency-module-filter')?.addEventListener('change', (event) => {
    state.inconsistencyFilters.modulo = event.target.value;
    renderApp();
  });

  document.querySelector('#clear-dashboard-severity')?.addEventListener('click', () => {
    state.selectedDashboardSeverity = '';
    state.inconsistencyFilters.severidade = 'todas';
    renderApp();
  });

  document.querySelector('#inconsistency-search')?.addEventListener('input', (event) => {
    state.inconsistencyFilters.busca = event.target.value;
    renderApp();
  });

  document.querySelectorAll('[data-open-inconsistency]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedInconsistencyId = button.dataset.openInconsistency;
      state.newInconsistencyComment = '';
      renderApp();
      loadInconsistencyDetail(button.dataset.openInconsistency);
    });
  });

  document.querySelector('#close-inconsistency-btn')?.addEventListener('click', () => {
    state.selectedInconsistencyId = null;
    state.inconsistencyHistory = [];
    state.inconsistencyComments = [];
    state.newInconsistencyComment = '';
    renderApp();
  });

  document.querySelector('#inconsistency-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'inconsistency-backdrop') {
      state.selectedInconsistencyId = null;
      state.inconsistencyHistory = [];
      state.inconsistencyComments = [];
      state.newInconsistencyComment = '';
      renderApp();
    }
  });

  document.querySelectorAll('[data-mark-inconsistency-analysis]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateInconsistency(button.dataset.markInconsistencyAnalysis, 'em_analise', 'Ocorrência em análise pela equipe.');
    });
  });

  document.querySelectorAll('[data-resolve-inconsistency]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateInconsistency(button.dataset.resolveInconsistency, 'resolvida', 'Inconsistência tratada e validada.');
    });
  });

  document.querySelectorAll('[data-ignore-inconsistency]').forEach((button) => {
    button.addEventListener('click', async () => {
      const reason = window.prompt('Informe a justificativa para ignorar esta inconsistência:');
      if (!reason || !reason.trim()) {
        window.alert('A justificativa é obrigatória para ignorar uma inconsistência.');
        return;
      }
      await updateInconsistency(button.dataset.ignoreInconsistency, 'ignorada', reason.trim());
    });
  });

  document.querySelector('#inconsistency-comment-text')?.addEventListener('input', (event) => {
    state.newInconsistencyComment = event.target.value;
  });

  document.querySelector('#save-inconsistency-comment')?.addEventListener('click', async (event) => {
    await saveInconsistencyComment(event.target.dataset.inconsistencyCommentId);
  });

  const dropzone = document.querySelector('#dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach((name) => {
      dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
      });
    });

    ['dragleave', 'drop'].forEach((name) => {
      dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragging');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      handleFiles(event.dataTransfer?.files);
    });
  }
}

function validFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return FILE_TYPES.includes(file.type) || FILE_EXTENSIONS.includes(ext);
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  const accepted = files.filter(validFile);
  const rejected = files.length - accepted.length;

  accepted.forEach((file) => {
    const preview = inferCategory(file);
    state.uploadQueue.push({
      file,
      preview,
      statusLabel: 'Pronto para envio',
      statusTone: 'neutral',
    });
  });

  state.statusMessage = accepted.length
    ? `${accepted.length} arquivo(s) prontos para envio.${rejected ? ` ${rejected} ignorado(s) por formato inválido.` : ''}`
    : 'Nenhum arquivo válido foi identificado.';
  renderApp();
}

async function loadDocuments() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  state.loadingDocuments = true;
  renderApp();

  const { data, error } = await supabase
    .from('documentos')
    .select('*');

  state.loadingDocuments = false;

  if (error) {
    state.statusMessage = `Falha ao carregar documentos: ${error.message}`;
    renderApp();
    return;
  }

  state.documents = sortDocuments((data || []).map(normalizeDocumentRow));
  renderApp();
}

async function loadEvents() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('eventos')
    .select('id, nome_cliente, cliente, data_evento, unidade, valor_vendido, valor_a_receber, status')
    .order('data_evento', { ascending: true });

  if (!error) state.events = data || [];
}

async function uploadQueuedFiles() {
  if (!state.uploadQueue.length || state.uploading || !canUseSupabase()) return;

  const supabase = getSupabase();
  state.uploading = true;
  state.statusMessage = 'Enviando documentos para a base...';
  renderApp();

  const insertedDocuments = [];

  for (const item of state.uploadQueue) {
    item.statusLabel = 'Enviando';
    item.statusTone = 'warn';
    renderApp();

    const ext = item.file.name.split('.').pop()?.toLowerCase() || '';
    const preview = item.preview;
    const storagePath = `${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}/${Date.now()}-${sanitizeFileName(item.file.name)}`;

    const { error: uploadError } = await supabase
      .storage
      .from(env.storageBucket)
      .upload(storagePath, item.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: item.file.type || undefined,
      });

    if (uploadError) {
      item.statusLabel = 'Erro no envio';
      item.statusTone = 'danger';
      state.statusMessage = `Falha no upload: ${uploadError.message}`;
      renderApp();
      continue;
    }

    const { data: publicData } = supabase.storage.from(env.storageBucket).getPublicUrl(storagePath);

    const { data: insertedRow, error: insertError } = await insertDocumentRecord(
      supabase,
      item.file,
      preview,
      storagePath,
      publicData.publicUrl,
      ext,
    );

    if (insertError) {
      item.statusLabel = 'Erro de registro';
      item.statusTone = 'danger';
      state.statusMessage = `Upload concluído, mas o registro falhou: ${insertError.message}`;
      renderApp();
      continue;
    }

    insertedDocuments.unshift(insertedRow);
    state.documents = sortDocuments([...insertedDocuments, ...state.documents.filter((doc) => doc.id !== insertedRow.id)]);
    item.statusLabel = 'Enviado';
    item.statusTone = 'ok';
    state.statusMessage = `Documento ${item.file.name} registrado com sucesso.`;
    renderApp();
  }

  state.uploading = false;
  state.uploadQueue = [];
  state.statusMessage = insertedDocuments.length
    ? 'Documentos enviados para a base com sucesso.'
    : state.statusMessage;

  await Promise.all([loadDocuments(), loadEvents()]);
}

async function updateDocument(id, patch) {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const dbPatch = buildDocumentUpdatePatch(patch);
  const { error } = await supabase.from('documentos').update(dbPatch).eq('id', id);

  if (error) {
    state.statusMessage = `Falha na atualização: ${error.message}`;
    renderApp();
    return;
  }

  state.documents = state.documents.map((doc) => doc.id === id ? normalizeDocumentRow({ ...doc, ...dbPatch }) : doc);
  state.statusMessage = 'Documento atualizado com sucesso.';
  renderApp();
  await loadDocuments();
}




async function loadInconsistencyDetail(id) {
  if (!canUseSupabase() || !id) return;
  const supabase = getSupabase();
  state.loadingInconsistencyDetail = true;
  renderApp();

  let historyQuery = await supabase
    .from('inconsistencias_historico')
    .select('*')
    .eq('inconsistencia_id', id)
    .order('criado_em', { ascending: false });

  if (historyQuery.error) {
    historyQuery = await supabase
      .from('inconsistencias_historico')
      .select('*')
      .eq('inconsistencia_id', id)
      .order('alterado_em', { ascending: false });
  }

  let commentsQuery = await supabase
    .from('inconsistencias_comentarios')
    .select('*')
    .eq('inconsistencia_id', id)
    .order('criado_em', { ascending: false });

  if (commentsQuery.error) {
    commentsQuery = await supabase
      .from('inconsistencias_comentarios')
      .select('*')
      .eq('inconsistencia_id', id)
      .order('created_at', { ascending: false });
  }

  state.inconsistencyHistory = historyQuery.error ? [] : (historyQuery.data || []).map(normalizeHistoryRow);
  state.inconsistencyComments = commentsQuery.error ? [] : (commentsQuery.data || []).map(normalizeCommentRow);
  state.loadingInconsistencyDetail = false;
  renderApp();
}

async function saveHistoryRecord(inconsistenciaId, payload) {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  let result = await supabase.from('inconsistencias_historico').insert({
    inconsistencia_id: inconsistenciaId,
    ...payload,
    responsavel: payload.responsavel || currentUserName(),
  });

  if (result.error) {
    result = await supabase.from('inconsistencias_historico').insert({
      inconsistencia_id: inconsistenciaId,
      acao: payload.acao,
      status_anterior: payload.status_anterior,
      status_novo: payload.status_novo,
      observacao: payload.observacao,
      autor: payload.responsavel || currentUserName(),
    });
  }

  if (result.error) {
    appendLocalHistory(inconsistenciaId, payload);
    return;
  }

  if (String(state.selectedInconsistencyId) === String(inconsistenciaId)) {
    await loadInconsistencyDetail(inconsistenciaId);
  }
}

async function saveInconsistencyComment(id) {
  const comment = state.newInconsistencyComment.trim();
  if (!comment) {
    window.alert('Digite um comentário antes de salvar.');
    return;
  }
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const payload = {
    inconsistencia_id: id,
    comentario: comment,
    responsavel: currentUserName(),
  };

  let result = await supabase.from('inconsistencias_comentarios').insert(payload);
  if (result.error) {
    result = await supabase.from('inconsistencias_comentarios').insert({
      inconsistencia_id: id,
      comentario: comment,
      autor: currentUserName(),
    });
  }

  if (result.error) {
    appendLocalComment(id, comment);
    state.inconsistencyActionMessage = 'Comentário salvo localmente. Estrutura do banco ainda não aceitou a persistência completa.';
  } else {
    state.inconsistencyActionMessage = 'Comentário operacional salvo com sucesso.';
  }

  state.newInconsistencyComment = '';
  renderApp();
  if (String(state.selectedInconsistencyId) === String(id)) await loadInconsistencyDetail(id);
}

async function loadInconsistencies() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  state.loadingInconsistencies = true;
  renderApp();

  const { data, error } = await supabase
    .from('inconsistencias')
    .select('*')
    .order('criada_em', { ascending: false });

  state.loadingInconsistencies = false;

  if (error) {
    state.inconsistencyActionMessage = `Falha ao carregar inconsistências: ${error.message}`;
    renderApp();
    return;
  }

  state.inconsistencies = sortInconsistencies((data || []).map(normalizeInconsistencyRow));
  renderApp();
}

async function updateInconsistency(id, nextStatus, observation = '') {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const current = state.inconsistencies.find((item) => String(item.id) === String(id));

  const richPatch = {
    status: nextStatus,
    observacao: observation,
    responsavel: currentUserName(),
  };

  if (nextStatus === 'resolvida') richPatch.resolvida_em = now;
  if (nextStatus !== 'resolvida') richPatch.resolvida_em = null;

  let result = await supabase.from('inconsistencias').update(richPatch).eq('id', id);

  if (result.error && /column/i.test(result.error.message || '')) {
    const fallbackPatch = { status: nextStatus };
    result = await supabase.from('inconsistencias').update(fallbackPatch).eq('id', id);
  }

  if (result.error) {
    state.inconsistencyActionMessage = `Falha na atualização da inconsistência: ${result.error.message}`;
    renderApp();
    return;
  }

  state.inconsistencies = state.inconsistencies.map((item) => {
    if (String(item.id) !== String(id)) return item;
    return normalizeInconsistencyRow({
      ...item,
      status: nextStatus,
      observacao: observation || item.observacao,
      responsavel: currentUserName(),
      resolvida_em: nextStatus === 'resolvida' ? now : null,
    });
  });

  await saveHistoryRecord(id, {
    acao: nextStatus === 'ignorada' ? 'ignorada' : nextStatus === 'resolvida' ? 'resolvida' : 'em_analise',
    status_anterior: current?.status || '',
    status_novo: nextStatus,
    observacao: observation,
    responsavel: currentUserName(),
  });

  state.inconsistencyActionMessage = `Inconsistência atualizada para ${nextStatus.replaceAll('_', ' ')}.`;
  renderApp();
  await loadInconsistencies();
  if (String(state.selectedInconsistencyId) === String(id)) await loadInconsistencyDetail(id);
}

async function loadGovernance() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  state.loadingGovernance = true;
  renderApp();

  const periodo = currentPeriodKey();
  let query = await supabase
    .from('fechamentos_mensais')
    .select('*')
    .eq('periodo', periodo)
    .maybeSingle();

  state.loadingGovernance = false;

  if (query.error) {
    state.governance = normalizeGovernanceRow({
      periodo,
      status: 'aberto',
      bloqueado_por_inconsistencias: getGovernanceMetrics().blockers > 0,
      bloqueios_total: getGovernanceMetrics().blockers,
      observacao: state.governance.observacao || '',
    });
    state.governanceMessage = `Tabela de governança ainda não disponível no banco: ${query.error.message}`;
    renderApp();
    return;
  }

  state.governance = normalizeGovernanceRow(query.data || { periodo, status: 'aberto' });
  state.governance.bloqueado_por_inconsistencias = getGovernanceMetrics().blockers > 0;
  state.governance.bloqueios_total = getGovernanceMetrics().blockers;
  state.governanceNoteDraft = state.governance.observacao || '';
  state.governanceMessage = state.governance.bloqueado_por_inconsistencias ? 'Existem bloqueios críticos abertos para o período atual.' : 'Governança carregada com sucesso.';
  renderApp();
}

async function persistGovernance(extraPatch = {}) {
  if (!canUseSupabase()) return { ok: false, error: 'Sem conexão' };
  const supabase = getSupabase();
  const metrics = getGovernanceMetrics();
  const payload = {
    periodo: state.governance.periodo || currentPeriodKey(),
    status: state.governance.status || 'aberto',
    bloqueado_por_inconsistencias: metrics.blockers > 0,
    bloqueios_total: metrics.blockers,
    responsavel: currentUserName(),
    observacao: state.governance.observacao || '',
    ...extraPatch,
  };

  let result = await supabase.from('fechamentos_mensais').upsert(payload, { onConflict: 'periodo' }).select('*').single();
  if (result.error) {
    state.governance = normalizeGovernanceRow(payload);
    state.governanceMessage = `Governança salva apenas localmente: ${result.error.message}`;
    renderApp();
    return { ok: false, error: result.error.message };
  }

  state.governance = normalizeGovernanceRow(result.data);
  state.governanceNoteDraft = state.governance.observacao || '';
  renderApp();
  return { ok: true };
}

async function saveGovernanceNote() {
  state.governance.observacao = (state.governanceNoteDraft || '').trim();
  const result = await persistGovernance({ observacao: state.governance.observacao });
  state.governanceMessage = result.ok ? 'Observação de governança salva com sucesso.' : state.governanceMessage;
  renderApp();
}

async function updateGovernanceStatus(nextStatus) {
  state.governance.status = nextStatus;
  const result = await persistGovernance({ status: nextStatus, fechado_em: nextStatus === 'fechado' ? new Date().toISOString() : null });
  state.governanceMessage = result.ok ? `Período atualizado para ${nextStatus.replaceAll('_', ' ')}.` : state.governanceMessage;
  renderApp();
}

async function closeGovernancePeriod() {
  const metrics = getGovernanceMetrics();
  if (metrics.blockers > 0) {
    state.governanceMessage = 'Não é possível fechar o período com inconsistências críticas abertas.';
    setView('governance', { load: false });
    return;
  }
  state.governance.status = 'fechado';
  const result = await persistGovernance({ status: 'fechado', fechado_em: new Date().toISOString() });
  state.governanceMessage = result.ok ? 'Período fechado com sucesso.' : state.governanceMessage;
  renderApp();
}

async function loadFinancialEntries() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  state.loadingFinancialEntries = true;
  renderApp();
  const { data, error } = await supabase
    .from('financeiro_lancamentos')
    .select('*')
    .order('vencimento', { ascending: true })
    .order('criado_em', { ascending: false });
  state.loadingFinancialEntries = false;
  if (error) {
    state.financialMessage = `Falha ao carregar financeiro: ${error.message}`;
    renderApp();
    return;
  }
  const today = new Date().toISOString().slice(0,10);
  state.financialEntries = (data || []).map(normalizeFinancialRow).map((item) => {
    if (item.status === 'pendente' && item.vencimento && item.vencimento < today) {
      return { ...item, status: 'vencido' };
    }
    return item;
  });
  state.financialMessage = 'Financeiro carregado com sucesso.';
  renderApp();
}

async function persistFinancialEntry(payload) {
  if (!canUseSupabase()) return { error: { message: 'Sem conexão com o Supabase.' } };
  const supabase = getSupabase();
  return supabase.from('financeiro_lancamentos').insert(payload).select('*').single();
}

async function createFinancialEntryFromForm() {
  const form = state.financialForm;
  const valor = Number(form.valor || 0);
  if (!form.descricao.trim()) {
    window.alert('Informe a descrição do lançamento.');
    return;
  }
  if (!(valor > 0)) {
    window.alert('Informe um valor válido para o lançamento.');
    return;
  }
  const payload = {
    tipo: form.tipo,
    descricao: form.descricao.trim(),
    cliente_fornecedor: form.cliente_fornecedor.trim(),
    valor,
    vencimento: form.vencimento || null,
    competencia: form.competencia || (form.vencimento ? form.vencimento.slice(0,7) : currentPeriodKey()),
    status: 'pendente',
    conciliado: false,
    origem_tipo: 'manual',
    observacao: 'Lançamento criado manualmente pela operação.',
  };
  const { data, error } = await persistFinancialEntry(payload);
  if (error) {
    state.financialMessage = `Falha ao salvar lançamento: ${error.message}`;
    renderApp();
    return;
  }
  state.financialEntries = [normalizeFinancialRow(data), ...state.financialEntries];
  state.financialForm = {
    tipo: form.tipo,
    descricao: '',
    cliente_fornecedor: '',
    valor: '',
    vencimento: '',
    competencia: currentPeriodKey(),
    status: 'pendente',
  };
  state.financialMessage = 'Lançamento financeiro salvo com sucesso.';
  renderApp();
}

async function updateFinancialEntryStatus(id, nextStatus) {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const patch = {
    status: nextStatus,
    pago_recebido_em: nextStatus === 'pago' || nextStatus === 'recebido' ? new Date().toISOString() : null,
    conciliado: nextStatus === 'pendente' ? false : undefined,
    conciliado_em: nextStatus === 'pendente' ? null : undefined,
  };
  Object.keys(patch).forEach((k)=>patch[k]===undefined && delete patch[k]);
  const { error } = await supabase.from('financeiro_lancamentos').update(patch).eq('id', id);
  if (error) {
    state.financialMessage = `Falha ao atualizar lançamento: ${error.message}`;
    renderApp();
    return;
  }
  state.financialEntries = state.financialEntries.map((item) => String(item.id) === String(id) ? normalizeFinancialRow({ ...item, ...patch }) : item);
  state.financialMessage = `Lançamento atualizado para ${nextStatus}.`;
  renderApp();
}

async function toggleFinancialConciliation(id) {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const current = state.financialEntries.find((item) => String(item.id) === String(id));
  if (!current) return;
  const nextConciliado = !current.conciliado;
  const patch = {
    conciliado: nextConciliado,
    conciliado_em: nextConciliado ? new Date().toISOString() : null,
    status: nextConciliado ? 'conciliado' : (current.tipo === 'pagar' ? 'pago' : 'recebido'),
  };
  const { error } = await supabase.from('financeiro_lancamentos').update(patch).eq('id', id);
  if (error) {
    state.financialMessage = `Falha na conciliação: ${error.message}`;
    renderApp();
    return;
  }
  state.financialEntries = state.financialEntries.map((item) => String(item.id) === String(id) ? normalizeFinancialRow({ ...item, ...patch }) : item);
  state.financialMessage = nextConciliado ? 'Lançamento conciliado com sucesso.' : 'Conciliação reaberta com sucesso.';
  renderApp();
}

async function generateReceivablesFromEvents() {
  if (!canUseSupabase()) return;
  if (!state.events.length) await loadEvents();
  const supabase = getSupabase();
  const candidates = state.events.map(buildReceivableFromEvent).filter(Boolean);
  if (!candidates.length) {
    state.financialMessage = 'Nenhum evento com saldo a receber disponível para gerar contas.';
    renderApp();
    return;
  }
  const existingIds = new Set(state.financialEntries.filter((item) => item.origem_tipo === 'evento' && item.origem_id).map((item) => String(item.origem_id)));
  const newRows = candidates.filter((item) => !existingIds.has(String(item.origem_id)));
  if (!newRows.length) {
    state.financialMessage = 'As contas a receber dos eventos já foram geradas anteriormente.';
    renderApp();
    return;
  }
  const { data, error } = await supabase.from('financeiro_lancamentos').insert(newRows).select('*');
  if (error) {
    state.financialMessage = `Falha ao gerar contas a receber: ${error.message}`;
    renderApp();
    return;
  }
  state.financialEntries = [...(data || []).map(normalizeFinancialRow), ...state.financialEntries];
  state.financialMessage = `${newRows.length} conta(s) a receber gerada(s) a partir dos eventos.`;
  renderApp();
}

async function loadDreSupportData() {
  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  state.loadingDreData = true;
  renderApp();

  const [costsRes, fixedRes, investmentsRes] = await Promise.all([
    supabase.from('custos_evento').select('evento_id, valor_real, data_lancamento, categoria'),
    supabase.from('despesas_fixas').select('*'),
    supabase.from('investimentos').select('*'),
  ]);

  state.loadingDreData = false;
  state.dreCosts = costsRes.error ? [] : (costsRes.data || []);
  state.dreFixedExpenses = fixedRes.error ? [] : (fixedRes.data || []);
  state.dreInvestments = investmentsRes.error ? [] : (investmentsRes.data || []);

  const messages = [];
  if (costsRes.error) messages.push('custos_evento em fallback local');
  if (fixedRes.error) messages.push('despesas_fixas em fallback local');
  if (investmentsRes.error) messages.push('investimentos em fallback local');
  state.dreMessage = messages.length ? `DRE carregado com fallback: ${messages.join(' • ')}.` : 'DRE carregado com base real do Supabase.';
  renderApp();
}

async function hydrateView(view) {
  if (!canUseSupabase() || !state.auth.session) return;
  if (view === 'dashboard') {
    await Promise.all([loadEvents(), loadDocuments(), loadInconsistencies(), loadGovernance(), loadFinancialEntries(), loadDreSupportData()]);
    return;
  }
  if (view === 'events') await loadEvents();
  if (view === 'documents') await Promise.all([loadDocuments(), loadEvents()]);
  if (view === 'inconsistencies') await loadInconsistencies();
  if (view === 'governance') await loadGovernance();
  if (view === 'finance') await loadFinancialEntries();
  if (view === 'dre') await loadDreSupportData();
}

async function signInWithAppUser() {
  if (!canUseSupabase()) {
    state.auth.message = 'Supabase não configurado para login.';
    renderLogin();
    return;
  }
  const email = document.getElementById('login-email')?.value?.trim().toLowerCase() || '';
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) {
    state.auth.message = 'Informe e-mail e senha.';
    renderLogin();
    return;
  }

  state.auth.submitting = true;
  state.auth.message = '';
  renderLogin();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_usuarios')
    .select('id,nome,email,perfil,status,senha_hash')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    state.auth.submitting = false;
    state.auth.message = `Falha ao validar login: ${error.message}`;
    renderLogin();
    return;
  }

  if (!data) {
    state.auth.submitting = false;
    state.auth.message = 'Usuário não encontrado.';
    renderLogin();
    return;
  }

  if ((data.status || 'ativo') !== 'ativo') {
    state.auth.submitting = false;
    state.auth.message = 'Usuário inativo.';
    renderLogin();
    return;
  }

  const passwordHash = await hashPassword(password);
  if (String(passwordHash) !== String(data.senha_hash || '')) {
    state.auth.submitting = false;
    state.auth.message = 'Senha inválida.';
    renderLogin();
    return;
  }

  state.auth.session = {
    id: data.id,
    nome: data.nome || data.email,
    email: data.email,
    perfil: data.perfil || 'operacao',
    login_em: new Date().toISOString(),
  };
  saveStoredSession(state.auth.session);
  state.auth.submitting = false;
  state.auth.message = '';
  await hydrateView(state.view);
  renderApp();
}

async function boot() {
  window.addEventListener('hashchange', () => {
    const next = getInitialView();
    if (next !== state.view) {
      setView(next);
    }
  });

  if (state.auth.session) {
    await hydrateView(state.view);
  }

  renderApp();
}

boot();
