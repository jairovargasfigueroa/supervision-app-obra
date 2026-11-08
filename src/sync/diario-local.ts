// Diario de obra en el celular (103): las entradas del paquete (las que ya están en el servidor, últimos
// 30 días) más las operaciones `ENTRADA_DIARIO` de la cola de esa obra. Lógica pura.
import type { ObraPaquete } from '../api/sincronizacion';
import { CLIMAS, type Clima } from '../nucleo/clima';
import { fechaLaPaz, restarDias } from '../nucleo/formato';
import type { Operacion } from './cola';

/** Días que se ven en la pantalla (criterio 7). */
export const DIAS_DIARIO = 30;
/** Días hacia atrás que se pueden elegir al registrar, además de hoy (criterio 2). */
export const DIAS_ATRAS_ELEGIBLES = 7;

export type EstadoEntrada = 'ENVIADA' | 'SIN_ENVIAR' | 'RECHAZADA';

export type EntradaDiario = {
  id: string;
  fecha: string;
  clima: Clima;
  texto: string;
  estado: EstadoEntrada;
  /** La operación de la cola, si la entrada salió del celular (para corregirla o ver el motivo). */
  operacion: Operacion | null;
};

/** Los datos de una operación `ENTRADA_DIARIO`, si tienen la forma esperada. */
export function datosDiario(op: Operacion): { fecha: string; clima: Clima; texto: string } | null {
  const { fecha, clima, texto } = op.datos;
  if (typeof fecha !== 'string' || typeof texto !== 'string' || !CLIMAS.includes(clima as Clima)) {
    return null;
  }
  return { fecha, clima: clima as Clima, texto };
}

/**
 * Entradas de la obra de los últimos 30 días (hoy en La Paz incluido), de la más reciente a la más
 * antigua. Las de la cola `PENDIENTE` o `ENVIANDO` van «Sin enviar», las `RECHAZADO` «Rechazada»; una
 * `ENVIADO` que el paquete todavía no trae se muestra como enviada.
 */
export function entradasDeObra(
  obra: Pick<ObraPaquete, 'id' | 'diario'>,
  operaciones: readonly Operacion[],
  ahora: Date = new Date(),
): EntradaDiario[] {
  const desde = restarDias(fechaLaPaz(ahora), DIAS_DIARIO - 1);
  const entradas = new Map<string, EntradaDiario>();
  for (const e of obra.diario ?? []) {
    entradas.set(e.id, { id: e.id, fecha: e.fecha, clima: e.clima, texto: e.texto, estado: 'ENVIADA', operacion: null });
  }
  for (const op of operaciones) {
    if (op.tipo !== 'ENTRADA_DIARIO' || op.obraId !== obra.id) {
      continue;
    }
    const datos = datosDiario(op);
    if (!datos || (op.estado === 'ENVIADO' && entradas.has(op.idOperacion))) {
      continue;
    }
    const estado: EstadoEntrada =
      op.estado === 'RECHAZADO' ? 'RECHAZADA' : op.estado === 'ENVIADO' ? 'ENVIADA' : 'SIN_ENVIAR';
    entradas.set(op.idOperacion, { id: op.idOperacion, ...datos, estado, operacion: op });
  }
  return [...entradas.values()]
    .filter((e) => e.fecha >= desde)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Hoy y los 7 días anteriores en La Paz, de hoy hacia atrás (criterio 2; no hay días futuros). */
export function fechasElegibles(ahora: Date = new Date()): string[] {
  const hoy = fechaLaPaz(ahora);
  return Array.from({ length: DIAS_ATRAS_ELEGIBLES + 1 }, (_, i) => restarDias(hoy, i));
}

/**
 * Una sola entrada por obra y día (criterio 4): la que ya existe ese día en el servidor o en el celular
 * (sin contar las rechazadas ni la que se está corrigiendo), o `null`.
 */
export function entradaDelDia(
  entradas: readonly EntradaDiario[],
  fecha: string,
  excepto?: string | null,
): EntradaDiario | null {
  return entradas.find((e) => e.fecha === fecha && e.estado !== 'RECHAZADA' && e.id !== excepto) ?? null;
}
