// Campos de una entrada del diario de obra (103, criterios 1 y 2), validados con Zod.
import { z } from 'zod';

import { CLIMAS, type Clima } from '../nucleo/clima';

export const TEXTO_MINIMO = 10;
export const TEXTO_MAXIMO = 2000;

export type ValoresDiario = {
  /** `AAAA-MM-DD`: hoy o uno de los 7 días anteriores en La Paz. */
  fecha: string;
  /** Uno de `CLIMAS`; vacío mientras no se elige. */
  clima: string;
  texto: string;
};

export const MENSAJES_DIARIO = {
  fecha: 'Elige la fecha.',
  clima: 'Elige el clima.',
  textoCorto: `Escribe al menos ${TEXTO_MINIMO} caracteres.`,
  textoLargo: `Escribe hasta ${TEXTO_MAXIMO} caracteres.`,
} as const;

/** Largo del texto como lo cuenta Obras: sin los espacios de los costados. */
export const largoTexto = (texto: string) => texto.trim().length;

export const esquemaDiario = z.object({
  fecha: z.string().min(1, MENSAJES_DIARIO.fecha),
  clima: z.string().refine((c) => (CLIMAS as readonly string[]).includes(c), MENSAJES_DIARIO.clima),
  texto: z
    .string()
    .refine((t) => largoTexto(t) >= TEXTO_MINIMO, MENSAJES_DIARIO.textoCorto)
    .refine((t) => largoTexto(t) <= TEXTO_MAXIMO, MENSAJES_DIARIO.textoLargo),
});

/** `datos` de la operación `ENTRADA_DIARIO`: `{ id, obraId, fecha, clima, texto }` (texto sin espacios a los costados). */
export function aEntradaDiario(valores: ValoresDiario, datos: { id: string; obraId: string }) {
  if (!(CLIMAS as readonly string[]).includes(valores.clima)) {
    throw new Error('Falta el clima');
  }
  const clima = valores.clima as Clima;
  return { id: datos.id, obraId: datos.obraId, fecha: valores.fecha, clima, texto: valores.texto.trim() };
}
