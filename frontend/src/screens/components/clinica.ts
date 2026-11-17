import { createStore, HOY, fmtDate, parseDate } from "../sigemi/core";

/* ─── Pacientes (store compartido) ──────────────────────── */
export type Sexo = "Femenino" | "Masculino" | "X" | "";
export interface AltaTemprana {
  recibido: string; // dd/mm/yyyy hh:mm
  origen: string;
  turno: string; // dd/mm/yyyy hh:mm
}
export interface Paciente {
  dni: string;
  nombre: string;
  apellido: string;
  nacimiento: string; // dd/mm/yyyy
  sexo: Sexo;
  ocupacion: string;
  telefono: string;
  correo: string;
  direccion: string;
  obraSocial: string;
  registro: string;
  activo: boolean;
  /** Presente mientras el paciente solo tiene los datos mínimos recibidos del sistema de turnos. */
  altaTemprana?: AltaTemprana;
}
export type EstadoPaciente = "Alta temprana" | "Activo" | "Inactivo";
export const estadoPaciente = (p: Paciente): EstadoPaciente => (p.altaTemprana ? "Alta temprana" : p.activo ? "Activo" : "Inactivo");

export const edad = (nac: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(nac)) return null;
  const [d, m, y] = nac.split("/").map(Number);
  let e = HOY.getFullYear() - y;
  if (HOY.getMonth() + 1 < m || (HOY.getMonth() + 1 === m && HOY.getDate() < d)) e--;
  return e;
};

const P = (dni: string, nombre: string, apellido: string, nacimiento: string, sexo: Sexo, ocupacion: string, telefono: string, correo: string, direccion: string, obraSocial: string, registro: string, activo = true): Paciente => ({
  dni, nombre, apellido, nacimiento, sexo, ocupacion, telefono, correo, direccion, obraSocial, registro, activo,
});
const AT = (dni: string, nombre: string, apellido: string, telefono: string, recibido: string, turno: string): Paciente => ({
  dni, nombre, apellido, telefono, nacimiento: "", sexo: "", ocupacion: "", correo: "", direccion: "", obraSocial: "", registro: "", activo: true,
  altaTemprana: { recibido, origen: "Sistema de turnos web", turno },
});

export const pacientesStore = createStore<Paciente[]>([
  AT("43.007.661", "Inés P.", "Navarro", "376-154-821190", "17/10/2026 08:12", "19/10/2026 11:00"),
  AT("41.902.337", "Ramón E.", "Benítez", "376-155-034471", "18/10/2026 19:40", "20/10/2026 08:30"),
  AT("44.218.560", "Lucía M.", "Ocampo", "376-154-662018", "18/10/2026 21:05", "21/10/2026 09:00"),
  AT("36.554.102", "Jorge A.", "Fleitas", "3755-15-498230", "19/10/2026 07:55", "22/10/2026 10:30"),
  P("27.384.901", "Claudia B.", "Ramírez", "12/04/1979", "Femenino", "Docente", "376-4412-908", "c.ramirez@mail.com", "Av. Uruguay 1840, Posadas", "IPS Misiones", "02/03/2025"),
  P("33.210.005", "Luis A.", "Gómez Torres", "30/08/1987", "Masculino", "Peón rural", "376-4501-223", "lgomez@mail.com", "Bolívar 455, Posadas", "OSDE", "18/06/2025"),
  P("20.771.442", "Ana M.", "Pereyra", "05/01/1968", "Femenino", "Jubilada", "376-4677-012", "", "Junín 2210, Oberá", "PAMI", "11/09/2024"),
  P("40.105.887", "Diego H.", "Vargas", "22/11/1997", "Masculino", "Estudiante", "376-4120-554", "dvargas@mail.com", "San Lorenzo 98, Posadas", "Particular", "07/01/2026"),
  P("18.902.673", "Marcelo F.", "Juárez", "14/02/1959", "Masculino", "Albañil", "376-4388-701", "", "Colón 1500, Posadas", "PAMI", "20/05/2023", false),
  P("29.553.314", "Sofía L.", "Medina", "09/07/1982", "Femenino", "Enfermera", "376-4299-310", "smedina@mail.com", "Félix de Azara 760, Posadas", "Swiss Medical", "14/02/2026"),
  P("35.448.120", "Beatriz N.", "Torres", "27/03/1990", "Femenino", "Productora yerbatera", "376-4855-447", "", "Rivadavia 320, Apóstoles", "IPS Misiones", "03/08/2025"),
  P("22.116.759", "Pablo O.", "Rodríguez", "16/10/1971", "Masculino", "Comerciante", "376-4011-882", "prodriguez@mail.com", "Tucumán 1900, Posadas", "OSDE", "29/11/2024"),
  P("31.879.003", "Elena V.", "Castro", "01/06/1985", "Femenino", "Administrativa", "376-4933-615", "", "Sarmiento 44, Garupá", "Particular", "10/04/2026", false),
  P("26.040.516", "Tomás G.", "Herrera", "19/12/1977", "Masculino", "Carpintero", "376-4740-206", "therrera@mail.com", "Ayacucho 1102, Posadas", "IPS Misiones", "22/07/2025"),
  P("38.724.809", "Miriam C.", "Blanco", "08/05/1994", "Femenino", "Peluquera", "376-4566-090", "", "Entre Ríos 650, Posadas", "OSDE", "05/09/2026"),
  P("24.381.274", "Fabián R.", "Sosa", "25/09/1975", "Masculino", "Chofer", "376-4207-338", "fsosa@mail.com", "Mitre 2333, Posadas", "PAMI", "16/03/2024"),
]);

