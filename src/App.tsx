import { KpiCard } from "./components/KpiCard";
import { SectionCard } from "./components/SectionCard";
import { alertas, currency, eventos, resultadoReal, summary } from "./data/mockData";

const menu = [
  "Dashboard",
  "Eventos",
  "Custos de Evento",
  "Despesas Fixas",
  "Investimentos",
  "Financeiro",
  "Usuários",
];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HF</div>
          <div>
            <strong>Home Fest</strong>
            <span>& Eventos</span>
          </div>
        </div>

        <nav className="nav">
          {menu.map((item, index) => (
            <button key={item} className={index === 0 ? "nav-item active" : "nav-item"}>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <small>Sistema financeiro</small>
          <strong>MVP Etapa 01</strong>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Painel executivo</p>
            <h1>Resultado real da operação</h1>
          </div>
          <div className="topbar-badge">Home Fest & Eventos</div>
        </header>

        <section className="hero-card">
          <div>
            <p className="hero-label">Regra central imutável</p>
            <h2>Resultado Real = Vendas - Custos de Evento - Despesas Fixas - Investimentos</h2>
          </div>
          <div className={resultadoReal >= 0 ? "result-chip positive" : "result-chip negative"}>
            {currency(resultadoReal)}
          </div>
        </section>

        <section className="kpi-grid">
          <KpiCard label="Vendido" value={currency(summary.vendido)} tone="gold" />
          <KpiCard label="Recebido" value={currency(summary.recebido)} tone="green" />
          <KpiCard label="A receber" value={currency(summary.aReceber)} hint="Saldo pendente dos eventos" />
          <KpiCard label="Custos de evento" value={currency(summary.custosEventos)} tone="neutral" />
          <KpiCard label="Despesas fixas" value={currency(summary.despesasFixas)} tone="neutral" />
          <KpiCard label="Investimentos" value={currency(summary.investimentos)} tone="red" />
        </section>

        <section className="main-grid">
          <SectionCard title="Eventos prioritários" subtitle="Primeira visão operacional do sistema">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Unidade</th>
                    <th>Data</th>
                    <th>Vendido</th>
                    <th>Recebido</th>
                    <th>A receber</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((evento) => (
                    <tr key={evento.codigo}>
                      <td>{evento.codigo}</td>
                      <td>{evento.cliente}</td>
                      <td>{evento.unidade}</td>
                      <td>{evento.data}</td>
                      <td>{currency(evento.vendido)}</td>
                      <td>{currency(evento.recebido)}</td>
                      <td>{currency(evento.receber)}</td>
                      <td><span className="status-pill">{evento.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Alertas críticos" subtitle="O sistema sempre mostra inconsistências e atenção gerencial">
            <div className="alerts">
              {alertas.map((alerta) => (
                <div className="alert-item" key={alerta}>
                  <span className="alert-dot" />
                  <p>{alerta}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>
      </main>
    </div>
  );
}
