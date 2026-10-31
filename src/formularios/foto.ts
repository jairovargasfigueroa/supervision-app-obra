// Foto de avance (005): tomarla con la cámara o elegirla de la galería y reducirla antes de guardarla
// en el celular (102, criterio 1: máximo 1280 px por lado y JPEG con calidad 70, unos 150 a 400 KB).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const LADO_MAXIMO_PX = 1280;
export const CALIDAD_JPEG = 0.7;

export type FotoComprimida = { uri: string; ancho: number; alto: number };

export type FotoTomada = {
  foto: FotoComprimida;
  /** Fecha y hora en que se tomó (ISO 8601, UTC). */
  tomadaEn: string;
};

export type OrigenFoto = 'camara' | 'galeria';

export type ResultadoFoto =
  | { tipo: 'lista'; foto: FotoTomada }
  | { tipo: 'cancelada' }
  /** El usuario no dio permiso para usar la cámara. */
  | { tipo: 'sin-permiso' };

/**
 * Tamaño al que se reduce: se fija el lado más largo en 1280 px y el otro sale de la proporción.
 * `null` si la foto ya cabe (no se agranda).
 */
export function reduccion(
  ancho: number,
  alto: number,
  maximo = LADO_MAXIMO_PX,
): { width: number } | { height: number } | null {
  if (Math.max(ancho, alto) <= maximo) {
    return null;
  }
  return ancho >= alto ? { width: maximo } : { height: maximo };
}

/**
 * Reduce la foto a 1280 px por lado como máximo y la guarda como JPEG con `compress: 0.7`. Las
 * medidas se leen de la imagen ya cargada (con la orientación aplicada), no de las del selector.
 */
export async function comprimirFoto(uri: string): Promise<FotoComprimida> {
  const contexto = ImageManipulator.manipulate(uri);
  try {
    const original = await contexto.renderAsync();
    const nuevoTamano = reduccion(original.width, original.height);
    const imagen = nuevoTamano ? await contexto.resize(nuevoTamano).renderAsync() : original;
    const guardada = await imagen.saveAsync({ compress: CALIDAD_JPEG, format: SaveFormat.JPEG });
    return { uri: guardada.uri, ancho: guardada.width, alto: guardada.height };
  } finally {
    contexto.release();
  }
}

const FECHA_EXIF = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const DESFASE_EXIF = /^[+-]\d{2}:\d{2}$/;

function textoExif(exif: Record<string, unknown> | null | undefined, clave: string): string | null {
  // Android deja las etiquetas en la raíz; iOS las agrupa en «{Exif}».
  const grupo = exif?.['{Exif}'];
  const valor =
    exif?.[clave] ??
    (typeof grupo === 'object' && grupo !== null ? (grupo as Record<string, unknown>)[clave] : null);
  return typeof valor === 'string' ? valor.trim() : null;
}

/**
 * Cuándo se tomó una foto de la galería, según su EXIF (`DateTimeOriginal`, con
 * `OffsetTimeOriginal` si lo trae; si no, en la hora del celular). Si no hay fecha válida, o es
 * futura, se usa `ahora`.
 */
export function tomadaEnDeExif(
  exif: Record<string, unknown> | null | undefined,
  ahora: Date,
): string {
  const partes = FECHA_EXIF.exec(textoExif(exif, 'DateTimeOriginal') ?? '');
  if (!partes) {
    return ahora.toISOString();
  }
  const [, anio, mes, dia, hora, minuto, segundo] = partes.map(Number) as number[];
  const desfase = textoExif(exif, 'OffsetTimeOriginal');
  const ms =
    desfase && DESFASE_EXIF.test(desfase)
      ? Date.parse(`${partes[1]}-${partes[2]}-${partes[3]}T${partes[4]}:${partes[5]}:${partes[6]}${desfase}`)
      : new Date(anio!, mes! - 1, dia, hora, minuto, segundo).getTime();
  if (Number.isNaN(ms) || ms > ahora.getTime()) {
    return ahora.toISOString();
  }
  return new Date(ms).toISOString();
}

/**
 * Abre la cámara o la galería y devuelve la foto ya comprimida. La foto se pide sin compresión
 * (`quality: 1`) para comprimirla una sola vez.
 */
export async function obtenerFoto(
  origen: OrigenFoto,
  ahora: () => Date = () => new Date(),
): Promise<ResultadoFoto> {
  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: origen === 'galeria',
  };
  let resultado: ImagePicker.ImagePickerResult;
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      return { tipo: 'sin-permiso' };
    }
    resultado = await ImagePicker.launchCameraAsync(opciones);
  } else {
    resultado = await ImagePicker.launchImageLibraryAsync(opciones);
  }
  const elegida = resultado.canceled ? undefined : resultado.assets[0];
  if (!elegida) {
    return { tipo: 'cancelada' };
  }
  const tomadaEn = origen === 'camara' ? ahora().toISOString() : tomadaEnDeExif(elegida.exif, ahora());
  return { tipo: 'lista', foto: { foto: await comprimirFoto(elegida.uri), tomadaEn } };
}
