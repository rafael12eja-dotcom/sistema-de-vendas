
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value) => new Date(value + 'T00:00:00').toLocaleDateString('pt-BR');
const sum = (list, key) => list.reduce((acc, item) => acc + (item[key] || 0), 0);

const db = {
  unidadesNegocio: [
    { id: 'infantil', nome: 'Infantil' },
    { id: 'adulto', nome: 'Adulto' },
    { id: 'bbq-fire', nome: 'BBQ / Fire' }
  ],
  perfis: [
    { id: 'admin', nome: 'Admin' },
    { id: 'financeiro', nome: 'Financeiro' },
    { id: 'operacional', nome: 'Operacional' }
  ],
  usuarios: [
    { nome: 'Diretoria Home Fest', email: 'diretoria@homefest.com', perfil: 'Admin', status: 'Ativo' },
    { nome: 'Financeiro Central', email: 'financeiro@homefest.com', perfil: 'Financeiro', status: 'Ativo' },
    { nome: 'Operação Infantil', email: 'operacao.infantil@homefest.com', perfil: 'Operacional', status: 'Ativo' }
  ],
  eventos: [
    { codigo: 'HF-2601', cliente: 'Família Almeida', data: '2026-04-20', unidade: 'Infantil', status: 'Confirmado', valorVendido: 12800, valorRecebido: 8400, formaPagamento: 'PIX + Cartão' },
    { codigo: 'HF-2602', cliente: 'Brasa Prime', data: '2026-04-24', unidade: 'BBQ / Fire', status: 'Confirmado', valorVendido: 18900, valorRecebido: 18900, formaPagamento: 'Transferência' },
    { codigo: 'HF-2603', cliente: 'Marina Costa', data: '2026-04-27', unidade: 'Adulto', status: 'Sinal recebido', valorVendido: 15400, valorRecebido: 6000, formaPagamento: 'PIX + Boleto' }
  ],
  custosEvento: [
    { eventoCodigo: 'HF-2601', categoria: 'Equipe operacional', previsto: 3400, realizado: 3600, data: '2026-04-19', status: 'Realizado' },
    { eventoCodigo: 'HF-2601', categoria: 'Alimentos e bebidas', previsto: 2900, realizado: 3010, data: '2026-04-20', status: 'Realizado' },
    { eventoCodigo: 'HF-2602', categoria: 'Produção', previsto: 1800, realizado: 1760, data: '2026-04-23', status: 'Realizado' },
    { eventoCodigo: 'HF-2602', categoria: 'Logística e transporte', previsto: 780, realizado: 920, data: '2026-04-24', status: 'Realizado' },
    { eventoCodigo: 'HF-2603', categoria: 'Equipe operacional', previsto: 3200, realizado: 0, data: '2026-04-26', status: 'Previsto' },
    { eventoCodigo: 'HF-2603', categoria: 'Descartáveis e apoio', previsto: 540, realizado: 0, data: '2026-04-26', status: 'Previsto' }
  ],
  despesasFixas: [
    { competencia: '2026-04', categoria: 'Aluguel base', previsto: 3500, realizado: 3500, status: 'Pago' },
    { competencia: '2026-04', categoria: 'Folha administrativa', previsto: 6200, realizado: 6200, status: 'Pago' },
    { competencia: '2026-04', categoria: 'Internet, energia e ferramentas', previsto: 1480, realizado: 1480, status: 'Pago' }
  ],
  investimentos: [
    { data: '2026-04-10', categoria: 'Equipamento', descricao: 'Nova chopeira e acessórios BBQ', valor: 4200, status: 'Pago' },
    { data: '2026-04-15', categoria: 'Estrutura digital', descricao: 'Implantação do sistema financeiro', valor: 1900, status: 'Pago' }
  ]
};

