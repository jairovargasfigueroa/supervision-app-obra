// Subida del archivo de una foto con la URL firmada que da Obras (005): `PUT` directo al
// almacenamiento (S3), sin token. La foto comprimida se lee del celular (`file://`).
import { fetchConTiempo } from './cliente';
import { ErrorApi } from './errores';
import { enviar } from './red';

/** Una foto de 1600 px pesa unos cientos de KB; con mala señal puede tardar más que una consulta. */
export const TIEMPO_MAXIMO_SUBIDA_MS = 60_000;

/** El archivo comprimido como `Blob`. Si ya no está en el celular, `ErrorApi` `archivo`. */
export async function leerArchivo(uri: string): Promise<Blob> {
  try {
    const respuesta = await enviar(uri);
    return await respuesta.blob();
  } catch {
    throw new ErrorApi({ tipo: 'archivo' });
  }
}

/**
 * `PUT` del archivo a la URL firmada (diseño 005). Si el almacenamiento lo rechaza, `ErrorApi`
 * `subida` con su estado (`403` si la URL venció).
 */
export async function subirArchivo(url: string, archivo: Blob): Promise<void> {
  const respuesta = await fetchConTiempo(
    url,
    { method: 'PUT', body: archivo, headers: { 'Content-Type': 'image/jpeg' } },
    TIEMPO_MAXIMO_SUBIDA_MS,
  );
  if (!respuesta.ok) {
    console.warn(`[subida] PUT de la foto → ${respuesta.status}`);
    throw new ErrorApi({ tipo: 'subida', estado: respuesta.status });
  }
}
