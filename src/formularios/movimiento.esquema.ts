// Campos del ingreso y de la salida de material (004, criterios 2 y 3), validados con Zod. Los
// valores son los textos del formulario; `aRegistro` los convierte en el cuerpo de `POST /movimientos`.
import { z } from 'zod';

import type { RegistroMovimiento, TipoMovimiento } from '../api/materiales';

export type ValoresMovimiento = {
  materialId: string;
  /** Como la escribe el usuario: `12,5` o `12.5`. */
  cantidad: string;
  /** N.º de nota de remisión (solo ingreso, opcional). */
  notaRemision: string;
  /** Partida de destino (solo salida, obligatoria). */
  partidaId: string;
};

export const VALORES_INICIALES: ValoresMovimiento = {
  materialId: '',
  cantidad: '',
  notaRemision: '',
  partidaId: '',
};

export const MENSAJES_CAMPOS = {
  material: 'Elige el material.',
  cantidadFalta: 'Escribe la cantidad.',
  cantidadInvalida: 'Escribe la cantidad con números, por ejemplo 12,5.',
  cantidadCero: 'La cantidad debe ser mayor a 0.',
  cantidadDecimales: 'La cantidad admite hasta 3 decimales.',
  partida: 'Elige la partida de destino.',
} as const;

const NUMERO = /^\d+(?:[.,](\d+))?$/;

type LecturaCantidad =
  | { tipo: 'ok'; valor: number }
  | { tipo: 'falta' | 'invalida' | 'cero' | 'decimales' };

/** Lee la cantidad escrita (coma o punto decimal, sin separador de miles): > 0 y hasta 3 decimales. */
export function leerCantidad(texto: string): LecturaCantidad {
  const limpio = texto.trim();
  if (limpio === '') {
    return { tipo: 'falta' };
  }
  const partes = NUMERO.exec(limpio);
  if (!partes) {
    return { tipo: 'invalida' };
  }
  if ((partes[1]?.length ?? 0) > 3) {
    return { tipo: 'decimales' };
  }
  const valor = Number(limpio.replace(',', '.'));
  return valor > 0 ? { tipo: 'ok', valor } : { tipo: 'cero' };
}

const MENSAJE_CANTIDAD = {
  falta: MENSAJES_CAMPOS.cantidadFalta,
  invalida: MENSAJES_CAMPOS.cantidadInvalida,
  cero: MENSAJES_CAMPOS.cantidadCero,
  decimales: MENSAJES_CAMPOS.cantidadDecimales,
} as const;

const esquemaCantidad = z.string().superRefine((texto, contexto) => {
  const lectura = leerCantidad(texto);
  if (lectura.tipo !== 'ok') {
    contexto.addIssue({ code: 'custom', message: MENSAJE_CANTIDAD[lectura.tipo] });
  }
});

/** Esquema del formulario según el tipo: la salida exige partida; el ingreso, no. */
export function esquemaMovimiento(tipo: TipoMovimiento) {
  return z.object({
    materialId: z.string().min(1, MENSAJES_CAMPOS.material),
    cantidad: esquemaCantidad,
    notaRemision: z.string(),
    partidaId: tipo === 'SALIDA' ? z.string().min(1, MENSAJES_CAMPOS.partida) : z.string(),
  });
}

/**
 * Cuerpo de `POST /movimientos` con los valores ya validados. `notaRemision` va solo en un ingreso
 * y solo si se escribió; `partidaId`, solo en una salida.
 */
export function aRegistro(
  tipo: TipoMovimiento,
  valores: ValoresMovimiento,
  datos: { id: string; obraId: string; registradoEn: string },
): RegistroMovimiento {
  const lectura = leerCantidad(valores.cantidad);
  if (lectura.tipo !== 'ok') {
    throw new Error('La cantidad no es válida');
  }
  const nota = valores.notaRemision.trim();
  return {
    id: datos.id,
    obraId: datos.obraId,
    materialId: valores.materialId,
    tipo,
    cantidad: lectura.valor,
    ...(tipo === 'SALIDA' ? { partidaId: valores.partidaId } : {}),
    ...(tipo === 'INGRESO' && nota ? { notaRemision: { numero: nota } } : {}),
    registradoEn: datos.registradoEn,
  };
}
