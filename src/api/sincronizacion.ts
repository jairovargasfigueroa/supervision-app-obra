// Llamadas a Sincronización (capa 1, 101; contrato en services/sincronizacion/docs/contratos.md). Todas
// llevan el token de la sesión y `X-Dispositivo-Id`. Las respuestas se validan con Zod: solo los
// campos que la app usa; el resto se deja pasar.
import { z } from 'zod';

import { pedir, urlServicio, validar, type ObtenerToken } from './cliente';
import { ESTADOS_STOCK } from './materiales';

const esquemaPartidaPaquete = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
});

const esquemaStockPaquete = z.looseObject({
  materialId: z.string(),
  cantidad: z.number(),
  minimo: z.number(),
  estado: z.enum(ESTADOS_STOCK),
});

const esquemaObraPaquete = z.looseObject({
  id: z.string(),
  nombre: z.string(),
  ubicacion: z.string(),
  partidas: z.array(esquemaPartidaPaquete),
  stock: z.array(esquemaStockPaquete),
});

const esquemaMaterialPaquete = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  unidadPlural: z.string(),
});

export const esquemaPaqueteDatos = z.looseObject({
  versionDatos: z.string().min(1),
  generadoEn: z.string(),
  obras: z.array(esquemaObraPaquete),
  materiales: z.array(esquemaMaterialPaquete),
});

export type PaqueteDatos = z.infer<typeof esquemaPaqueteDatos>;
export type ObraPaquete = z.infer<typeof esquemaObraPaquete>;
export type StockPaquete = z.infer<typeof esquemaStockPaquete>;
export type MaterialPaquete = z.infer<typeof esquemaMaterialPaquete>;

const url = (ruta: string) => urlServicio('sincronizacion', ruta);

type OpcionesPaquete = {
  obtenerToken: ObtenerToken;
  idDispositivo: string;
  /** `versionDatos` del paquete guardado: si no cambió, el servidor responde `304`. */
  versionAnterior?: string;
  /** Obra con la que trabaja el usuario (Sincronización solo la guarda en `estado_dispositivo`). */
  obraActivaId?: string;
};

/** `GET /paquete-datos`: el paquete nuevo, o `null` si no cambió desde `versionAnterior` (`304`). */
export async function pedirPaqueteDatos({
  obtenerToken,
  idDispositivo,
  versionAnterior,
  obraActivaId,
}: OpcionesPaquete): Promise<PaqueteDatos | null> {
  const consulta = obraActivaId ? `?obraActivaId=${encodeURIComponent(obraActivaId)}` : '';
  const { estado, datos } = await pedir(url(`/paquete-datos${consulta}`), {
    obtenerToken,
    encabezados: {
      'X-Dispositivo-Id': idDispositivo,
      ...(versionAnterior ? { 'If-None-Match': `"${versionAnterior}"` } : {}),
    },
  });
  if (estado === 304) {
    return null;
  }
  return validar(esquemaPaqueteDatos, datos);
}

/** Una operación de `POST /lotes`. */
export type OperacionLote = {
  idOperacion: string;
  tipo: string;
  /** ISO 8601 con zona. */
  creadaEn: string;
  datos: Record<string, unknown>;
};

export const ESTADOS_RESULTADO = ['PROCESADO', 'ERROR', 'REINTENTAR'] as const;

const esquemaResultadoLote = z.looseObject({
  idOperacion: z.string(),
  /** `PROCESADO` (el dueño lo aceptó) · `ERROR` (rechazo definitivo) · `REINTENTAR` (más tarde, mismo id). */
  estado: z.enum(ESTADOS_RESULTADO),
  repetida: z.boolean().optional(),
  status: z.number(),
  /** Cuerpo del servicio dueño: en `ERROR` y `REINTENTAR`, el Problem Details con `codigo`. */
  respuesta: z.unknown(),
});

const esquemaRespuestaLote = z.looseObject({ resultados: z.array(esquemaResultadoLote) });

export type ResultadoLote = z.infer<typeof esquemaResultadoLote>;

/** Tiempo máximo de `POST /lotes` en la app (Sincronización corta el lote a los 20 s). */
export const TIEMPO_MAXIMO_LOTE_MS = 30_000;

/**
 * `POST /lotes` (hasta 20 operaciones): un resultado por operación, en el mismo orden. Un fallo del
 * lote completo (sin señal, tiempo agotado, `5xx`, `401`…) lanza `ErrorApi`.
 */
export async function enviarLote(
  operaciones: OperacionLote[],
  { obtenerToken, idDispositivo }: { obtenerToken: ObtenerToken; idDispositivo: string },
): Promise<ResultadoLote[]> {
  const { datos } = await pedir(url('/lotes'), {
    obtenerToken,
    metodo: 'POST',
    cuerpo: { operaciones },
    encabezados: { 'X-Dispositivo-Id': idDispositivo },
    tiempoMaximoMs: TIEMPO_MAXIMO_LOTE_MS,
  });
  return validar(esquemaRespuestaLote, datos).resultados;
}

const esquemaUrlSubida = z.looseObject({
  url: z.string().min(1),
  claveArchivo: z.string().min(1),
  expiraEn: z.string(),
});

export type UrlSubida = z.infer<typeof esquemaUrlSubida>;

/** Tiempo máximo para pedir la URL de subida (102, criterio 6). */
export const TIEMPO_MAXIMO_URL_SUBIDA_MS = 10_000;

/**
 * `POST /fotos/url-subida` (102): la URL firmada (`PUT`, vence a los 10 minutos) y la `claveArchivo`
 * de la foto `fotoId`, que Sincronización pide a Obras. Se pide una nueva en cada intento de subida.
 */
export async function pedirUrlSubidaFoto(
  { obraId, fotoId }: { obraId: string; fotoId: string },
  { obtenerToken, idDispositivo }: { obtenerToken: ObtenerToken; idDispositivo: string },
): Promise<UrlSubida> {
  const { datos } = await pedir(url('/fotos/url-subida'), {
    obtenerToken,
    metodo: 'POST',
    cuerpo: { obraId, fotoId },
    encabezados: { 'X-Dispositivo-Id': idDispositivo },
    tiempoMaximoMs: TIEMPO_MAXIMO_URL_SUBIDA_MS,
  });
  return validar(esquemaUrlSubida, datos);
}
