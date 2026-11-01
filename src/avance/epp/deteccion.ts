// Funciones puras del análisis de casco y chaleco (301): decodificar las personas del detector, quedarse
// con las que se pueden clasificar, recortarlas y contar quién no lleva casco o chaleco. Sin modelos ni
// imágenes: se prueban en deteccion.test.ts.
import { anclasDetector, VALORES_POR_ANCLA } from './anclas';

/** Índice de «person» entre las 90 clases de COCO del detector (`labels.txt` de sus metadatos). */
export const INDICE_PERSONA = 0;
/** Puntaje mínimo de una persona (diseño, «Flujo en la app»). */
export const PUNTAJE_MINIMO = 0.5;
/** Superposición (IoU) a partir de la cual dos cajas son la misma persona. */
export const SUPERPOSICION_MAXIMA = 0.5;
/** Alto mínimo de una persona en la foto: más chica no tiene detalle para clasificarla. */
export const ALTO_MINIMO_PX = 64;
/** Personas que se clasifican como máximo (las de mayor puntaje). */
export const MAXIMO_PERSONAS = 10;
/** Margen del recorte de cada persona, por lado (el mismo del entrenamiento). */
export const MARGEN_RECORTE = 0.1;

/** Caja normalizada (0–1) con su puntaje. */
export type CajaNormalizada = { x0: number; y0: number; x1: number; y1: number; puntaje: number };

/** Caja en píxeles de la foto. */
export type Caja = { x: number; y: number; ancho: number; alto: number };

export type PersonaDetectada = Caja & { puntaje: number };

/** Persona clasificada: lo que se dibuja sobre la vista previa. */
export type PersonaEpp = Caja & { sinCasco: boolean; sinChaleco: boolean };

export type Umbrales = { casco: number; chaleco: number };

const limitar = (valor: number) => Math.min(Math.max(valor, 0), 1);

/**
 * Personas del detector con puntaje ≥ `puntajeMinimo`: lee la columna de «person» de los puntajes
 * (`[anclas × clases]`, ya entre 0 y 1) y decodifica su caja (`[anclas × 4]`: centro y, centro x, alto y
 * ancho respecto del ancla, con exponencial en el tamaño, como `TensorsToDetections` de MediaPipe).
 */
export function decodificarPersonas(
  puntajes: Float32Array,
  cajas: Float32Array,
  clases: number,
  puntajeMinimo = PUNTAJE_MINIMO,
  anclas: Float32Array = anclasDetector(),
): CajaNormalizada[] {
  const total = anclas.length / VALORES_POR_ANCLA;
  if (puntajes.length < total * clases || cajas.length < total * 4) {
    throw new Error('Las salidas del detector no tienen el tamaño esperado');
  }
  const personas: CajaNormalizada[] = [];
  for (let i = 0; i < total; i++) {
    const puntaje = puntajes[i * clases + INDICE_PERSONA]!;
    if (!(puntaje >= puntajeMinimo)) {
      continue;
    }
    const a = i * VALORES_POR_ANCLA;
    const ax = anclas[a]!;
    const ay = anclas[a + 1]!;
    const aw = anclas[a + 2]!;
    const ah = anclas[a + 3]!;
    const c = i * 4;
    const cy = cajas[c]! * ah + ay;
    const cx = cajas[c + 1]! * aw + ax;
    const alto = Math.exp(cajas[c + 2]!) * ah;
    const ancho = Math.exp(cajas[c + 3]!) * aw;
    personas.push({
      x0: limitar(cx - ancho / 2),
      y0: limitar(cy - alto / 2),
      x1: limitar(cx + ancho / 2),
      y1: limitar(cy + alto / 2),
      puntaje,
    });
  }
  return personas;
}

/** Intersección sobre unión de dos cajas normalizadas. */
export function superposicion(a: CajaNormalizada, b: CajaNormalizada): number {
  const ancho = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const alto = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ancho <= 0 || alto <= 0) {
    return 0;
  }
  const interseccion = ancho * alto;
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - interseccion;
  return union > 0 ? interseccion / union : 0;
}

/**
 * Supresión de no máximos: de mayor a menor puntaje, una caja se queda si no se superpone más de
 * `maxima` con otra ya elegida (varias anclas ven a la misma persona).
 */
export function suprimirNoMaximos(
  cajas: readonly CajaNormalizada[],
  maxima = SUPERPOSICION_MAXIMA,
): CajaNormalizada[] {
  const elegidas: CajaNormalizada[] = [];
  for (const caja of [...cajas].sort((a, b) => b.puntaje - a.puntaje)) {
    if (elegidas.every((otra) => superposicion(caja, otra) <= maxima)) {
      elegidas.push(caja);
    }
  }
  return elegidas;
}