/* ─── Ficha clínica ─────────────────────────────────────── */
export type Naturaleza = "Superficial" | "Profunda";
export type Sitio = "Cuero cabelludo" | "Piel lampiña" | "Uñas";
export type SiNo = "" | "Sí" | "No";

export interface Ficha {
  registro: string;
  fechaIngreso: string; // dd/mm/yyyy
  naturaleza: Naturaleza;
  // Comunes
  medico: string;
  institucion: string;
  diagnostico: string;
  evolucion: string;
  atfPrevio: SiNo;
  atfPrevioDetalle: string;
  factores: string[];
  sinFactores: boolean;
  material: string;
  obsMuestra: string;
  // Superficiales y cutáneas
  sitio?: Sitio;
  localizacion?: string;
  lesion?: string[];
  bordes?: string;
  unaInicio?: string;
  unaColor?: string;
  // Profundas
  modalidad?: "Internado" | "Ambulatorio";
  internacion?: string;
  dxPresuntivo?: string;
  rayosX?: string;
  trayResidencial?: string;
  trayOcupacional?: string;
  atfActual?: SiNo;
  atfActualDetalle?: string;
  factoresOtros?: string;
  inmuno?: string[];
}

export const SITIOS: { k: Sitio; d: string }[] = [
  { k: "Cuero cabelludo", d: "Pelos y escamas del cuero cabelludo" },
  { k: "Piel lampiña", d: "Lesiones de piel sin pelo terminal" },
  { k: "Uñas", d: "Uñas de manos o pies" },
];

export const LESION: Record<Sitio, string[]> = {
  "Cuero cabelludo": ["Alopecía", "Descamación", "Supuración"],
  "Piel lampiña": ["Eritema", "Pigmentación", "Descamación", "Inflamación", "Supuración", "Prurito"],
  Uñas: ["Deformación", "Hiperqueratosis", "Detritus subungueal", "Paroniquia"],
};

