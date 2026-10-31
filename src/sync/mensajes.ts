// Textos de la app sin señal (101; docs/mensajes.md de la carpeta general, «App sin señal»).
import { mensajeDeFallo, mensajePeriodoCerrado } from '../api/errores';
import { formatearCantidadMaterial, periodoLaPaz } from '../nucleo/formato';
import type { Operacion } from './cola';

/** Primer uso sin señal: nunca se descargó el paquete (criterio 4). */
export const MENSAJE_PRIMERA_VEZ_SIN_SENAL = 'Necesitas señal la primera vez para descargar tus obras';

/** El servidor no confirmó el registro en 5 s (criterio 8). */
export const MENSAJE_GUARDADO_EN_CELULAR = 'Guardado en el celular · se enviará cuando haya señal';

/** Cerrar sesión con pendientes (criterio 18). */
export function mensajePendientesAlCerrar(n: number): string {
  return `Tienes ${n} ${n === 1 ? 'registro' : 'registros'} sin enviar; se enviarán cuando vuelvas a iniciar sesión con este usuario`;
}

/**
 * Descripción corta de un movimiento para «Pendientes de envío» (criterio 16):
 * «{tipo} · {cantidad} {unidad} de {material} · {partida}», sin la partida en un ingreso.
 */
export function descripcionMovimiento(
  tipo: 'INGRESO' | 'SALIDA',
  cantidad: number,
  material: { nombre: string; unidad: string; unidadPlural: string },
  partida?: { codigo: string } | null,
): string {
  const texto = `${tipo === 'INGRESO' ? 'Ingreso' : 'Salida'} · ${formatearCantidadMaterial(
    cantidad,
    material.unidad,
    material.unidadPlural,
  )} de ${material.nombre}`;
  return partida ? `${texto} · ${partida.codigo}` : texto;
}

/**
 * Motivo de un registro rechazado, según su `codigo` (diseño, «Mensajes de rechazo»):
 * `PERIODO_CERRADO` con el periodo del movimiento; los demás, el texto de su código o el genérico de
 * su estado HTTP. El `detail` del servicio no se muestra.
 */
export function mensajeRechazo(op: Pick<Operacion, 'errorCodigo' | 'respuesta' | 'datos'>): string {
  const codigo = op.errorCodigo ?? 'DATOS_INVALIDOS';
  if (codigo === 'PERIODO_CERRADO' && typeof op.datos.registradoEn === 'string') {
    return mensajePeriodoCerrado(periodoLaPaz(op.datos.registradoEn));
  }
  const estado =
    typeof op.respuesta === 'object' && op.respuesta !== null && 'status' in op.respuesta && typeof op.respuesta.status === 'number'
      ? op.respuesta.status
      : 400;
  return mensajeDeFallo({ tipo: 'http', estado, codigo });
}
