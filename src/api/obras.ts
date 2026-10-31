// Llamadas a Obras que usa la app (docs/contratos.md). Las respuestas se validan con Zod: solo los
// campos que la app usa; el resto se deja pasar.
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { pedir, urlServicio, validar, type ObtenerToken } from './cliente';

const esquemaObra = z.looseObject({
  id: z.string(),
  nombre: z.string(),
  ubicacion: z.string().nullish(),
  estado: z.string(),
});

const esquemaPartida = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
});

const esquemaDetalleObra = esquemaObra.extend({ partidas: z.array(esquemaPartida) });

const esquemaUrlSubida = z.object({
  url: z.string().min(1),
  claveArchivo: z.string().min(1),
  expiraEn: z.string().min(1),
});

const esquemaFotoRegistrada = z.looseObject({
  id: z.string(),
  partidaId: z.string(),
});

export type Obra = z.infer<typeof esquemaObra>;
export type Partida = z.infer<typeof esquemaPartida>;
export type DetalleObra = z.infer<typeof esquemaDetalleObra>;
export type UrlSubida = z.infer<typeof esquemaUrlSubida>;
export type FotoRegistrada = z.infer<typeof esquemaFotoRegistrada>;

export type RegistroFoto = {
  id: string;
  partidaId: string;
  claveArchivo: string;
  /** ISO 8601 (UTC). */
  tomadaEn: string;
};

const url = (ruta: string) => urlServicio('obras', ruta);
const segmento = encodeURIComponent;

/** `GET /obras/{id}`: detalle con sus partidas. */
export async function obtenerObra(id: string, obtenerToken: ObtenerToken): Promise<DetalleObra> {
  const { datos } = await pedir(url(`/obras/${segmento(id)}`), { obtenerToken });
  return validar(esquemaDetalleObra, datos);
}

/** `POST /obras/{obraId}/fotos/url-subida`: URL firmada (PUT) para subir la foto `fotoId`. */
export async function pedirUrlSubida(
  obraId: string,
  fotoId: string,
  obtenerToken: ObtenerToken,
): Promise<UrlSubida> {
  const { datos } = await pedir(url(`/obras/${segmento(obraId)}/fotos/url-subida`), {
    obtenerToken,
    metodo: 'POST',
    cuerpo: { fotoId },
  });
  return validar(esquemaUrlSubida, datos);
}

/**
 * `POST /obras/{obraId}/fotos`: registra la foto ya subida. `201` si es nueva; `200` si ese `id`
 * ya estaba registrado (envío repetido, 005 criterio 4): las dos cuentan como registrada.
 */
export async function registrarFoto(
  obraId: string,
  registro: RegistroFoto,
  obtenerToken: ObtenerToken,
): Promise<{ foto: FotoRegistrada; yaExistia: boolean }> {
  const { estado, datos } = await pedir(url(`/obras/${segmento(obraId)}/fotos`), {
    obtenerToken,
    metodo: 'POST',
    cuerpo: registro,
  });
  return { foto: validar(esquemaFotoRegistrada, datos), yaExistia: estado === 200 };
}

export const obraQuery = (id: string, obtenerToken: ObtenerToken) =>
  queryOptions({ queryKey: ['obras', id], queryFn: () => obtenerObra(id, obtenerToken) });
