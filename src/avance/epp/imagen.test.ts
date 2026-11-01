import { Buffer } from 'buffer';
import { ImageManipulator } from 'expo-image-manipulator';
import { encode } from 'jpeg-js';

import { archivosSimulados, escribirArchivo } from '../../pruebas/archivos-simulados';

// jest.setup.ts simula este módulo para el resto de las pruebas; aquí se prueba el real con un
// manipulador simulado que devuelve JPEG de verdad (codificados con jpeg-js).
const { abrirFoto } = jest.requireActual<typeof import('./imagen')>('./imagen');

type Operacion = { crop?: unknown; resize?: unknown };

function prepararManipulador(ancho: number, alto: number, color: [number, number, number]) {
  const operaciones: Operacion[][] = [];
  const liberados: number[] = [];
  let guardadas = 0;
  jest.mocked(ImageManipulator.manipulate).mockImplementation(((fuente: unknown) => {
    const propias: Operacion[] = [];
    operaciones.push(propias);
    let medidas = typeof fuente === 'string' ? { width: ancho, height: alto } : { ...(fuente as { width: number; height: number }) };
    const contexto = {
      crop: (rect: { width: number; height: number }) => {
        propias.push({ crop: rect });
        medidas = { width: rect.width, height: rect.height };
        return contexto;
      },
      resize: (tamano: { width: number; height: number }) => {
        propias.push({ resize: tamano });
        medidas = { width: tamano.width, height: tamano.height };
        return contexto;
      },
      renderAsync: async () => ({
        ...medidas,
        saveAsync: async (opciones: { base64?: boolean; compress?: number; format?: string }) => {
          expect(opciones).toEqual({ base64: true, compress: 1, format: 'jpeg' });
          const datos = Buffer.alloc(medidas.width * medidas.height * 4);
          for (let i = 0; i < datos.length; i += 4) {
            datos.set([...color, 255], i);
          }
          const uri = `file:///cache/manipulada-${++guardadas}.jpg`;
          escribirArchivo(uri);
          const jpeg = encode({ data: datos, width: medidas.width, height: medidas.height }, 100);
          return { uri, ...medidas, base64: jpeg.data.toString('base64') };
        },
      }),
      release: () => liberados.push(operaciones.indexOf(propias)),
    };
    return contexto;
  }) as never);
  return { operaciones, liberados };
}

describe('abrirFoto (expo-image-manipulator + jpeg-js)', () => {
  it('carga la foto una vez y da la entrada del detector: 320 × 320, RGB uint8', async () => {
    const { operaciones } = prepararManipulador(1280, 960, [200, 100, 50]);
    const foto = await abrirFoto('file:///comprimida.jpg');
    expect(foto).toMatchObject({ ancho: 1280, alto: 960 });
    const entrada = await foto.entradaDetector(320);
    expect(entrada).toBeInstanceOf(Uint8Array);
    expect(entrada.length).toBe(320 * 320 * 3);
    // JPEG con pérdida: el color vuelve casi igual.
    expect(Math.abs(entrada[0]! - 200)).toBeLessThan(4);
    expect(Math.abs(entrada[1]! - 100)).toBeLessThan(4);
    expect(Math.abs(entrada[2]! - 50)).toBeLessThan(4);
    expect(operaciones[1]).toEqual([{ resize: { width: 320, height: 320 } }]);
  });

  it('el recorte de una persona se hace en el manipulador nativo y llega como float32 de 224 × 224', async () => {
    const { operaciones } = prepararManipulador(1280, 960, [10, 20, 30]);
    const foto = await abrirFoto('file:///comprimida.jpg');
    const recorte = await foto.recorte({ x: 90, y: 170, ancho: 120, alto: 360 }, 224, 224);
    expect(recorte).toBeInstanceOf(Float32Array);
    expect(recorte.length).toBe(224 * 224 * 3);
    expect(Math.abs(recorte[2]! - 30)).toBeLessThan(4);
    expect(operaciones[1]).toEqual([
      { crop: { originX: 90, originY: 170, width: 120, height: 360 } },
      { resize: { width: 224, height: 224 } },
    ]);
  });

  it('no deja en la caché las imágenes intermedias y libera lo cargado', async () => {
    const { liberados } = prepararManipulador(640, 480, [0, 0, 0]);
    const foto = await abrirFoto('file:///comprimida.jpg');
    await foto.entradaDetector(320);
    await foto.recorte({ x: 0, y: 0, ancho: 100, alto: 200 }, 224, 224);
    expect(archivosSimulados()).toEqual([]);
    foto.liberar();
    expect(liberados.sort()).toEqual([0, 1, 2]);
  });
});
