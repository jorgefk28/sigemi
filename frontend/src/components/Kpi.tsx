/**
 * KPI slot: a muted label over a value. When no data is connected the value
 * renders the explicit empty placeholder `—` (never an invented number).
 */
export function Kpi({ label, value = '—' }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
