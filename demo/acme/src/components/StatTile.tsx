// Overview metrics. A little roomier than Card, by design or by accident.
export function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: 'var(--acme-surface)', border: '1px solid var(--acme-line)', borderRadius: 14, padding: 20 }}>
      <div className="muted">{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, margin: '4px 0' }}>{value}</div>
      <div className="muted" style={{ fontSize: 13 }}>{hint}</div>
    </div>
  );
}
