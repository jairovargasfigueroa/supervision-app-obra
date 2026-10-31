// Espera creciente entre intentos (101, criterio 12), la misma para los lotes y las subidas (102).

/** Espera máxima entre intentos: 5 minutos (criterio 12). */
export const ESPERA_MAXIMA_S = 300;

/**
 * Espera antes del intento siguiente, tras `intentos` fallidos (1, 2, 3…): `min(2^(intentos−1), 300)`
 * segundos por un factor aleatorio entre 0,8 y 1,2, para que los celulares no reintenten todos a la
 * vez (decisión del equipo). `azar` devuelve un número en [0, 1), como `Math.random`.
 */
export function esperaCreciente(intentos: number, azar: () => number = Math.random): number {
  const base = Math.min(2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_S);
  return Math.round(base * 1000 * (0.8 + 0.4 * azar()));
}
