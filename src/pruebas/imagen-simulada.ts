// expo-image-manipulator y expo-image-picker simulados (jest.setup.ts los instala para todas las
// pruebas): en Jest no hay módulos nativos, cámara ni galería.

type Medidas = { width: number; height: number };
type OpcionesGuardado = { compress?: number; format?: string };

function crearContexto(ancho: number, alto: number) {
  let medidas: Medidas = { width: ancho, height: alto };
  const guardar = jest.fn(async (_opciones: OpcionesGuardado) => ({
    uri: 'file:///comprimida.jpg',
    ...medidas,
  }));
  type Contexto = { resize: jest.Mock };
  const contexto = {
    resize: jest.fn((tamano: { width?: number; height?: number }): Contexto => {
      medidas = tamano.width
        ? { width: tamano.width, height: Math.round((alto * tamano.width) / ancho) }
        : { width: Math.round((ancho * tamano.height!) / alto), height: tamano.height! };
      return contexto;
    }),
    renderAsync: jest.fn(async () => {
      const actuales = medidas;
      return { ...actuales, saveAsync: (opciones: OpcionesGuardado) => guardar(opciones) };
    }),
    release: jest.fn(),
    /** `saveAsync` de la imagen resultante (para comprobar compresión y formato). */
    guardar,
  };
  return contexto;
}

let actual = crearContexto(4000, 3000);

/** La próxima foto que se abra mide `ancho` × `alto`. */
export function simularManipulador({ ancho, alto }: { ancho: number; alto: number }): void {
  actual = crearContexto(ancho, alto);
}

/** Contexto de la última foto que se manipuló. */
export function contextoSimulado() {
  return actual;
}

export const moduloManipulador = {
  ImageManipulator: { manipulate: jest.fn((_uri: string) => actual) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
};

export const moduloSelector = {
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