export const FACTORES: Record<Naturaleza, { grupo: string; items: string[] }[]> = {
  Superficial: [
    { grupo: "Enfermedades", items: ["Diabetes", "Colagenopatías", "SIDA", "Vasculopatías", "Neutropenia", "Neoplasias", "Anemias", "Déficit de vitamina A", "Malnutrición"] },
    { grupo: "Medicación", items: ["Antibióticos", "Corticoides", "Citostáticos"] },
    { grupo: "Otros", items: ["Cirugías/Instrumentación", "Trasplantes de órganos", "Traumatismos", "Maceración de la piel", "Mascotas"] },
  ],
  Profunda: [
    { grupo: "Enfermedades", items: ["Tuberculosis", "Otras neumopatías", "VIH/SIDA", "Colagenopatías", "Diabetes", "Neoplasia", "Enfermedad renal", "Neutropenia", "Drogadicción", "Anemia"] },
    { grupo: "Procedimientos y condiciones", items: ["Instrumentación/Cirugía", "Sondas/Catéteres", "Diálisis", "Trasplantes de órganos", "Radioterapia", "Esplenectomía", "Malnutrición", "Otras causas inmunosupresoras"] },
    { grupo: "Medicamentos y hábitos", items: ["Antibióticos", "Corticoides", "Citostáticos", "Traumatismos", "Tabaquismo", "Etilismo", "Otros"] },
  ],
};

export const MATERIAL_SUP: Record<Sitio, string[]> = {
  "Cuero cabelludo": ["Pelos", "Escamas de cuero cabelludo", "Pelos y escamas", "Pus / exudado"],
  "Piel lampiña": ["Escamas de piel", "Exudado de lesión", "Biopsia de piel"],
  Uñas: ["Raspado ungueal", "Detritus subungueal", "Fragmento de uña"],
};
export const MATERIAL_PROF = [
  "Esputo", "Lavado broncoalveolar (BAL)", "Biopsia", "LCR", "Sangre (hemocultivo)", "Suero", "Orina", "Punción / aspirado", "Escarificación de lesión", "Otro",
];
export const INMUNO: { k: string; d: string }[] = [
  { k: "ID Pb", d: "Paracoccidioides brasiliensis" },
  { k: "ID Alla", d: "Inmunodifusión" },
  { k: "ID Ani", d: "Aspergillus niger" },
  { k: "ID Hc", d: "Histoplasma capsulatum" },
  { k: "ID Afu", d: "Aspergillus fumigatus" },
  { k: "Ltx Cry", d: "Látex Cryptococcus" },
];

/** Deriva tipo de muestra / tipo de análisis del panel a partir de la ficha. */
export function clasificar(naturaleza: Naturaleza, sitio: Sitio | "" | undefined, material: string) {
  if (naturaleza === "Profunda") {
    const corto = material.replace(/\s*\(.*\)$/, "").replace(/ \/.*$/, "");
    return { tipoMuestra: corto || "—", tipoAnalisis: "Micosis profunda" as const };
  }
  if (sitio === "Uñas") return { tipoMuestra: "Uñas", tipoAnalisis: "Micosis ungueal" as const };
  if (sitio === "Cuero cabelludo") return { tipoMuestra: "Cabello", tipoAnalisis: "Micosis superficial" as const };
  return { tipoMuestra: "Piel", tipoAnalisis: "Micosis superficial" as const };
}

/* ─── Observaciones / revisiones ────────────────────────── */
export interface Hallazgo {
  fecha: string;
  tipo: "Observación" | "Nota";
  texto: string;
  usuario?: string;
}
export type CondicionMuestra = "Óptimas condiciones" | "Con observaciones" | "Deteriorada o contaminada";
export interface Revision {
  fecha: string; // dd/mm/yyyy
  hora: string;
  responsable: string;
  condicion: CondicionMuestra;
  nota: string;
}
export const REVISION_DIAS = 7;
export const DAY = 86400000;

