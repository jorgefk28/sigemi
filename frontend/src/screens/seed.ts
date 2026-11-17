/**
 * Seed data delivered with the back-office repository.
 *
 * Spec S4: every screen must keep showing its dataset. Rows that the backend
 * can serve are replaced at boot by the real records (`src/data/*`); this seed
 * remains the fallback and the whole dataset for the subsystems that still have
 * no v1 endpoint (agenda, stock, waste — assumption A3 of
 * `odd/tasks/07-frontend-backoffice.md`).
 */

import type { Analisis } from './components/SharedLayout';
import type { Revision } from './components/clinica';

/* Revisiones semanales de ejemplo (HOY del prototipo: 19/10/2026) */
const rev = (fechas: string[], ultima?: Partial<Revision>): Revision[] =>
  fechas.map((fecha, i) => ({
    fecha,
    hora: '09:30',
    responsable: i % 2 ? 'Salinas, M.' : 'Fernández, R.',
    condicion: 'Óptimas condiciones',
    nota: '',
    ...(i === fechas.length - 1 ? ultima : {}),
  }));

const SEED_REVISIONES: Record<string, Revision[]> = {
  'MIC-2026-0340': rev(['20/09/2026', '27/09/2026', '04/10/2026', '11/10/2026', '16/10/2026']),
  'MIC-2026-0335': rev(['15/09/2026', '22/09/2026', '29/09/2026', '06/10/2026'], {
    condicion: 'Con observaciones',
    nota: 'Leve desecación del medio en tubo 1; se rehidrata.',
  }),
  'MIC-2026-0334': rev(['14/09/2026', '21/09/2026', '28/09/2026', '05/10/2026', '12/10/2026']),
  'MIC-2026-0330': rev(
    ['11/09/2026', '18/09/2026', '25/09/2026', '02/10/2026', '09/10/2026', '13/10/2026'],
    { condicion: 'Deteriorada o contaminada', nota: 'Contaminación bacteriana en ambos tubos.' },
  ),
};

export const INITIAL_MOCK_DATA: Analisis[] = [
  { id: 'MIC-2026-0341', paciente: 'Ramírez, Claudia B.', dni: '27.384.901', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis ungueal', estado: 'Pendiente', fechaIngreso: '14/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0340', paciente: 'Gómez Torres, Luis A.', dni: '33.210.005', tipoMuestra: 'Cabello', tipoAnalisis: 'Micosis superficial', estado: 'En Proceso', fechaIngreso: '13/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0339', paciente: 'Pereyra, Ana M.', dni: '20.771.442', tipoMuestra: 'Piel', tipoAnalisis: 'Micosis profunda', estado: 'Terminado y validado', fechaIngreso: '11/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0338', paciente: 'Vargas, Diego H.', dni: '40.105.887', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis ungueal', estado: 'Terminado y validado', fechaIngreso: '10/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0337', paciente: 'Medina, Sofía L.', dni: '29.553.314', tipoMuestra: 'Cabello', tipoAnalisis: 'Micosis profunda', estado: 'Terminado y validado', fechaIngreso: '09/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0336', paciente: 'Juárez, Marcelo F.', dni: '18.902.673', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis superficial', estado: 'Cancelado', fechaIngreso: '08/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0335', paciente: 'Torres, Beatriz N.', dni: '35.448.120', tipoMuestra: 'Piel', tipoAnalisis: 'Micosis profunda', estado: 'En Proceso', fechaIngreso: '08/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0334', paciente: 'Rodríguez, Pablo O.', dni: '22.116.759', tipoMuestra: 'Cabello', tipoAnalisis: 'Micosis ungueal', estado: 'En Proceso', fechaIngreso: '07/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0333', paciente: 'Castro, Elena V.', dni: '31.879.003', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis profunda', estado: 'Pendiente', fechaIngreso: '07/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0332', paciente: 'Herrera, Tomás G.', dni: '26.040.516', tipoMuestra: 'Piel', tipoAnalisis: 'Micosis profunda', estado: 'Terminado y validado', fechaIngreso: '05/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0331', paciente: 'Blanco, Miriam C.', dni: '38.724.809', tipoMuestra: 'Cabello', tipoAnalisis: 'Micosis superficial', estado: 'Terminado y validado', fechaIngreso: '05/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0330', paciente: 'Sosa, Fabián R.', dni: '24.381.274', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis ungueal', estado: 'En Proceso', fechaIngreso: '04/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0329', paciente: 'Navarro, Inés P.', dni: '43.007.661', tipoMuestra: 'Cabello', tipoAnalisis: 'Micosis profunda', estado: 'Pendiente', fechaIngreso: '03/09/2026', bioquimico: 'Fernández, R.' },
  { id: 'MIC-2026-0328', paciente: 'Aguilar, Roberto M.', dni: '17.655.428', tipoMuestra: 'Piel', tipoAnalisis: 'Micosis superficial', estado: 'Cancelado', fechaIngreso: '02/09/2026', bioquimico: 'Salinas, M.' },
  { id: 'MIC-2026-0327', paciente: 'Ríos, Lorena A.', dni: '30.199.340', tipoMuestra: 'Uñas', tipoAnalisis: 'Micosis profunda', estado: 'Terminado y validado', fechaIngreso: '01/09/2026', bioquimico: 'Fernández, R.' },
];

INITIAL_MOCK_DATA.forEach((a) => {
  if (SEED_REVISIONES[a.id]) a.revisiones = SEED_REVISIONES[a.id];
});

const SEED_VALIDADO = INITIAL_MOCK_DATA.find((a) => a.id === 'MIC-2026-0338');
if (SEED_VALIDADO) {
  SEED_VALIDADO.resultado = {
    material: 'Raspado ungueal',
    determinaciones: [{ fecha: '2026-09-24', ed: 'Positivo', edElementos: ['Hifas hialinas tabicadas', 'Artroconidias'], edDetalle: 'KOH 20%', cultivo: 'Positivo', medios: ['Agar Sabouraud glucosado', 'Lactrimel'], cultivoDetalle: 'Colonias blancas algodonosas, reverso rojo vino a los 12 días.', identificacion: 'Trichophyton rubrum', identificacionOtro: '' }],
    inmuno: [],
    diagnostico: 'Onicomicosis por Trichophyton rubrum',
    interpretacion: 'Onicomicosis subungueal distal y lateral.',
    recomendaciones: 'Control micológico al finalizar el tratamiento.',
    guardado: '25/09/2026 10:40',
    guardadoPor: 'Salinas, M.',
    validado: { por: 'Salinas, M.', fecha: '25/09/2026 10:42' },
  };
}
