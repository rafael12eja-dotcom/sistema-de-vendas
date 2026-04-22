
import { appData } from './data/appData.js';
import { env } from './env.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx'];

const state = {
  view: 'dashboard',
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

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    inconsistencia_id: row.inconsistencia_id,
    acao: row.acao || row.tipo_acao || 'atualizacao',
    status_anterior: row.status_anterior || '',
    status_novo: row.status_novo || '',
    observacao: row.observacao || row.descricao || '',
    responsavel: row.responsavel || row.autor || 'Operação Home Fest',
    criado_em: row.criado_em || row.alterado_em || row.created_at || null,
  };
}

function normalizeCommentRow(row) {
  return {
    id: row.id,
    inconsistencia_id: row.inconsistencia_id,
    comentario: row.comentario || row.texto || '',
    responsavel: row.responsavel || row.autor || 'Operação Home Fest',
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
    responsavel: 'Operação Home Fest',
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
  return `
    <section class="hero-card">
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
      <button class="alert-chip critical" data-dashboard-filter-severity="critica">Críticas <strong>${state.inconsistencies.filter((item) => item.severidade === 'critica' && item.status !== 'resolvida').length}</strong></button>
      <button class="alert-chip high" data-dashboard-filter-severity="alta">Altas <strong>${state.inconsistencies.filter((item) => item.severidade === 'alta' && item.status !== 'resolvida').length}</strong></button>
      <button class="alert-chip medium" data-dashboard-filter-severity="media">Médias <strong>${state.inconsistencies.filter((item) => item.severidade === 'media' && item.status !== 'resolvida').length}</strong></button>
      <button class="alert-chip neutral" data-dashboard-go-inconsistencies>Ver central completa</button>
    </section>

    <section class="panel-grid">
      <article class="panel">
        <div class="panel-title">Alertas de consistência</div>
        <ul class="alert-list">
          <li>${badge(`${inc.eventosSemCustoReal.length} evento(s) sem custo real`, inc.eventosSemCustoReal.length ? 'warn' : 'ok')} ${inc.eventosSemCustoReal.join(', ') || 'Nenhum'}</li>
          <li>${badge(`${inc.investimentosSemValor.length} investimento(s) sem valor`, inc.investimentosSemValor.length ? 'warn' : 'ok')} ${inc.investimentosSemValor.slice(0,6).join(', ') || 'Nenhum'}</li>
          <li>${badge(`${inc.eventosSemRecebimentoInformado.length} evento(s) sem caixa informado`, inc.eventosSemRecebimentoInformado.length ? 'warn' : 'ok')} ${inc.eventosSemRecebimentoInformado.join(', ') || 'Nenhum'}</li>
        </ul>
      </article>
      <article class="panel">
        <div class="panel-title">Prontidão documental</div>
        <div class="kv-list">
          <div class="kv-row"><span>Upload múltiplo</span><strong>Ativo</strong></div>
          <div class="kv-row"><span>Storage Supabase</span><strong>${connected ? 'Pronto para teste' : 'Aguardando chaves'}</strong></div>
          <div class="kv-row"><span>Estados do documento</span><strong>Extraído • Sugerido • Confirmado</strong></div>
          <div class="kv-row"><span>Lançamento automático</span><strong class="negative">Bloqueado</strong></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-title">Motor de inconsistências</div>
        <div class="kv-list">
          <div class="kv-row"><span>Total rastreado</span><strong>${state.inconsistencies.length}</strong></div>
          <div class="kv-row"><span>Abertas</span><strong class="negative">${state.inconsistencies.filter((item) => item.status === 'aberta').length}</strong></div>
          <div class="kv-row"><span>Em análise</span><strong>${state.inconsistencies.filter((item) => item.status === 'em_analise').length}</strong></div>
          <div class="kv-row"><span>Resolvidas</span><strong class="positive">${state.inconsistencies.filter((item) => item.status === 'resolvida').length}</strong></div>
        </div>
      </article>
    </section>
  `;
}

function renderConnectionWarning() {
  if (canUseSupabase()) return '';
  return `
    <section class="panel panel-warning">
      <div class="panel-title">Conectar sistema ao Supabase</div>
      <p class="panel-copy">Para ativar documentos reais, preencha as chaves no arquivo <code>src/env.js</code> para teste local ou nas variáveis do Cloudflare Pages para produção.</p>
      <div class="code-box">VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY<br/>VITE_SUPABASE_STORAGE_BUCKET=documentos-homefest</div>
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
          <div class="timeline-meta">${escapeHtml(entry.responsavel || 'Operação Home Fest')} • ${escapeHtml(entry.acao.replaceAll('_', ' '))}</div>
          ${entry.observacao ? `<div class="timeline-note">${escapeHtml(entry.observacao)}</div>` : ''}
        </div>
      `).join('')
    : '<div class="empty-state compact">Nenhum histórico detalhado encontrado para esta inconsistência.</div>';

  const commentsHtml = state.inconsistencyComments.length
    ? state.inconsistencyComments.map((entry) => `
        <div class="comment-item">
          <div class="timeline-head">
            <strong>${escapeHtml(entry.responsavel || 'Operação Home Fest')}</strong>
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

function renderApp() {
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
        <nav class="nav">
          ${navItem('dashboard', 'Dashboard')}
          ${navItem('events', 'Eventos')}
          ${navItem('documents', 'Documentos')}
          ${navItem('inconsistencies', `Inconsistências${state.inconsistencies.filter((item) => item.status === 'aberta').length ? ` (${state.inconsistencies.filter((item) => item.status === 'aberta').length})` : ''}`)}
        </nav>
      </aside>
      <main class="main-content">
        ${state.view === 'dashboard' ? renderDashboard() : ''}
        ${state.view === 'events' ? renderEvents() : ''}
        ${state.view === 'documents' ? renderDocuments() : ''}
        ${state.view === 'inconsistencies' ? renderInconsistencies() : ''}
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
      state.view = 'inconsistencies';
      state.selectedDashboardSeverity = button.dataset.dashboardFilterSeverity;
      state.inconsistencyFilters.severidade = button.dataset.dashboardFilterSeverity;
      renderApp();
      if (canUseSupabase()) loadInconsistencies();
    });
  });

  document.querySelectorAll('[data-dashboard-go-inconsistencies]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = 'inconsistencies';
      renderApp();
      if (canUseSupabase()) loadInconsistencies();
    });
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderApp();
      if (state.view === 'documents' && canUseSupabase()) {
        loadDocuments();
        loadEvents();
      }
      if (state.view === 'inconsistencies' && canUseSupabase()) {
        loadInconsistencies();
      }
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
    .select('id, nome_cliente, cliente, data_evento, unidade, valor_vendido, status')
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
    responsavel: payload.responsavel || 'Operação Home Fest',
  });

  if (result.error) {
    result = await supabase.from('inconsistencias_historico').insert({
      inconsistencia_id: inconsistenciaId,
      acao: payload.acao,
      status_anterior: payload.status_anterior,
      status_novo: payload.status_novo,
      observacao: payload.observacao,
      autor: payload.responsavel || 'Operação Home Fest',
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
    responsavel: 'Operação Home Fest',
  };

  let result = await supabase.from('inconsistencias_comentarios').insert(payload);
  if (result.error) {
    result = await supabase.from('inconsistencias_comentarios').insert({
      inconsistencia_id: id,
      comentario: comment,
      autor: 'Operação Home Fest',
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
    responsavel: 'Operação Home Fest',
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
      responsavel: 'Operação Home Fest',
      resolvida_em: nextStatus === 'resolvida' ? now : null,
    });
  });

  await saveHistoryRecord(id, {
    acao: nextStatus === 'ignorada' ? 'ignorada' : nextStatus === 'resolvida' ? 'resolvida' : 'em_analise',
    status_anterior: current?.status || '',
    status_novo: nextStatus,
    observacao: observation,
    responsavel: 'Operação Home Fest',
  });

  state.inconsistencyActionMessage = `Inconsistência atualizada para ${nextStatus.replaceAll('_', ' ')}.`;
  renderApp();
  await loadInconsistencies();
  if (String(state.selectedInconsistencyId) === String(id)) await loadInconsistencyDetail(id);
}

async function boot() {
  if (canUseSupabase()) {
    await Promise.all([loadDocuments(), loadEvents(), loadInconsistencies()]);
  }
  renderApp();
}

boot();
