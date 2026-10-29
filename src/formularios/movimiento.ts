// Lógica del registro de un ingreso o una salida de material (004): qué registro se envía (y con qué
// `id`), los avisos de stock superado y periodo cerrado, y cómo queda el stock tras registrar.
// Funciones puras, probadas en movimiento.test.ts.
import { falloDe, mensajeDeError, mensajePeriodoCerrado } from '../api/errores';
import type {
  FilaStock,
  Material,
  MovimientoRegistrado,
  RegistroMovimiento,
  TipoMovimiento,
} from '../api/materiales';
import { formatearCantidad, formatearCantidadMaterial, periodoLaPaz } from '../nucleo/formato';
import { aRegistro, type ValoresMovimiento } from './movimiento.esquema';

export const MENSAJE_REGISTRADO = 'Registrado';

/**
 * Qué registro enviar al pulsar «Registrar ingreso» o «Registrar salida» (criterio 6):
 * - si hay uno enviado sin confirmar (`pendiente`) con los mismos datos, ese mismo: mismo `id` y
 *   mismo `registradoEn`. Si el envío anterior sí llegó, Materiales responde `200` sin duplicarlo;
 * - si los datos cambiaron, es otro registro: `id` nuevo;
 * - si no hay pendiente, el `id` creado al abrir el formulario.
 */
export function registroParaEnviar(
  tipo: TipoMovimiento,
  valores: ValoresMovimiento,
  contexto: {
    obraId: string;
    idFormulario: string;
    pendiente: RegistroMovimiento | null;
    ahora: () => Date;
    nuevoId: () => string;
  },
): RegistroMovimiento {
  const { pendiente, obraId } = contexto;
  if (pendiente) {
    const mismo = aRegistro(tipo, valores, {
      id: pendiente.id,
      obraId,
      registradoEn: pendiente.registradoEn,
    });
    if (JSON.stringify(mismo) === JSON.stringify(pendiente)) {
      return pendiente;
    }
  }
  return aRegistro(tipo, valores, {
    id: pendiente ? contexto.nuevoId() : contexto.idFormulario,
    obraId,
    registradoEn: contexto.ahora().toISOString(),
  });
}

type Unidades = Pick<Material, 'unidad' | 'unidadPlural'>;

/**
 * Aviso del criterio 5 si la salida superó el stock: «La salida supera el stock registrado
 * (stock: 8 bolsas). Queda como alerta para revisión». El stock es el que había antes de la salida
 * (el que Materiales comparó): el que queda más la cantidad que salió.
 */
export function avisoSuperaStock(
  registro: Pick<RegistroMovimiento, 'tipo' | 'cantidad'>,
  movimiento: Pick<MovimientoRegistrado, 'superaStock' | 'stock'>,
  unidades?: Unidades,
): string | null {
  if (registro.tipo !== 'SALIDA' || !movimiento.superaStock) {
    return null;
  }
  const previo = movimiento.stock.cantidad + registro.cantidad;
  const stock = unidades
    ? formatearCantidadMaterial(previo, unidades.unidad, unidades.unidadPlural)
    : formatearCantidad(previo, '').trim();
  return `La salida supera el stock registrado (stock: ${stock}). Queda como alerta para revisión`;
}

/**
 * Texto de un registro que falló. `PERIODO_CERRADO` (criterio 7) lleva el periodo del movimiento,
 * el mes de `registradoEn` en La Paz, igual que lo calcula Materiales.
 */
export function mensajeFalloMovimiento(error: unknown, registro: Pick<RegistroMovimiento, 'registradoEn'>): string {
  const fallo = falloDe(error);
  if (fallo.tipo === 'http' && fallo.codigo === 'PERIODO_CERRADO') {
    return mensajePeriodoCerrado(periodoLaPaz(registro.registradoEn));
  }
  return mensajeDeError(error);
}

/** Stock de la obra con la fila del material actualizada con lo que devolvió el registro (criterio 4). */
export function actualizarFilaStock(
  filas: readonly FilaStock[],
  materialId: string,
  stock: MovimientoRegistrado['stock'],
): FilaStock[] {
  return filas.map((fila) =>
    fila.materialId === materialId
      ? { ...fila, cantidad: stock.cantidad, minimo: stock.minimo, estado: stock.estado }
      : fila,
  );
}
