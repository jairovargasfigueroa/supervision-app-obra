// Anclas del detector de personas (301). El EfficientDet-Lite0 que publica MediaPipe no trae el
// posproceso dentro del modelo: sus dos salidas son los puntajes por ancla y clase, y las cajas
// codificadas respecto de cada ancla; MediaPipe las decodifica con las anclas fijas que guarda en los
// metadatos del archivo (`DETECTOR_METADATA`). Aquí se generan con la misma regla, comprobada contra
// esos metadatos (19 206 anclas, diferencia máxima 1,2e-7): niveles 3 a 7 (pasos de 8 a 128 px sobre
// 320 px), y en cada celda 3 escalas (2^0, 2^(1/3) y 2^(2/3)) por 3 proporciones (1, 2 y 0,5), con
// tamaño base 3 / celdas.

export const LADO_DETECTOR = 320;
const NIVELES = [3, 4, 5, 6, 7] as const;
const ESCALAS = [0, 1 / 3, 2 / 3].map((octava) => 2 ** octava);
const PROPORCIONES = [1, 2, 0.5];
const TAMANO_BASE = 3;

/** Valores por ancla: centro x, centro y, ancho y alto, normalizados a 0–1. */
export const VALORES_POR_ANCLA = 4;

let anclas: Float32Array | null = null;

/**
 * Anclas en el orden de las salidas del modelo: por nivel, por fila (y), por columna (x), por escala y
 * por proporción. Se calculan una sola vez.
 */
export function anclasDetector(): Float32Array {
  if (anclas) {
    return anclas;
  }
  const valores: number[] = [];
  for (const nivel of NIVELES) {
    const celdas = Math.ceil(LADO_DETECTOR / 2 ** nivel);
    for (let y = 0; y < celdas; y++) {
      for (let x = 0; x < celdas; x++) {
        for (const escala of ESCALAS) {
          const base = (TAMANO_BASE / celdas) * escala;
          for (const proporcion of PROPORCIONES) {
            const raiz = Math.sqrt(proporcion);
            valores.push((x + 0.5) / celdas, (y + 0.5) / celdas, base * raiz, base / raiz);
          }
        }
      }
    }
  }
  anclas = Float32Array.from(valores);
  return anclas;
}
