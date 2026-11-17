import { useState } from "react";
import { STATUS_MAP, type Analisis, type Estado } from "./SharedLayout";
import { PageShell, Panel, Kpi, Btn, Banner, Pill, TONES } from "./ui";

const PROXIMOS = [
  { hora: "10:00", paciente: "García, María", estudio: "Micosis ungueal", estado: "Confirmado" },
  { hora: "10:30", paciente: "López, Ana", estudio: "Micosis superficial", estado: "Confirmado" },
  { hora: "11:00", paciente: "Pérez, Roberto", estudio: "Micosis profunda", estado: "Pendiente" },
  { hora: "11:30", paciente: "Benítez, Julia", estudio: "Micosis ungueal", estado: "Confirmado" },
  { hora: "12:00", paciente: "Acosta, Martín", estudio: "Micosis superficial", estado: "Pendiente" },
];

const ALERTAS = [
  { insumo: "KOH 20% — Hidróxido de potasio", lote: "L-24-118", motivo: "Sin stock", detalle: "0 unid.", tone: "red" as const },
  { insumo: "Agar Sabouraud dextrosa", lote: "L-25-031", motivo: "Pre-vencimiento", detalle: "vence en 15 días", tone: "amber" as const },
  { insumo: "Cloranfenicol 50 mg", lote: "L-25-007", motivo: "Bajo mínimo", detalle: "1 / mín. 4", tone: "amber" as const },
];

export default function PanelControlView({
  analisis,
  onNavigate,
}: {
  analisis: Analisis[];
  onNavigate: (page: string) => void;
}) {
  const [updatedAt, setUpdatedAt] = useState("09:42");
  const [stale, setStale] = useState(true);
  const counts = analisis.reduce<Record<string, number>>((acc, a) => ((acc[a.estado] = (acc[a.estado] ?? 0) + 1), acc), {});
  const carga: Estado[] = ["Pendiente", "En Proceso", "Terminado y validado"];
  const total = carga.reduce((s, k) => s + (counts[k] ?? 0), 0);

  const refresh = () => {
    const d = new Date();
    setUpdatedAt(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setStale(false);
  };

  const link = (label: string, page: string) => (
    <button onClick={() => onNavigate(page)} className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-accent hover:underline">
      {label} →
    </button>
  );

  return (
    <PageShell
      activePage="Panel de Control"
      onNavigate={onNavigate}
      section="Principal"
      title="Panel de Control"
      actions={
        <>
          <span className="text-[11px] text-text-muted">Última actualización: {updatedAt}</span>
          <Btn onClick={refresh}>↻ Actualizar</Btn>
        </>
      }
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        <div className="flex items-end justify-between border-b-2 border-text-primary pb-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">Lunes 14.09.2026</div>
            <h1 className="m-0 mt-1 text-[28px] leading-none font-bold tracking-[-0.02em] text-text-primary">Estado operativo del laboratorio</h1>
          </div>
          <div className="hidden text-right text-[11px] text-text-secondary md:block">
            Bioquímico/Doctor · Fernández, R.
          </div>
        </div>

        {stale && (
          <Banner tone="gray" action={<Btn onClick={refresh}>Actualizar ahora</Btn>}>
            Los datos tienen más de 2 minutos. Actualizá para ver el estado más reciente.
          </Banner>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Turnos de hoy" meta="REC-06 · REC-15" footer={link("Ver agenda de hoy", "Agenda y Turnos")}>
            <div className="grid grid-cols-3 gap-4">
              <Kpi label="Confirmados" value={8} tone={TONES.green.dot} />
              <Kpi label="Atendidos" value={3} tone={TONES.violet.dot} />
              <Kpi label="No asistieron" value={1} tone={TONES.dark.dot} />
            </div>
          </Panel>

          <Panel title="Carga de trabajo" meta="Terminado y validado: últimos 30 días" footer={link("Ir al Panel de Análisis", "Análisis")}>
            <div className="grid grid-cols-3 gap-4">
              {carga.map((k) => (
                <Kpi key={k} label={k} value={counts[k] ?? 0} tone={STATUS_MAP[k].dot} />
              ))}
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-sm bg-bg">
              {carga.map((k) => (
                <div key={k} style={{ width: `${((counts[k] ?? 0) / (total || 1)) * 100}%`, background: STATUS_MAP[k].dot }} />
              ))}
            </div>
          </Panel>

          <Panel title="Próximos turnos" meta="Máx. 5 · hoy" flush footer={link("Ver agenda completa", "Agenda y Turnos")}>
            <ul className="m-0 list-none p-0">
              {PROXIMOS.map((t) => (
                <li key={t.hora} className="flex items-center gap-4 border-b border-border-light px-4 py-2.5 last:border-b-0">
                  <span className="w-12 font-mono text-[12px] font-medium text-text-primary">{t.hora}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{t.paciente}</div>
                    <div className="text-[11px] text-text-secondary">{t.estudio}</div>
                  </div>
                  <Pill tone={t.estado === "Confirmado" ? "green" : "amber"}>{t.estado}</Pill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Alertas de stock" meta="Mín. 1 · pre-venc. 30 días" flush footer={link("Ir a Insumos", "Insumos y Stock")}>
            <ul className="m-0 list-none p-0">
              {ALERTAS.map((a) => (
                <li key={a.lote} className="flex items-center gap-3 border-b border-border-light px-4 py-2.5 last:border-b-0">
                  <span className="text-[13px]" style={{ color: TONES[a.tone].dot }}>⚠</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{a.insumo}</div>
                    <div className="font-mono text-[11px] text-text-muted">{a.lote}</div>
                  </div>
                  <div className="text-right">
                    <Pill tone={a.tone}>{a.motivo}</Pill>
                    <div className="mt-0.5 text-[11px] text-text-secondary">{a.detalle}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Indicadores de agenda" meta="REC-08 · REC-14" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Kpi label="Franjas bloqueadas hoy" value={2} sub="Consultorio 2 · 14:00–16:00" />
              <Kpi label="Cancelaciones por vencimiento" value={1} sub="Sin confirmación 24 h" />
              <Kpi label="Ocupación de agenda" value="72%" sub="18 de 25 franjas" />
              <Kpi label="Muestras ingresadas hoy" value={4} sub="Uñas 2 · Cabello 1 · Piel 1" />
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
