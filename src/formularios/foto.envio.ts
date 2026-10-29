// Envío de una foto de avance (005, criterios 3 a 5): URL firmada → PUT del archivo → registro.
//
// Lo que ya se hizo queda en `EnvioFoto` (en memoria) para que «Reintentar» siga desde ahí con el
// mismo `fotoId` y el mismo archivo comprimido, sin volver a tomar la foto. Obras no registra dos
// veces el mismo `fotoId`: un `200` en el registro es un envío repetido y cuenta como éxito.
import { ErrorApi, falloDe, mensajeDeFallo, MENSAJES, type FalloApi } from '../api/errores';
import type { RegistroFoto, UrlSubida } from '../api/obras';

/** Una URL que vence en menos de esto se pide de nuevo antes de subir. */
export const MARGEN_VENCIMIENTO_URL_MS = 30_000;

/** Progreso del envío de una foto; vive mientras la foto no quede registrada. */
export type EnvioFoto = {
  obraId: string;
  fotoId: string;
  /** Archivo comprimido (el mismo en cada intento). */
  archivoUri: string;
  tomadaEn: string;
  /** Última URL firmada pedida para este `fotoId`. */
  subida: UrlSubida | null;
  /** El archivo ya está en el almacenamiento con `subida.claveArchivo`. */
  subido: boolean;
};

export type DependenciasEnvio = {
  pedirUrlSubida: (obraId: string, fotoId: string) => Promise<UrlSubida>;
  leerArchivo: (uri: string) => Promise<Blob>;
  subirArchivo: (url: string, archivo: Blob) => Promise<void>;
  registrarFoto: (obraId: string, registro: RegistroFoto) => Promise<{ yaExistia: boolean }>;
  ahora: () => number;
};

export function nuevoEnvio(datos: {
  obraId: string;
  fotoId: string;
  archivoUri: string;
  tomadaEn: string;
}): EnvioFoto {
  return { ...datos, subida: null, subido: false };
}

/** La URL firmada ya venció o está por vencer. */
export function urlVencida(subida: UrlSubida, ahora: number, margen = MARGEN_VENCIMIENTO_URL_MS): boolean {
  const vence = Date.parse(subida.expiraEn);
  return Number.isNaN(vence) || vence - margen <= ahora;
}

/** El almacenamiento rechazó la URL (S3 responde `403` a una URL firmada vencida). */
const esUrlRechazada = (error: unknown) =>
  error instanceof ErrorApi && error.fallo.tipo === 'subida' && error.fallo.estado === 403;

/**
 * Hace lo que falta del envío y actualiza `envio` en cada paso. Si la URL venció, pide otra con el
 * mismo `fotoId` (una vez por intento). Lanza el error del paso que falló.
 */
export async function enviarFoto(
  envio: EnvioFoto,
  partidaId: string,
  dependencias: DependenciasEnvio,
): Promise<{ yaExistia: boolean }> {
  if (!envio.subido) {
    if (!envio.subida || urlVencida(envio.subida, dependencias.ahora())) {
      envio.subida = await dependencias.pedirUrlSubida(envio.obraId, envio.fotoId);
    }
    const archivo = await dependencias.leerArchivo(envio.archivoUri);
    try {
      await dependencias.subirArchivo(envio.subida.url, archivo);
    } catch (error) {
      if (!esUrlRechazada(error)) {
        throw error;
      }
      envio.subida = await dependencias.pedirUrlSubida(envio.obraId, envio.fotoId);
      await dependencias.subirArchivo(envio.subida.url, archivo);
    }
    envio.subido = true;
  }
  return dependencias.registrarFoto(envio.obraId, {
    id: envio.fotoId,
    partidaId,
    claveArchivo: envio.subida!.claveArchivo,
    tomadaEn: envio.tomadaEn,
  });
}

/**
 * Qué puede hacer el usuario después de un fallo:
 * - `reintentar`: sin señal, tiempo agotado, servicio caído o saturado; conserva foto y `fotoId`.
 * - `elegir-partida`: la partida no es de la obra; se actualizan las partidas y se elige otra.
 * - `tomar-otra`: el archivo no sirve (clave inválida, foto perdida o rechazada); se descarta.
 * - `iniciar-sesion`: la sesión terminó.
 * - `ninguna`: no tiene permiso o la obra ya no está asignada.
 */
export type AccionTrasFallo = 'reintentar' | 'elegir-partida' | 'tomar-otra' | 'iniciar-sesion' | 'ninguna';

export type DecisionFallo = { mensaje: string; accion: AccionTrasFallo };

/** Título del aviso de un envío que falló (005, criterio 5). */
export const TITULO_ENVIO_FALLIDO = 'No se pudo enviar.';

export function decidirTrasFallo(fallo: FalloApi): DecisionFallo {
  const mensaje = mensajeDeFallo(fallo);
  switch (fallo.tipo) {
    case 'red':
    case 'tiempo':
    case 'subida':
      return { mensaje, accion: 'reintentar' };
    case 'sin-sesion':
      return { mensaje, accion: 'iniciar-sesion' };
    case 'archivo':
    case 'respuesta-invalida':
      return { mensaje, accion: fallo.tipo === 'archivo' ? 'tomar-otra' : 'reintentar' };
    case 'http':
      break;
  }
  if (fallo.estado === 429 || fallo.estado >= 500) {
    return { mensaje, accion: 'reintentar' };
  }
  if (fallo.estado === 401) {
    return { mensaje: MENSAJES.NO_AUTENTICADO, accion: 'iniciar-sesion' };
  }
  if (fallo.codigo === 'PARTIDA_NO_ES_DE_LA_OBRA') {
    return { mensaje, accion: 'elegir-partida' };
  }
  if (fallo.estado === 403 || fallo.estado === 404) {
    return { mensaje, accion: 'ninguna' };
  }
  // CLAVE_ARCHIVO_INVALIDA, 413, 400 y reglas desconocidas: con esta foto no se va a poder.
  return { mensaje, accion: 'tomar-otra' };
}

export function decidirTrasError(error: unknown): DecisionFallo {
  return decidirTrasFallo(falloDe(error));
}