const schema = {
  eventos: {
    title: 'events',
    kind: 'núcleo operacional',
    description: 'Origem da receita, da agenda financeira e da apuração de resultado por evento.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador técnico único do evento.' },
      { name: 'codigo', type: 'text', required: true, description: 'Código operacional único. Ex.: HF-2601.' },
      { name: 'cliente_nome', type: 'text', required: true, description: 'Nome do cliente responsável pela contratação.' },
      { name: 'data_evento', type: 'date', required: true, description: 'Data oficial do evento.' },
      { name: 'unidade_negocio_id', type: 'uuid', required: true, description: 'Relaciona o evento a Infantil, Adulto ou BBQ / Fire.' },
      { name: 'status', type: 'enum', required: true, description: 'Situação operacional e financeira do evento.' },
      { name: 'valor_vendido', type: 'numeric(12,2)', required: true, description: 'Valor total vendido do evento.' },
      { name: 'valor_recebido', type: 'numeric(12,2)', required: true, description: 'Total já recebido até o momento.' },
      { name: 'forma_pagamento', type: 'text', required: false, description: 'Resumo da combinação de pagamento acordada.' },
      { name: 'observacoes', type: 'text', required: false, description: 'Notas internas e operacionais.' }
    ],
    rules: [
      'codigo deve ser único.',
      'valor_recebido nunca pode ser maior que valor_vendido.',
      'valor_vendido deve ser maior que zero.',
      'unidade_negocio_id é obrigatório.'
    ],
    relations: [
      '1 evento possui muitos custos_evento.',
      '1 evento possui agenda financeira em contas a receber.',
      '1 evento pertence a 1 unidade de negócio.'
    ]
  },
  custosEvento: {
    title: 'event_costs',
    kind: 'núcleo operacional',
    description: 'Todos os custos diretos da execução. Não existe custo de evento sem evento vinculado.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador técnico do custo.' },
      { name: 'evento_id', type: 'uuid', required: true, description: 'Evento obrigatório que gerou o custo.' },
      { name: 'categoria', type: 'text', required: true, description: 'Categoria operacional do custo.' },
      { name: 'valor_previsto', type: 'numeric(12,2)', required: true, description: 'Valor previsto antes da execução.' },
      { name: 'valor_realizado', type: 'numeric(12,2)', required: true, description: 'Valor efetivamente realizado.' },
      { name: 'data_lancamento', type: 'date', required: true, description: 'Data de ocorrência ou lançamento.' },
      { name: 'status', type: 'enum', required: true, description: 'Previsto, realizado, cancelado.' },
      { name: 'responsavel_id', type: 'uuid', required: true, description: 'Usuário responsável pelo registro.' }
    ],
    rules: [
      'evento_id é obrigatório.',
      'valor_previsto e valor_realizado não podem ser negativos.',
      'status precisa ser consistente com valor_realizado.',
      'não pode ser salvo como custo se não houver evento.'
    ],
    relations: [
      'Muitos custos_evento pertencem a 1 evento.',
      'Muitos custos_evento podem ser lançados por 1 usuário.'
    ]
  },
  despesasFixas: {
    title: 'fixed_expenses',
    kind: 'núcleo financeiro',
    description: 'Estrutura mensal da empresa. Existe independentemente de ocorrer evento.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador da despesa fixa.' },
      { name: 'competencia', type: 'date', required: true, description: 'Mês de competência financeira.' },
      { name: 'categoria', type: 'text', required: true, description: 'Classificação da despesa fixa.' },
      { name: 'valor_previsto', type: 'numeric(12,2)', required: true, description: 'Valor orçado para o mês.' },
      { name: 'valor_realizado', type: 'numeric(12,2)', required: true, description: 'Valor efetivamente pago.' },
      { name: 'status', type: 'enum', required: true, description: 'Previsto, pago, vencido, cancelado.' },
      { name: 'recorrente', type: 'boolean', required: true, description: 'Marca se a despesa se repete mensalmente.' }
    ],
    rules: [
      'despesa fixa nunca pode ter evento_id.',
      'competência é obrigatória.',
      'status vencido exige valor_realizado igual a zero.',
      'valores não podem ser negativos.'
    ],
    relations: [
      'Despesas fixas impactam o resultado mensal da empresa.',
      'Podem ser agrupadas por competência e categoria.'
    ]
  },
  investimentos: {
    title: 'investments',
    kind: 'núcleo financeiro',
    description: 'Saídas que constroem estrutura, patrimônio ou capacidade operacional.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador do investimento.' },
      { name: 'categoria', type: 'text', required: true, description: 'Tipo estrutural do investimento.' },
      { name: 'descricao', type: 'text', required: true, description: 'Descrição clara do item investido.' },
      { name: 'data_investimento', type: 'date', required: true, description: 'Data da aquisição ou contratação.' },
      { name: 'valor', type: 'numeric(12,2)', required: true, description: 'Valor total do investimento.' },
      { name: 'forma_pagamento', type: 'text', required: false, description: 'Forma de pagamento utilizada.' },
      { name: 'parcelado', type: 'boolean', required: true, description: 'Indica se foi parcelado.' },
      { name: 'status', type: 'enum', required: true, description: 'Previsto, pago, parcial, cancelado.' }
    ],
    rules: [
      'investimento não pode ser classificado como custo.',
      'investimento não pode ser classificado como despesa fixa.',
      'valor precisa ser maior que zero.'
    ],
    relations: [
      'Investimentos alimentam o resultado real, separados do lucro operacional.'
    ]
  },
  financeiro: {
    title: 'receivables',
    kind: 'núcleo financeiro',
    description: 'Contas a receber e comportamento do dinheiro. Vender não é o mesmo que receber.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador do título financeiro.' },
      { name: 'evento_id', type: 'uuid', required: true, description: 'Evento que originou o recebível.' },
      { name: 'parcela', type: 'integer', required: true, description: 'Número da parcela.' },
      { name: 'valor_previsto', type: 'numeric(12,2)', required: true, description: 'Valor previsto da parcela.' },
      { name: 'valor_recebido', type: 'numeric(12,2)', required: true, description: 'Valor efetivamente recebido.' },
      { name: 'vencimento', type: 'date', required: true, description: 'Data esperada de entrada.' },
      { name: 'data_recebimento', type: 'date', required: false, description: 'Data em que o dinheiro entrou.' },
      { name: 'status', type: 'enum', required: true, description: 'A receber, parcial, recebido, vencido.' }
    ],
    rules: [
      'evento_id é obrigatório.',
      'valor_recebido nunca pode ser maior que valor_previsto.',
      'status recebido exige data_recebimento.',
      'status vencido exige saldo pendente.'
    ],
    relations: [
      'Muitos recebíveis pertencem a 1 evento.',
      'Financeiro consolida fluxo de entrada do sistema.'
    ]
  },
  usuarios: {
    title: 'users / profiles',
    kind: 'núcleo de segurança',
    description: 'Autenticação, perfis e rastreabilidade operacional do sistema.',
    fields: [
      { name: 'id', type: 'uuid', required: true, description: 'Identificador do usuário no sistema.' },
      { name: 'nome', type: 'text', required: true, description: 'Nome do colaborador.' },
      { name: 'email', type: 'text', required: true, description: 'Login do usuário.' },
      { name: 'perfil_id', type: 'uuid', required: true, description: 'Perfil de acesso aplicado.' },
      { name: 'ativo', type: 'boolean', required: true, description: 'Controle de acesso ativo/inativo.' },
      { name: 'ultimo_login', type: 'timestamp', required: false, description: 'Última autenticação registrada.' }
    ],
    rules: [
      'email deve ser único.',
      'todo usuário precisa de perfil.',
      'usuário inativo não acessa áreas protegidas.',
      'RLS deve filtrar dados por papel.'
    ],
    relations: [
      'Muitos usuários pertencem a 1 perfil.',
      'Usuários registram custos, despesas e ações auditáveis.'
    ]
  }
};

