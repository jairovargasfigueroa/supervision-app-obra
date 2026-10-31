// Stock que muestra la app sin señal (101, criterio 9): el del paquete de datos más los movimientos de
// la cola que todavía no llegaron al servidor (`PENDIENTE` y `ENVIANDO`): los ingresos suman y las
// salidas restan. Los `ENVIADO` ya están en el paquete (el enviador lo actualiza con la respuesta).
import type { EstadoStock } from '../api/materiales';
import type { ObraPaquete } from '../api/sincronizacion';
import type { Operacion } from './cola';

export type StockLocal = { materialId: string; cantidad: number; minimo: number; estado: EstadoStock };

/**
 * Estado del stock (docs/reglas-negocio.md, «Materiales»): `BAJO` si cantidad < mínimo; `JUSTO` si
 * mínimo ≤ cantidad ≤ 1,25 × mínimo; `OK` si cantidad > 1,25 × mínimo.
 */
export function estadoStock(cantidad: number, minimo: number): EstadoStock {
  if (cantidad < minimo) {
    return 'BAJO';
  }
  return cantidad <= 1.25 * minimo ? 'JUSTO' : 'OK';
}

/** Redondeo a 3 decimales (lo que admite una cantidad), para que 0,1 + 0,2 dé 0,3. */
const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Movimiento de material de la cola que todavía no se envió, con su efecto en el stock. */
function movimientoSinEnviar(op: Operacion, obraId: string): { materialId: string; delta: number } | null {
  if (op.tipo !== 'MOVIMIENTO_MATERIAL' || op.obraId !== obraId) {
    return null;
  }
  if (op.estado !== 'PENDIENTE' && op.estado !== 'ENVIANDO') {
    return null;
  }
  const { materialId, tipo, cantidad } = op.datos;
  if (typeof materialId !== 'string' || typeof cantidad !== 'number') {
    return null;
  }
  if (tipo === 'INGRESO') {
    return { materialId, delta: cantidad };
  }
  return tipo === 'SALIDA' ? { materialId, delta: -cantidad } : null;
}

/**
 * Stock de la obra con los movimientos sin enviar, en el orden del paquete (los materiales que solo
 * tienen movimientos sin enviar van al final, con mínimo 0), y cuántos movimientos sin enviar incluye.
 */
export function stockConPendientes(
  obra: Pick<ObraPaquete, 'id' | 'stock'>,
  operaciones: readonly Operacion[],
): { filas: StockLocal[]; sinEnviar: number } {
  const filas = new Map<string, StockLocal>(
    obra.stock.map((s) => [
      s.materialId,
      { materialId: s.materialId, cantidad: s.cantidad, minimo: s.minimo, estado: s.estado },
    ]),
  );
  let sinEnviar = 0;
  for (const op of operaciones) {
    const movimiento = movimientoSinEnviar(op, obra.id);
    if (!movimiento) {
      continue;
    }
    sinEnviar++;
    const fila = filas.get(movimiento.materialId) ?? {
      materialId: movimiento.materialId,
      cantidad: 0,
      minimo: 0,
      estado: 'JUSTO' as EstadoStock,
    };
    fila.cantidad = redondear(fila.cantidad + movimiento.delta);
    fila.estado = estadoStock(fila.cantidad, fila.minimo);
    filas.set(movimiento.materialId, fila);
  }
  return { filas: [...filas.values()], sinEnviar };
}