export function estadoRevision(fechaIngreso: string, revisiones: Revision[] = []) {
  const ultima = revisiones[revisiones.length - 1];
  const base = parseDate(ultima?.fecha ?? fechaIngreso);
  const proxima = new Date(base.getTime() + REVISION_DIAS * DAY);
  const hoy = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate());
  const dias = Math.round((proxima.getTime() - hoy.getTime()) / DAY);
  const tone = dias < 0 ? ("red" as const) : dias <= 1 ? ("amber" as const) : ("green" as const);
  const label = dias < 0 ? `Vencida hace ${-dias} d` : dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Al día · faltan ${dias} d`;
  return { ultima, proxima: fmtDate(proxima), dias, tone, label };
}

/* ─── Resultados ────────────────────────────────────────── */
export type ResED = "" | "Positivo" | "Negativo";
export type ResCultivo = "" | "Positivo" | "Negativo" | "Contaminado";
export type ResInmuno = "" | "Reactivo" | "No reactivo" | "Indeterminado";
export interface Determinacion {
  fecha: string; // ISO yyyy-mm-dd (form)
  ed: ResED;
  edElementos: string[];
  edDetalle: string;
  cultivo: ResCultivo;
  medios: string[];
  cultivoDetalle: string;
  identificacion: string;
  identificacionOtro: string;
}
export interface Resultado {
  material: string;
  determinaciones: Determinacion[];
  inmuno: { prueba: string; resultado: ResInmuno; titulo: string }[];
  diagnostico: string;
  interpretacion: string;
  recomendaciones: string;
  guardado: string; // dd/mm/yyyy hh:mm
  guardadoPor: string;
  validado?: { por: string; fecha: string };
}

export const ED_ELEMENTOS: Record<Naturaleza, string[]> = {
  Superficial: ["Hifas hialinas tabicadas", "Artroconidias", "Esporos ectothrix", "Esporos endothrix", "Levaduras", "Pseudohifas", "Levaduras y filamentos cortos", "Hifas dematiáceas"],
  Profunda: ["Levaduras multibrotantes", "Levaduras capsuladas", "Levaduras intracelulares pequeñas", "Hifas hialinas tabicadas", "Hifas cenocíticas", "Células fumagoides", "Esférulas", "Cuerpos asteroides"],
};
export const MEDIOS = ["Agar Sabouraud glucosado", "Sabouraud + cloranfenicol + cicloheximida", "Lactrimel", "Agar papa dextrosa", "Agar BHI", "CHROMagar Candida"];
export const AGENTES: Record<Naturaleza, string[]> = {
  Superficial: ["Trichophyton rubrum", "Trichophyton mentagrophytes", "Trichophyton tonsurans", "Microsporum canis", "Nannizzia gypsea", "Epidermophyton floccosum", "Candida albicans", "Candida parapsilosis", "Malassezia spp.", "Fusarium spp.", "Scopulariopsis brevicaulis", "Neoscytalidium dimidiatum"],
  Profunda: ["Paracoccidioides brasiliensis", "Histoplasma capsulatum", "Cryptococcus neoformans", "Cryptococcus gattii", "Aspergillus fumigatus", "Aspergillus flavus", "Aspergillus niger", "Sporothrix schenckii", "Candida albicans", "Candida spp.", "Mucorales", "Fonsecaea pedrosoi"],
};
export const OTRO_AGENTE = "Otro (especificar)";

export const nuevaDeterminacion = (fecha: string): Determinacion => ({
  fecha, ed: "", edElementos: [], edDetalle: "", cultivo: "", medios: [], cultivoDetalle: "", identificacion: "", identificacionOtro: "",
});
export const agenteDe = (d: Determinacion) => (d.identificacion === OTRO_AGENTE ? d.identificacionOtro.trim() : d.identificacion);

/** Naturaleza para análisis sin ficha digital (datos históricos). */
export const naturalezaDe = (tipoAnalisis: string, ficha?: Ficha): Naturaleza => ficha?.naturaleza ?? (tipoAnalisis === "Micosis profunda" ? "Profunda" : "Superficial");
export const sitioDe = (tipoMuestra: string, ficha?: Ficha): Sitio | undefined =>
  ficha?.sitio ?? (tipoMuestra === "Uñas" ? "Uñas" : tipoMuestra === "Cabello" ? "Cuero cabelludo" : tipoMuestra === "Piel" ? "Piel lampiña" : undefined);
