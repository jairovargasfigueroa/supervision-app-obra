// Píxeles de la foto para los modelos (301). Lo pesado lo hace `expo-image-manipulator`, que es
// nativo: la foto comprimida (hasta 1280 px) se carga una sola vez y de ella salen la imagen de
// 320 × 320 del detector y el recorte de 224 × 224 de cada persona, ya redimensionados. En JavaScript
// solo se decodifican esas imágenes chicas (JPEG de calidad 1 → RGB con `jpeg-js`), nunca la foto
// completa: decodificar 1280 × 960 px en JavaScript tardaría más que todo el análisis permitido.
// Los JPEG intermedios que escribe el manipulador en la caché se borran en cuanto se leen.
import { Buffer } from 'buffer';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { borrarArchivo } from '../../sync/archivos';
import { pixelesRgb, type Caja } from './deteccion';

export type FotoParaAnalizar = {
  /** Medidas de la foto (con la orientación ya aplicada). */
  ancho: number;
  alto: number;
  /** La foto entera a `lado` × `lado`, RGB `uint8` (entrada del detector). */
  entradaDetector(lado: number): Promise<Uint8Array>;
  /** El recorte `caja` a `ancho` × `alto`, RGB `float32` de 0 a 255 (entrada del clasificador). */
  recorte(caja: Caja, ancho: number, alto: number): Promise<Float32Array>;
  /** Libera la imagen cargada. */
  liberar(): void;
};

/** Pasa la imagen por el manipulador (recorte opcional y redimensionado) y devuelve sus píxeles RGB. */
async function pixeles(imagen: ImageRef, ancho: number, alto: number, caja?: Caja): Promise<Uint8Array> {
  const contexto = ImageManipulator.manipulate(imagen);
  let uri: string | null = null;
  try {
    if (caja) {
      contexto.crop({ originX: caja.x, originY: caja.y, width: caja.ancho, height: caja.alto });
    }
    contexto.resize({ width: ancho, height: alto });
    const chica = await contexto.renderAsync();
    const guardada = await chica.saveAsync({ base64: true, compress: 1, format: SaveFormat.JPEG });
    uri = guardada.uri;
    if (!guardada.base64) {
      throw new Error('El manipulador no devolvió la imagen');
    }
    const { data } = decode(Buffer.from(guardada.base64, 'base64'), { useTArray: true, formatAsRGBA: false });
    return data;
  } finally {
    contexto.release();
    borrarArchivo(uri);
  }
}

/** Carga la foto una vez para sacar de ella la entrada del detector y los recortes. */
export async function abrirFoto(uri: string): Promise<FotoParaAnalizar> {
  const contexto = ImageManipulator.manipulate(uri);
  const imagen = await contexto.renderAsync();
  return {
    ancho: imagen.width,
    alto: imagen.height,
    entradaDetector: async (lado) => pixelesRgb(await pixeles(imagen, lado, lado), 3, 'uint8'),
    recorte: async (caja, anchoRecorte, altoRecorte) =>
      pixelesRgb(await pixeles(imagen, anchoRecorte, altoRecorte, caja), 3, 'float32'),
    liberar: () => contexto.release(),
  };
}
