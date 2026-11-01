// Textos del análisis de casco y chaleco (301, criterios 1, 2, 4, 5 y 10), tal cual la spec.
import type { DeteccionEpp } from './analisis';

export const MENSAJE_ANALIZANDO = 'Analizando…';
export const MENSAJE_AVISO_EPP = 'Hay personas sin equipo de protección. Recuerda el uso de casco y chaleco.';
export const MENSAJE_SIN_PERSONAS = 'No se detectaron personas';
export const MENSAJE_ANALISIS_FALLIDO = 'No se pudo analizar la foto';
/** Explicación en el control de seguridad (texto propio de la app, criterio 11). */
export const MENSAJE_CONTROL_SIN_ENVIO = 'La foto se analiza en el celular y no se envía ni se guarda.';
/** Etiqueta de accesibilidad de cada recuadro (texto propio de la app). */
export const ETIQUETA_RECUADRO = 'Persona sin equipo de protección';

/** «Personas: 4 · Sin casco: 1 · Sin chaleco: 2». */
export function resumenEpp({ personas, sinCasco, sinChaleco }: Pick<DeteccionEpp, 'personas' | 'sinCasco' | 'sinChaleco'>): string {
  return `Personas: ${personas} · Sin casco: ${sinCasco} · Sin chaleco: ${sinChaleco}`;
}

/** Hay que avisar si al menos una persona no lleva casco o chaleco (criterio 2). */
export function hayFaltaDeEpp({ sinCasco, sinChaleco }: Pick<DeteccionEpp, 'sinCasco' | 'sinChaleco'>): boolean {
  return sinCasco > 0 || sinChaleco > 0;
}
