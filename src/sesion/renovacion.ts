// Cuándo y cómo renovar el token de acceso (001, criterio 8). Lógica pura: la llamada a Keycloak se
// recibe como función para probarla sin red.
import type { Tokens } from './tokens';

/** Se renueva un minuto antes de que venza (el token de acceso dura 5 minutos). */
export const MARGEN_RENOVACION_S = 60;

export const ahoraEnSegundos = () => Math.floor(Date.now() / 1000);

/** El token de acceso vence (o está por vencer) y hay que renovarlo antes de usarlo. */
export function necesitaRenovar(
  tokens: Pick<Tokens, 'venceEn'>,
  ahora = ahoraEnSegundos(),
  margen = MARGEN_RENOVACION_S,
): boolean {
  return ahora >= tokens.venceEn - margen;
}

/** Milisegundos hasta el momento de renovar (0 si ya hay que hacerlo). */
export function msHastaRenovar(
  tokens: Pick<Tokens, 'venceEn'>,
  ahora = ahoraEnSegundos(),
  margen = MARGEN_RENOVACION_S,
): number {
  return Math.max(0, (tokens.venceEn - margen - ahora) * 1000);
}

/**
 * Keycloak rechazó la renovación (respuesta OAuth con `error`, p. ej. `invalid_grant` porque la
 * sesión terminó): no hay forma de seguir sin volver a iniciar sesión.
 */
export class RenovacionRechazada extends Error {
  constructor(causa?: unknown) {
    super('Keycloak rechazó la renovación del token', { cause: causa });
    this.name = 'RenovacionRechazada';
  }
}

export type ResultadoVigencia =
  | { tipo: 'vigente'; tokens: Tokens; renovado: boolean }
  | { tipo: 'vencida' };

/**
 * Devuelve tokens vigentes: los mismos si no vencen (y no se pide `forzar`), o los renovados con el
 * refresh token.
 * - Sin refresh token, o si Keycloak rechaza la renovación → `vencida` (vuelve al inicio de sesión).
 * - Si falla la red (Keycloak no responde) → lanza el error y la sesión se conserva: no se saca al
 *   usuario por una falla de conexión; se vuelve a intentar en el siguiente uso.
 */
export async function asegurarVigencia(
  tokens: Tokens,
  renovar: (refreshToken: string) => Promise<Tokens>,
  ahora = ahoraEnSegundos(),
  forzar = false,
): Promise<ResultadoVigencia> {
  if (!forzar && !necesitaRenovar(tokens, ahora)) {
    return { tipo: 'vigente', tokens, renovado: false };
  }
  if (!tokens.refreshToken) {
    return { tipo: 'vencida' };
  }
  try {
    const renovados = await renovar(tokens.refreshToken);
    return { tipo: 'vigente', tokens: renovados, renovado: true };
  } catch (error) {
    if (error instanceof RenovacionRechazada) {
      return { tipo: 'vencida' };
    }
    throw error;
  }
}
