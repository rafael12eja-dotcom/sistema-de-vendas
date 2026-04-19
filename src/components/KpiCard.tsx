type KpiCardProps = {
  label: string;
  value: string;
  tone?: "gold" | "green" | "red" | "neutral";
  hint?: string;
};

export function KpiCard({ label, value, tone = "neutral", hint }: KpiCardProps) {
  return (
    <section className={`kpi-card tone-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </section>
  );
}
