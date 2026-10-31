// Lógica del registro de un ingreso o una salida de material (004, con la cola de la 101): los avisos
// de stock superado y periodo cerrado. Funciones puras, probadas en movimiento.test.ts.
import type { Material, MovimientoRegistrado, RegistroMovimiento } from '../api/materiales';
import { formatearCantidad, formatearCantidadMaterial } from '../nucleo/formato';

export const MENSAJE_REGISTRADO = 'Registrado';

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
  return textoSuperaStock(movimiento.stock.cantidad + registro.cantidad, unidades);
}

/**
 * El mismo aviso cuando el registro quedó guardado en el celular sin respuesta del servidor (101,
 * criterio 10): la salida supera el stock que mostraba la app (con los movimientos sin enviar).
 */
export function avisoSuperaStockLocal(
  registro: Pick<RegistroMovimiento, 'tipo' | 'cantidad'>,
  stockMostrado: number,
  unidades?: Unidades,
): string | null {
  if (registro.tipo !== 'SALIDA' || registro.cantidad <= stockMostrado) {
    return null;
  }
  return textoSuperaStock(stockMostrado, unidades);
}

function textoSuperaStock(stock: number, unidades?: Unidades): string {
  const texto = unidades
    ? formatearCantidadMaterial(stock, unidades.unidad, unidades.unidadPlural)
    : formatearCantidad(stock, '').trim();
  return `La salida supera el stock registrado (stock: ${texto}). Queda como alerta para revisión`;
}