const meta = {
  titleMap: {
    dashboard: 'Dashboard Executivo',
    eventos: 'Eventos',
    custos: 'Custos de Evento',
    despesas: 'Despesas Fixas',
    investimentos: 'Investimentos',
    financeiro: 'Financeiro',
    usuarios: 'Usuários e Permissões',
    modelagem: 'Modelagem Funcional'
  },
  subtitleMap: {
    dashboard: 'Etapa 02 aplicada no projeto: visão executiva e reflexo da base funcional do sistema.',
    eventos: 'Eventos são a unidade financeira de resultado. Receita nasce aqui.',
    custos: 'Custos diretos da operação precisam existir sempre vinculados a um evento.',
    despesas: 'Despesas fixas representam a estrutura mensal da Home Fest.',
    investimentos: 'Investimentos constroem capacidade e nunca podem mascarar resultado operacional.',
    financeiro: 'Financeiro separa rigorosamente vendido, recebido e a receber.',
    usuarios: 'Perfis e acesso definem segurança, rastreabilidade e operação controlada.',
    modelagem: 'Base oficial da Etapa 02: entidades, campos obrigatórios, relações e validações.'
  }
};

const totalVendas = sum(db.eventos, 'valorVendido');
const totalRecebido = sum(db.eventos, 'valorRecebido');
const totalAReceber = totalVendas - totalRecebido;
const totalCustos = db.custosEvento.reduce((acc, item) => acc + (item.realizado || item.previsto || 0), 0);
const totalFixas = db.despesasFixas.reduce((acc, item) => acc + (item.realizado || item.previsto || 0), 0);
const totalInvest = sum(db.investimentos, 'valor');
const resultadoReal = totalVendas - totalCustos - totalFixas - totalInvest;

