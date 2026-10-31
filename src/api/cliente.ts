// Cliente REST de la app: token de la sesión, tiempo máximo, X-Request-Id y errores por `codigo`
// (Problem Details, convenciones «Errores REST»). Sin estado: el token se pide en cada llamada a
// `obtenerToken` de la sesión, que lo renueva si está por vencer.
import { QueryClient } from '@tanstack/react-query';
import type { z } from 'zod';

import { configuracion } from '../nucleo/configuracion';
import { nuevoUuid } from '../nucleo/uuid';
import { codigoGenerico, ErrorApi, esReintentable, falloDe } from './errores';
import { enviar } from './red';

/**
 * `obtenerToken` de `useSesion()`: token vigente o `null` si la sesión terminó. Con `renovar` lo
 * renueva aunque todavía no venza (p. ej. cuando Sincronización avisa `TOKEN_VENCIDO`).
 */
export type ObtenerToken = (opciones?: { renovar?: boolean }) => Promise<string | null>;

/** Tiempo máximo de una llamada a un servicio. */
export const TIEMPO_MAXIMO_MS = 30_000;

export type Respuesta<T> = { estado: number; datos: T };

/**
 * `fetch` con tiempo máximo: si no hay respuesta, `ErrorApi` `red`; si pasa el tiempo, `tiempo`.
 * También lo usa la subida a S3, que no lleva token.
 */
export async function fetchConTiempo(
  url: string,
  init: RequestInit,
  tiempoMaximoMs = TIEMPO_MAXIMO_MS,
): Promise<Response> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), tiempoMaximoMs);
  try {
    return await enviar(url, { ...init, signal: control.signal });
  } catch {
    throw new ErrorApi(control.signal.aborted ? { tipo: 'tiempo' } : { tipo: 'red' });
  } finally {
    clearTimeout(temporizador);
  }
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : undefined;
  } catch {
    return undefined;
  }
}

type Opciones = {
  obtenerToken: ObtenerToken;
  metodo?: 'GET' | 'POST' | 'PUT';
  cuerpo?: unknown;
  /** Encabezados propios del servicio (p. ej. `X-Dispositivo-Id` e `If-None-Match` de Sincronización). */
  encabezados?: Record<string, string>;
  tiempoMaximoMs?: number;
};

/**
 * Llama a un servicio con el token de la sesión. Devuelve el estado (p. ej. para distinguir
 * `201` de `200` en un registro repetido) y el cuerpo JSON; si el servicio responde un error,
 * lanza `ErrorApi` con su `codigo` (o el genérico del estado si no trae uno). `304` (sin cambios,
 * con `If-None-Match`) no es un error: vuelve con `datos` vacío.
 */
export async function pedir<T = unknown>(
  url: string,
  { obtenerToken, metodo = 'GET', cuerpo, encabezados, tiempoMaximoMs }: Opciones,
): Promise<Respuesta<T>> {
  let token: string | null;
  try {
    token = await obtenerToken();
  } catch {
    // La renovación del token no llegó a Keycloak: es un problema de conexión, no de la sesión.
    throw new ErrorApi({ tipo: 'red' });
  }
  if (!token) {
    throw new ErrorApi({ tipo: 'sin-sesion' });
  }

  const requestId = nuevoUuid();
  const respuesta = await fetchConTiempo(url, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-Id': requestId,
      ...encabezados,
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }, tiempoMaximoMs);

  const datos = await leerJson(respuesta);
  if (!respuesta.ok && respuesta.status !== 304) {
    const codigo =
      typeof datos === 'object' && datos !== null && 'codigo' in datos && typeof datos.codigo === 'string'
        ? datos.codigo
        : codigoGenerico(respuesta.status);
    // Para soporte (docs/mensajes.md): el código y el X-Request-Id van a la consola, no a la pantalla.
    console.warn(`[api] ${metodo} ${url} → ${respuesta.status} ${codigo} (X-Request-Id ${requestId})`);
    throw new ErrorApi({ tipo: 'http', estado: respuesta.status, codigo, requestId });
  }
  return { estado: respuesta.status, datos: datos as T };
}

/** Valida la respuesta de un servicio con Zod; si no es la del contrato, `respuesta-invalida`. */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorApi({ tipo: 'respuesta-invalida' });
  }
  return resultado.data;
}

/** Reintentos de las consultas: hasta 3, a 1 s, 2 s y 4 s, solo si el error puede pasar solo. */
export const MAX_REINTENTOS_CONSULTA = 3;

export function reintentarConsulta(intentosFallidos: number, error: unknown): boolean {
  return intentosFallidos < MAX_REINTENTOS_CONSULTA && esReintentable(falloDe(error));
}

export function esperaReintento(intento: number): number {
  return 1000 * 2 ** intento;
}

/**
 * Reintentos de un registro (diseño 004, «App»): hasta 3, a 1 s, 2 s y 4 s, solo ante un error de
 * red (sin respuesta o tiempo agotado) o `503`. Se puede repetir porque el registro lleva su `id`
 * (UUID del celular) y el servicio no lo procesa dos veces (`200` con el existente).
 */
export const MAX_REINTENTOS_ENVIO = 3;

export function reintentarEnvio(intentosFallidos: number, error: unknown): boolean {
  if (intentosFallidos >= MAX_REINTENTOS_ENVIO) {
    return false;
  }
  const fallo = falloDe(error);
  return fallo.tipo === 'red' || fallo.tipo === 'tiempo' || (fallo.tipo === 'http' && fallo.estado === 503);
}

const dormir = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

type OpcionesReintento = {
  /** Si vale la pena otro intento tras `intentosFallidos` fallos. */
  reintentar?: (intentosFallidos: number, error: unknown) => boolean;
  /** Espera entre intentos (las pruebas la reemplazan para no esperar de verdad). */
  esperar?: (ms: number) => Promise<void>;
};

/**
 * Repite `operacion` mientras `reintentar` lo diga, esperando 1 s, 2 s y 4 s. `operacion` debe
 * enviar siempre lo mismo (mismo cuerpo y mismo `id`): así un intento que sí llegó al servicio no
 * crea un registro nuevo. Si se acaban los intentos, lanza el último error.
 */
export async function conReintentos<T>(
  operacion: () => Promise<T>,
  { reintentar = reintentarEnvio, esperar = dormir }: OpcionesReintento = {},
): Promise<T> {
  for (let fallidos = 0; ; fallidos++) {
    try {
      return await operacion();
    } catch (error) {
      if (!reintentar(fallidos, error)) {
        throw error;
      }
      await esperar(esperaReintento(fallidos));
    }
  }
}

export type Servicio = 'obras' | 'materiales' | 'sincronizacion';

/**
 * URL de una ruta de un servicio, con la base de app.json → extra (`obrasUrl`, `materialesUrl`,
 * `sincronizacionUrl`).
 */
export function urlServicio(servicio: Servicio, ruta: string): string {
  const config = configuracion();
  const base = {
    obras: config.obrasUrl,
    materiales: config.materialesUrl,
    sincronizacion: config.sincronizacionUrl,
  }[servicio];
  return `${base.replace(/\/+$/, '')}${ruta}`;
}

/**
 * Cliente de TanStack Query de la app. Las escrituras no se reintentan solas: las que se pueden
 * repetir sin duplicar (un movimiento con su `id`) usan `conReintentos` dentro de su función.
 */
export function crearClienteConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: reintentarConsulta, retryDelay: esperaReintento },
      mutations: { retry: false },
    },
  });
}
