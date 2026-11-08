// Archivos de las fotos guardadas en el celular hasta que se suben (102): `documentDirectory/pendientes/`
// con `expo-file-system`. El sistema no borra esa carpeta (la caché sí).
import { Directory, File, Paths } from 'expo-file-system';

export const CARPETA_PENDIENTES = 'pendientes';

function carpetaPendientes(): Directory {
  const carpeta = new Directory(Paths.document, CARPETA_PENDIENTES);
  if (!carpeta.exists) {
    carpeta.create({ intermediates: true, idempotent: true });
  }
  return carpeta;
}

/**
 * Mueve la foto comprimida (que queda en la caché) a `pendientes/{fotoId}.jpg` y devuelve su ruta.
 * Si ya había un archivo con ese nombre, lo reemplaza.
 */
export function guardarFotoPendiente(uriComprimida: string, fotoId: string): string {
  const destino = new File(carpetaPendientes(), `${fotoId}.jpg`);
  if (destino.exists) {
    destino.delete();
  }
  new File(uriComprimida).moveSync(destino);
  return destino.uri;
}

/** El archivo para subirlo (implementa `Blob`), o `null` si ya no está en el celular. */
export function abrirArchivo(uri: string): File | null {
  const archivo = new File(uri);
  return archivo.exists ? archivo : null;
}

/**
 * Borra un archivo solo si está en la caché de la app (p. ej. el original que deja `expo-image-picker`),
 * para no tocar nunca un archivo del usuario.
 */
export function borrarDeCache(uri: string | null | undefined): void {
  const cache = Paths.cache.uri.replace(/\/*$/, '/');
  if (uri && uri.startsWith(cache)) {
    borrarArchivo(uri);
  }
}

/** Borra el archivo si existe (al confirmarse el registro o al descartarlo, criterio 10). */
export function borrarArchivo(uri: string | null | undefined): void {
  if (!uri) {
    return;
  }
  try {
    const archivo = new File(uri);
    if (archivo.exists) {
      archivo.delete();
    }
  } catch (error) {
    console.warn('[archivos] no se pudo borrar', uri, error);
  }
}
