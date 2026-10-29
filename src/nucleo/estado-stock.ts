// Estado del stock → chip, igual que el ERP (docs/diseno-visual.md: BAJO error, JUSTO atención,
// OK éxito). El estado lo calcula Materiales al leer; la app solo lo muestra.
import type { EstadoStock } from '../api/materiales';

export type TonoEstado = 'exito' | 'atencion' | 'error';

const PRESENTACION: Record<EstadoStock, { etiqueta: string; tono: TonoEstado }> = {
  BAJO: { etiqueta: 'Bajo', tono: 'error' },
  JUSTO: { etiqueta: 'Justo', tono: 'atencion' },
  OK: { etiqueta: 'OK', tono: 'exito' },
};

export function presentacionEstadoStock(estado: EstadoStock): { etiqueta: string; tono: TonoEstado } {
  return PRESENTACION[estado];
}

/** Regla de los estados (docs/reglas-negocio.md, «Materiales»), el mismo texto que en el ERP. */
export const AYUDA_ESTADOS_STOCK =
  'Bajo: menos que el mínimo · Justo: entre el mínimo y 125 % del mínimo · OK: más de 125 % del mínimo.';

export const MENSAJE_STOCK_VACIO =
  'Esta obra todavía no tiene materiales con movimientos ni mínimo definido.';