const app = document.getElementById('app');
const sidebarResult = document.getElementById('sidebar-result');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const navItems = Array.from(document.querySelectorAll('.nav-item'));

sidebarResult.textContent = currency.format(resultadoReal);

const state = {
  view: 'dashboard',
  entity: 'eventos'
};

function money(value){
  return currency.format(value || 0);
}

function getRecebiveis(){
  return db.eventos.map((evento) => ({
    codigo: evento.codigo,
    cliente: evento.cliente,
    vencimento: evento.data,
    previsto: evento.valorVendido,
    recebido: evento.valorRecebido,
    pendente: evento.valorVendido - evento.valorRecebido,
    status: evento.valorVendido - evento.valorRecebido === 0 ? 'Recebido' : evento.valorRecebido > 0 ? 'Parcial' : 'A receber'
  }));
}

function kpiCard(label, value, sub, cls = ''){
  return `
    <article class="metric-card ${cls ? `metric-${cls}` : ''}">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${money(value)}</div>
      <div class="metric-sub">${sub}</div>
    </article>
  `;
}

function renderDashboard(){
  const alerts = [
    { title: 'Evento com saldo pendente', copy: 'HF-2603 ainda possui recebimento parcial e precisa permanecer no radar do financeiro.', tone: 'yellow' },
    { title: 'Custo previsto sem realização', copy: 'HF-2603 ainda possui custos previstos sem baixa financeira realizada.', tone: 'gold' },
    { title: 'Regra central protegida', copy: 'Resultado real continua sendo calculado por vendas - custos - despesas fixas - investimentos.', tone: 'green' },
    { title: 'Base pronta para banco real', copy: 'Etapa 02 já consolidou entidades, relações, validações e núcleo da modelagem para Supabase.', tone: 'gold' }
  ];

  return `
    <div class="page-grid">
      <section class="hero">
        <div class="hero-card">
          <div class="eyebrow">ETAPA 02 APLICADA</div>
          <h2>Modelagem funcional embutida no projeto com leitura premium, operacional e financeira.</h2>
          <p>Agora o sistema já expõe os módulos oficiais, a separação correta entre vendido, recebido e a receber, além da estrutura que vai virar banco real: eventos, custos, despesas fixas, investimentos, financeiro e segurança.</p>
        </div>
        <div class="status-card">
          <div>
            <div class="status-label">Status atual</div>
            <div class="status-value">MVP+</div>
            <div class="status-sub">Base visual + modelagem funcional</div>
          </div>
          <div class="legend">
            <span class="badge gold">Home Fest premium</span>
            <span class="badge green">Resultado protegido</span>
          </div>
        </div>
      </section>

      <section class="kpis">
        ${kpiCard('Vendas', totalVendas, 'Valor vendido dos eventos')}
        ${kpiCard('Recebido', totalRecebido, 'Dinheiro já entrou')}
        ${kpiCard('A Receber', totalAReceber, 'Saldo pendente', totalAReceber > 0 ? 'warning' : 'positive')}
        ${kpiCard('Custos + Fixas + Invest.', totalCustos + totalFixas + totalInvest, 'Saídas totais')}
        ${kpiCard('Resultado Real', resultadoReal, 'Regra financeira oficial', resultadoReal >= 0 ? 'positive' : 'negative')}
      </section>

      <section class="content-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Eventos recentes</div>
              <div class="panel-subtitle">Base operacional que origina receita, custo e recebimento.</div>
            </div>
            <div class="chip">Infantil / Adulto / BBQ</div>
          </div>
          <div class="list">
            ${db.eventos.map(evento => `
              <div class="row">
                <div class="row-main">
                  <div class="row-title">${evento.codigo} — ${evento.cliente}</div>
                  <div class="row-meta">${evento.unidade} • ${evento.status} • ${formatDate(evento.data)}</div>
                </div>
                <div class="row-value">
                  ${money(evento.valorVendido)}
                  <span class="sub">Recebido ${money(evento.valorRecebido)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Alertas financeiros</div>
              <div class="panel-subtitle">Inconsistência nunca pode ficar invisível.</div>
            </div>
            <div class="chip">Confiabilidade</div>
          </div>
          <div class="alert-grid">
            ${alerts.map(alert => `
              <div class="alert-card">
                <h4 class="${alert.tone === 'green' ? 'text-green' : ''}">${alert.title}</h4>
                <p>${alert.copy}</p>
              </div>
            `).join('')}
          </div>
        </article>
      </section>

      <section class="metrics-compact">
        <div class="metric-compact">
          <div class="label">Entidades oficiais</div>
          <div class="value">6</div>
          <div class="copy">Modelagem funcional principal aplicada ao projeto.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Campos críticos</div>
          <div class="value">${Object.values(schema).reduce((acc, entity) => acc + entity.fields.filter(field => field.required).length, 0)}</div>
          <div class="copy">Campos obrigatórios para garantir integridade financeira.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Validações rígidas</div>
          <div class="value">${Object.values(schema).reduce((acc, entity) => acc + entity.rules.length, 0)}</div>
          <div class="copy">Regras que impedem mistura indevida e indicadores falsos.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Relações de negócio</div>
          <div class="value">${Object.values(schema).reduce((acc, entity) => acc + entity.relations.length, 0)}</div>
          <div class="copy">Conexões prontas para a próxima entrega com banco real.</div>
        </div>
      </section>
    </div>
  `;
}

function renderEvents(){
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Base de eventos</h2>
        <p class="section-copy">Cada evento é tratado como unidade financeira de resultado. Aqui a modelagem já aplica os campos obrigatórios da Etapa 02: código, cliente, data, unidade, status, valor vendido, valor recebido, forma de pagamento e observações.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-6">
          <div>Código</div>
          <div>Cliente</div>
          <div>Data</div>
          <div>Unidade</div>
          <div>Venda</div>
          <div>Status</div>
        </div>
        ${db.eventos.map(item => `
          <div class="table-row cols-6">
            <div>${item.codigo}</div>
            <div>${item.cliente}</div>
            <div class="table-cell-muted">${formatDate(item.data)}</div>
            <div>${item.unidade}</div>
            <div>${money(item.valorVendido)}</div>
            <div><span class="badge gold">${item.status}</span></div>
          </div>
        `).join('')}
      </div>

      <div class="cards-grid">
        ${schema.eventos.fields.map(field => `
          <article class="entity-card">
            <div class="entity-top">
              <div>
                <div class="entity-kind">${field.type}</div>
                <div class="entity-name">${field.name}</div>
              </div>
              <span class="badge ${field.required ? 'green' : 'yellow'}">${field.required ? 'Obrigatório' : 'Opcional'}</span>
            </div>
            <div class="entity-desc">${field.description}</div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCosts(){
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Custos de evento vinculados</h2>
        <p class="section-copy">A Etapa 02 trava a regra crítica: custo de evento sem evento vinculado não existe. Previsto e realizado são separados para garantir visão gerencial correta.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-6">
          <div>Evento</div>
          <div>Categoria</div>
          <div>Previsto</div>
          <div>Realizado</div>
          <div>Data</div>
          <div>Status</div>
        </div>
        ${db.custosEvento.map(item => `
          <div class="table-row cols-6">
            <div>${item.eventoCodigo}</div>
            <div>${item.categoria}</div>
            <div>${money(item.previsto)}</div>
            <div>${money(item.realizado)}</div>
            <div class="table-cell-muted">${formatDate(item.data)}</div>
            <div><span class="badge ${item.status === 'Realizado' ? 'green' : 'yellow'}">${item.status}</span></div>
          </div>
        `).join('')}
      </div>
      <article class="panel">
        <div class="panel-title">Validações aplicadas</div>
        <div class="rule-list">
          ${schema.custosEvento.rules.map(rule => `<div class="rule-item"><strong>Regra crítica</strong>${rule}</div>`).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderFixedExpenses(){
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Despesas fixas da estrutura</h2>
        <p class="section-copy">Despesas fixas são mensais, independem da realização de evento e precisam ficar separadas de custo e investimento.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-5">
          <div>Competência</div>
          <div>Categoria</div>
          <div>Previsto</div>
          <div>Realizado</div>
          <div>Status</div>
        </div>
        ${db.despesasFixas.map(item => `
          <div class="table-row cols-5">
            <div>${item.competencia}</div>
            <div>${item.categoria}</div>
            <div>${money(item.previsto)}</div>
            <div>${money(item.realizado)}</div>
            <div><span class="badge green">${item.status}</span></div>
          </div>
        `).join('')}
      </div>
      <article class="panel">
        <div class="panel-title">Regra principal deste módulo</div>
        <div class="rule-list">
          ${schema.despesasFixas.rules.map(rule => `<div class="rule-item"><strong>Despesa fixa</strong>${rule}</div>`).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderInvestments(){
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Investimentos estruturais</h2>
        <p class="section-copy">A modelagem separa investimento de custo e despesa fixa para proteger o resultado operacional e o resultado real.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-5">
          <div>Data</div>
          <div>Categoria</div>
          <div>Descrição</div>
          <div>Valor</div>
          <div>Status</div>
        </div>
        ${db.investimentos.map(item => `
          <div class="table-row cols-5">
            <div>${formatDate(item.data)}</div>
            <div>${item.categoria}</div>
            <div>${item.descricao}</div>
            <div>${money(item.valor)}</div>
            <div><span class="badge gold">${item.status}</span></div>
          </div>
        `).join('')}
      </div>
      <article class="panel">
        <div class="panel-title">Blindagem da classificação</div>
        <div class="rule-list">
          ${schema.investimentos.rules.map(rule => `<div class="rule-item"><strong>Investimento</strong>${rule}</div>`).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderFinance(){
  const receivables = getRecebiveis();
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Agenda financeira e contas a receber</h2>
        <p class="section-copy">Financeiro não substitui os outros módulos. Ele consolida comportamento do dinheiro, sempre separado de venda.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-6">
          <div>Evento</div>
          <div>Cliente</div>
          <div>Vencimento</div>
          <div>Previsto</div>
          <div>Recebido</div>
          <div>Status</div>
        </div>
        ${receivables.map(item => `
          <div class="table-row cols-6">
            <div>${item.codigo}</div>
            <div>${item.cliente}</div>
            <div class="table-cell-muted">${formatDate(item.vencimento)}</div>
            <div>${money(item.previsto)}</div>
            <div>${money(item.recebido)}</div>
            <div><span class="badge ${item.status === 'Recebido' ? 'green' : 'yellow'}">${item.status}</span></div>
          </div>
        `).join('')}
      </div>
      <section class="metrics-compact">
        <div class="metric-compact">
          <div class="label">Vendido</div>
          <div class="value">${money(totalVendas)}</div>
          <div class="copy">Receita contratada dos eventos.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Recebido</div>
          <div class="value">${money(totalRecebido)}</div>
          <div class="copy">Dinheiro que efetivamente entrou.</div>
        </div>
        <div class="metric-compact">
          <div class="label">A receber</div>
          <div class="value">${money(totalAReceber)}</div>
          <div class="copy">Saldo pendente que precisa continuar no radar.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Regras</div>
          <div class="value">${schema.financeiro.rules.length}</div>
          <div class="copy">Validações financeiras da modelagem.</div>
        </div>
      </section>
    </div>
  `;
}

function renderUsers(){
  return `
    <div class="page-grid">
      <div>
        <h2 class="section-title">Usuários e permissões</h2>
        <p class="section-copy">Segurança é parte da estrutura do sistema. A Etapa 02 já aplica perfis base e regras para a próxima entrega com autenticação real e RLS.</p>
      </div>
      <div class="table-card">
        <div class="table-head cols-5">
          <div>Nome</div>
          <div>E-mail</div>
          <div>Perfil</div>
          <div>Status</div>
          <div>Escopo</div>
        </div>
        ${db.usuarios.map(item => `
          <div class="table-row cols-5">
            <div>${item.nome}</div>
            <div class="table-cell-muted">${item.email}</div>
            <div>${item.perfil}</div>
            <div><span class="badge green">${item.status}</span></div>
            <div>${item.perfil === 'Admin' ? 'Total' : item.perfil === 'Financeiro' ? 'Financeiro + Operação' : 'Operação controlada'}</div>
          </div>
        `).join('')}
      </div>
      <div class="cards-grid">
        ${db.perfis.map(profile => `
          <article class="entity-card">
            <div class="entity-top">
              <div>
                <div class="entity-kind">Perfil</div>
                <div class="entity-name">${profile.nome}</div>
              </div>
              <span class="badge gold">Base</span>
            </div>
            <div class="entity-desc">
              ${profile.nome === 'Admin' ? 'Acesso total ao sistema, incluindo governança, módulos e auditoria.' :
                profile.nome === 'Financeiro' ? 'Acesso a dashboard, eventos, custos, despesas, investimentos e financeiro.' :
                'Acesso controlado a eventos e custos operacionais autorizados.'}
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderModeling(){
  const entity = schema[state.entity];
  return `
    <div class="page-grid">
      <section class="hero">
        <div class="hero-card">
          <div class="eyebrow">MODELAGEM FUNCIONAL OFICIAL</div>
          <h2>Entidades, campos obrigatórios, relações e validações críticas já embutidas no projeto.</h2>
          <p>Esta tela representa a saída prática da Etapa 02. Ela organiza a estrutura que vai virar tabelas no Supabase, com tipagem, obrigatoriedade e regras de negócio da Home Fest.</p>
        </div>
        <div class="status-card">
          <div>
            <div class="status-label">Próxima camada</div>
            <div class="status-value">DB</div>
            <div class="status-sub">Supabase + RLS + autenticação</div>
          </div>
          <div class="legend">
            <span class="badge gold">Etapa 02</span>
            <span class="badge green">Pronta para banco</span>
          </div>
        </div>
      </section>

      <section class="metrics-compact">
        <div class="metric-compact">
          <div class="label">Tabelas núcleo</div>
          <div class="value">6</div>
          <div class="copy">events, event_costs, fixed_expenses, investments, receivables, users/profiles.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Campos desta entidade</div>
          <div class="value">${entity.fields.length}</div>
          <div class="copy">Estrutura mínima recomendada para esta parte do sistema.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Obrigatórios</div>
          <div class="value">${entity.fields.filter(field => field.required).length}</div>
          <div class="copy">Itens que não podem ficar vazios sem comprometer a confiabilidade.</div>
        </div>
        <div class="metric-compact">
          <div class="label">Regras críticas</div>
          <div class="value">${entity.rules.length}</div>
          <div class="copy">Validações que protegem o negócio contra erro e mistura indevida.</div>
        </div>
      </section>

      <article class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Entidades oficiais da etapa</div>
            <div class="panel-subtitle">Selecione para inspecionar os campos, regras e relações.</div>
          </div>
        </div>
        <div class="tabs">
          ${Object.keys(schema).map(key => `
            <button class="entity-tab ${state.entity === key ? 'active' : ''}" data-entity="${key}">
              ${schema[key].title}
            </button>
          `).join('')}
        </div>
      </article>

      <section class="detail-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">${entity.title}</div>
              <div class="panel-subtitle">${entity.kind} • ${entity.description}</div>
            </div>
            <div class="chip">${entity.fields.filter(field => field.required).length} obrigatórios</div>
          </div>
          <div class="field-list">
            ${entity.fields.map(field => `
              <div class="field-item">
                <div class="field-top">
                  <div class="field-name">${field.name}</div>
                  <div class="field-type">${field.type}</div>
                </div>
                <div class="field-meta">${field.description}</div>
                <div class="spacer-18"></div>
                <span class="badge ${field.required ? 'green' : 'yellow'}">${field.required ? 'Obrigatório' : 'Opcional'}</span>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="panel">
          <div class="panel-title">Regras e relações</div>
          <div class="rule-list">
            ${entity.rules.map(rule => `<div class="rule-item"><strong>Validação</strong>${rule}</div>`).join('')}
          </div>
          <div class="spacer-18"></div>
          <div class="relation-list">
            ${entity.relations.map(relation => `<div class="relation-item"><strong>Relacionamento</strong>${relation}</div>`).join('')}
          </div>
        </article>
      </section>

      <section class="cards-grid">
        ${Object.values(schema).map(item => `
          <article class="entity-card">
            <div class="entity-top">
              <div>
                <div class="entity-kind">${item.kind}</div>
                <div class="entity-name">${item.title}</div>
              </div>
              <span class="badge gold">${item.fields.length} campos</span>
            </div>
            <div class="entity-desc">${item.description}</div>
            <div class="mini-list">
              ${item.fields.slice(0,4).map(field => `<span class="mini-pill">${field.name}</span>`).join('')}
            </div>
          </article>
        `).join('')}
      </section>
    </div>
  `;
}

function render(){
  pageTitle.textContent = meta.titleMap[state.view];
  pageSubtitle.textContent = meta.subtitleMap[state.view];
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === state.view));

  let html = '';
  if (state.view === 'dashboard') html = renderDashboard();
  if (state.view === 'eventos') html = renderEvents();
  if (state.view === 'custos') html = renderCosts();
  if (state.view === 'despesas') html = renderFixedExpenses();
  if (state.view === 'investimentos') html = renderInvestments();
  if (state.view === 'financeiro') html = renderFinance();
  if (state.view === 'usuarios') html = renderUsers();
  if (state.view === 'modelagem') html = renderModeling();

  app.innerHTML = html;

  document.querySelectorAll('.entity-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.entity = tab.dataset.entity;
      render();
    });
  });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    state.view = item.dataset.view;
    render();
  });
});

render();
