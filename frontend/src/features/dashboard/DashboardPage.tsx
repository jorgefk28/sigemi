import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn } from '../../components/Btn';
import { EmptyState } from '../../components/EmptyState';
import { Kpi } from '../../components/Kpi';
import { Panel } from '../../components/Panel';

/** Link from an indicator to the module that governs it (REP-02 pasos 4-5). */
function VerModulo({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="text-[11px] font-medium text-brand hover:underline">
      {label}
    </Link>
  );
}

/** Format a Date as `dd.MM.yyyy` (es-AR, dot separators). */
function formatDateAR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** Format a Date as `HH:mm` (24h). */
function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Landing page (S7): the prototype's frame rendered with explicit empty
 * states. No data is invented — every KPI shows `—` and every list shows
 * "Sin datos todavía" until its module's endpoints exist.
 */
export function DashboardPage() {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const today = formatDateAR(new Date());

  function handleRefresh() {
    setUpdatedAt(formatTime(new Date()));
  }

  return (
    <div>
      {/* Page head */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            SIGEMI · {today}
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            Estado operativo del laboratorio
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted">
            Última actualización: {updatedAt ?? '—'}
          </span>
          <Btn variant="primary" onClick={handleRefresh}>
            ↻ Actualizar
          </Btn>
        </div>
      </div>

      {/* Bordered band */}
      <div className="mt-6 border-t-2 border-gray-900 pt-2">
        <h2 className="text-sm font-semibold text-gray-900">Resumen</h2>
      </div>

      {/* Cards. REP-02 pasos 4-5: each indicator leads to the module that owns
          it (A-10); the values stay empty until those modules have endpoints. */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel
          title="Turnos de hoy"
          meta="Hoy"
          action={<VerModulo to="/agenda" label="Ver agenda" />}
        >
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Confirmados" />
            <Kpi label="Atendidos" />
            <Kpi label="No asistieron" />
          </div>
        </Panel>

        <Panel
          title="Carga de trabajo"
          meta="Hoy"
          action={<VerModulo to="/analisis" label="Ver análisis" />}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Pendiente" />
            <Kpi label="En Proceso" />
            <Kpi label="Terminado" />
            <Kpi label="Validado" />
          </div>
        </Panel>

        <Panel
          title="Próximos turnos"
          action={<VerModulo to="/agenda" label="Ver agenda" />}
        >
          <EmptyState />
        </Panel>

        <Panel
          title="Alertas de stock"
          action={<VerModulo to="/insumos" label="Ver insumos" />}
        >
          <EmptyState />
        </Panel>
      </div>
    </div>
  );
}
