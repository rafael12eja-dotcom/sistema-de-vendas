
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
        </nav>
      </aside>
      <main class="main-content">
        ${state.view === 'dashboard' ? renderDashboard() : ''}
        ${state.view === 'events' ? renderEvents() : ''}
        ${state.view === 'documents' ? renderDocuments() : ''}
      </main>
    </div>
    ${renderPreviewModal()}
  `;

  bindGlobalActions();
}

function bindGlobalActions() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderApp();
      if (state.view === 'documents' && canUseSupabase()) {
        loadDocuments();
        loadEvents();
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


  if (!canUseSupabase()) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('documentos').update(patch).eq('id', id);
  state.statusMessage = error ? `Falha na atualização: ${error.message}` : 'Documento atualizado com sucesso.';
  await loadDocuments();
}

async function boot() {
  if (canUseSupabase()) {
    await Promise.all([loadDocuments(), loadEvents()]);
  }
  renderApp();
}

boot();