/**
 * Personas que se clasifican: las cajas en píxeles de la foto (`ancho` × `alto`), sin las de alto menor
 * a 64 px y, como máximo, las 10 de mayor puntaje.
 */
export function personasParaClasificar(
  cajas: readonly CajaNormalizada[],
  ancho: number,
  alto: number,
  altoMinimo = ALTO_MINIMO_PX,
  maximo = MAXIMO_PERSONAS,
): PersonaDetectada[] {
  return [...cajas]
    .sort((a, b) => b.puntaje - a.puntaje)
    .map((c) => ({
      x: c.x0 * ancho,
      y: c.y0 * alto,
      ancho: (c.x1 - c.x0) * ancho,
      alto: (c.y1 - c.y0) * alto,
      puntaje: c.puntaje,
    }))
    .filter((p) => p.alto >= altoMinimo)
    .slice(0, maximo);
}

/**
 * Recorte de una persona con 10 % de margen por lado, dentro de la foto y en píxeles enteros (la misma
 * regla que `caja_recorte` de `preparar_recortes.py`, para que el clasificador vea lo mismo que en el
 * entrenamiento).
 */
export function cajaRecorte(persona: Caja, ancho: number, alto: number, margen = MARGEN_RECORTE): Caja {
  // La tolerancia evita que un error de redondeo (100 × 1,1 = 110,00000000000001) sume un píxel.
  const abajo = (v: number) => Math.floor(v + 1e-6);
  const arriba = (v: number) => Math.ceil(v - 1e-6);
  const x0 = Math.max(abajo(persona.x - persona.ancho * margen), 0);
  const y0 = Math.max(abajo(persona.y - persona.alto * margen), 0);
  const x1 = Math.min(arriba(persona.x + persona.ancho * (1 + margen)), ancho);
  const y1 = Math.min(arriba(persona.y + persona.alto * (1 + margen)), alto);
  return { x: x0, y: y0, ancho: Math.max(x1 - x0, 1), alto: Math.max(y1 - y0, 1) };
}

/** Probabilidades del clasificador para una persona: de llevar casco y de llevar chaleco. */
export type Probabilidades = { casco: number; chaleco: number };

/**
 * Cada persona lleva casco si `p_casco ≥ umbral_casco` y chaleco si `p_chaleco ≥ umbral_chaleco`; se
 * cuentan las que no.
 */
export function contarEpp(
  personas: readonly (Caja & { probabilidades: Probabilidades })[],
  umbrales: Umbrales,
): { personas: number; sinCasco: number; sinChaleco: number; cajas: PersonaEpp[] } {
  const cajas = personas.map(({ x, y, ancho, alto, probabilidades }) => ({
    x,
    y,
    ancho,
    alto,
    sinCasco: !(probabilidades.casco >= umbrales.casco),
    sinChaleco: !(probabilidades.chaleco >= umbrales.chaleco),
  }));
  return {
    personas: cajas.length,
    sinCasco: cajas.filter((c) => c.sinCasco).length,
    sinChaleco: cajas.filter((c) => c.sinChaleco).length,
    cajas,
  };
}

/**
 * Píxeles decodificados (RGB o RGBA, un byte por canal) → RGB para el modelo: `uint8` para el detector
 * y `float32` de 0 a 255 para el clasificador (su preprocesado va dentro del modelo).
 */
export function pixelesRgb(datos: Uint8Array, canales: 3 | 4, tipo: 'uint8'): Uint8Array;
export function pixelesRgb(datos: Uint8Array, canales: 3 | 4, tipo: 'float32'): Float32Array;
export function pixelesRgb(
  datos: Uint8Array,
  canales: 3 | 4,
  tipo: 'uint8' | 'float32',
): Uint8Array | Float32Array {
  const pixeles = Math.floor(datos.length / canales);
  const salida = tipo === 'uint8' ? new Uint8Array(pixeles * 3) : new Float32Array(pixeles * 3);
  if (canales === 3) {
    salida.set(datos.subarray(0, pixeles * 3));
    return salida;
  }
  for (let i = 0; i < pixeles; i++) {
    const j = i * 4;
    const k = i * 3;
    salida[k] = datos[j]!;
    salida[k + 1] = datos[j + 1]!;
    salida[k + 2] = datos[j + 2]!;
  }
  return salida;
}
