// Subida del archivo de una foto con la URL firmada (005; desde la 102 la URL la pide la app a
// Sincronización): `PUT` directo al almacenamiento (S3), sin token. El archivo es el guardado en el
// celular (`File` de expo-file-system, que implementa `Blob`).
import { fetchConTiempo } from './cliente';
import { ErrorApi } from './errores';

/** Tiempo máximo para subir el archivo (102, criterio 6); pasado, cuenta como fallo de red. */
export const TIEMPO_MAXIMO_SUBIDA_MS = 30_000;

/**
 * `PUT` del archivo a la URL firmada. Si el almacenamiento lo rechaza, `ErrorApi` `subida` con su
 * estado (`403` si la URL venció).
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
