/**
 * Formatting helpers for values that come from the backend.
 *
 * Dates are never round-tripped through `Date` when the value has no time:
 * `new Date('2020-01-01')` is parsed as UTC midnight, so a viewer west of UTC
 * would see the previous day. A calendar date is reordered as text.
 */

/** R4: `YYYY-MM-DD` rendered as `dd/MM/yyyy`, without any timezone shift. */
export function formatFecha(iso: string): string {
  const partes = iso.slice(0, 10).split('-');
  if (partes.length !== 3) {
    return iso;
  }
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/** R4: ISO-8601 UTC rendered as the viewer's local `dd/MM/yyyy HH:mm`. */
export function formatFechaHora(iso: string): string {
  const fecha = new Date(iso);
  const parteFecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
  const parteHora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  return `${parteFecha} ${parteHora}`;
}
