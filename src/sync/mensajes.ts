// Textos de la app sin señal (101; docs/mensajes.md de la carpeta general, «App sin señal»).
import { mensajeDeFallo, mensajePeriodoCerrado } from '../api/errores';
import { ETIQUETA_CLIMA, type Clima } from '../nucleo/clima';
import { formatearCantidadMaterial, formatearDiaHora, formatearDiaMes, periodoLaPaz } from '../nucleo/formato';
import type { EstadoOperacion, Operacion } from './cola';
import type { EstadoEntrada } from './diario-local';

/** Primer uso sin señal: nunca se descargó el paquete (criterio 4). */
export const MENSAJE_PRIMERA_VEZ_SIN_SENAL = 'Necesitas señal la primera vez para descargar tus obras';

/** Sin conexión: se trabaja con el paquete guardado (criterio 3), «Sin señal · datos del 15/11 14:30». */
export function mensajeSinSenal(descargadoEn: string): string {
  return `Sin señal · datos del ${formatearDiaHora(descargadoEn)}`;
}

/** El stock incluye movimientos de la cola (criterio 9). */
export function mensajeIncluyeSinEnviar(n: number): string {
  return `Incluye ${n} ${n === 1 ? 'movimiento' : 'movimientos'} sin enviar`;
}

/** El servidor no confirmó el registro en 5 s (criterio 8). */
export const MENSAJE_GUARDADO_EN_CELULAR = 'Guardado en el celular · se enviará cuando haya señal';

/** Estado de un registro en «Pendientes de envío» (criterio 16). */
export const ETIQUETA_ESTADO: Record<EstadoOperacion, string> = {
  PENDIENTE: 'Pendiente',
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  RECHAZADO: 'Rechazado',
};

/** Descripción de una entrada del diario en «Pendientes de envío» (103): «Diario · 15/11 · Lluvia leve». */
export function descripcionDiario(fecha: string, clima: Clima): string {
  return `Diario · ${formatearDiaMes(fecha)} · ${ETIQUETA_CLIMA[clima]}`;
}

/** Ya hay una entrada ese día, en el celular o en el servidor (103, criterio 4). */
export function mensajeDiarioYaRegistrado(fecha: string): string {
  return `Ya registraste el diario del ${formatearDiaMes(fecha)}`;
}

/** Marca de una entrada del diario en su pantalla (103, criterio 7); las enviadas no llevan marca. */
export const ETIQUETA_ENTRADA: Record<EstadoEntrada, string | null> = {
  ENVIADA: null,
  SIN_ENVIAR: 'Sin enviar',
  RECHAZADA: 'Rechazada',
};

/** Confirmación de «Descartar» (criterio 17). */
export const MENSAJE_CONFIRMAR_DESCARTE = '¿Descartar este registro? No se enviará y no se podrá recuperar.';

/** «Pendientes de envío» sin registros (estado vacío; texto de la app, falta en el catálogo). */
export const MENSAJE_SIN_PENDIENTES = 'No hay registros pendientes de envío.';

/** Descripción de una foto de avance en «Pendientes de envío» (102): «Foto de avance · P-01 · Losa…». */
export function descripcionFoto(partida?: { codigo: string; nombre: string } | null): string {
  return partida ? `Foto de avance · ${partida.codigo} · ${partida.nombre}` : 'Foto de avance';
}

/** Foto subiéndose a S3 en «Pendientes de envío» (102, criterio 7). */
export const MENSAJE_SUBIENDO_FOTO = 'Subiendo foto…';

/** Con más de estas fotos sin enviar en el celular se avisa (102, criterio 3). */
export const FOTOS_SIN_ENVIAR_PARA_AVISAR = 100;

/** 102, criterio 3 (no impide tomar más). */
export function mensajeFotosSinEnviar(n: number): string {
  return `Tienes ${n} fotos sin enviar; busca señal para enviarlas`;
}

/** Pendientes de otro usuario en el celular (criterio 15). */
export function mensajePendientesDeOtro(n: number, nombre: string): string {
  return `Hay ${n} ${n === 1 ? 'registro' : 'registros'} de ${nombre} sin enviar; se enviarán cuando esa persona vuelva a iniciar sesión`;
}

/** Botón de un movimiento rechazado por `PERIODO_CERRADO` (criterio 14b). */
export const TEXTO_REGISTRAR_CON_FECHA_DE_HOY = 'Registrar con fecha de hoy';

/** Si a un rechazo se le puede ofrecer «Registrar con fecha de hoy» (criterio 14b). */
export function sePuedeRegistrarHoy(op: Pick<Operacion, 'estado' | 'tipo' | 'errorCodigo'>): boolean {
  return op.estado === 'RECHAZADO' && op.tipo === 'MOVIMIENTO_MATERIAL' && op.errorCodigo === 'PERIODO_CERRADO';
}

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
