// Modelos y foto simulados para el análisis de casco y chaleco (301). En Jest no hay TensorFlow Lite
// ni manipulador nativo: el detector simulado devuelve las personas pedidas (codificadas respecto de
// sus anclas, como el modelo real) y el clasificador, sus probabilidades. jest.setup.ts los instala
// en `cargarModelos` y `abrirFoto`; cada prueba elige qué hay en la foto con `simularAnalisisEpp`.
import { anclasDetector, VALORES_POR_ANCLA } from '../avance/epp/anclas';
import type { ConfigEpp } from '../avance/epp/config';
import type { Caja } from '../avance/epp/deteccion';
import type { FotoParaAnalizar } from '../avance/epp/imagen';
import type { ModelosEpp, ModeloTflite } from '../avance/epp/modelos';

const CLASES = 90;

/** Persona en la foto simulada: caja normalizada (0–1), puntaje y probabilidades del clasificador. */
export type PersonaSimulada = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  puntaje?: number;
  casco: number;
  chaleco: number;
};

export const CONFIG_SIMULADA: ConfigEpp = {
  version: '1.0.0',
  umbrales: { casco: 0.5, chaleco: 0.5 },
  entrada: { alto: 224, ancho: 224, canales: 3, tipo: 'float32' },
  salidas: ['casco', 'chaleco'],
};

const tensor = (name: string, shape: number[]) => ({ name, dataType: 'float32' as const, shape });

/** Salidas del detector real (puntajes y cajas) con estas personas, cada una en un ancla distinta. */
export function salidasDetectorCon(personas: readonly Omit<PersonaSimulada, 'casco' | 'chaleco'>[]): {
  puntajes: Float32Array;
  cajas: Float32Array;
} {
  const anclas = anclasDetector();
  const total = anclas.length / VALORES_POR_ANCLA;
  const puntajes = new Float32Array(total * CLASES);
  const cajas = new Float32Array(total * 4);
  personas.forEach((p, k) => {
    const i = 1000 + k * 997;
    const a = i * VALORES_POR_ANCLA;
    const [ax, ay, aw, ah] = [anclas[a]!, anclas[a + 1]!, anclas[a + 2]!, anclas[a + 3]!];
    puntajes[i * CLASES] = p.puntaje ?? 0.8;
    cajas[i * 4] = ((p.y0 + p.y1) / 2 - ay) / ah;
    cajas[i * 4 + 1] = ((p.x0 + p.x1) / 2 - ax) / aw;
    cajas[i * 4 + 2] = Math.log((p.y1 - p.y0) / ah);
    cajas[i * 4 + 3] = Math.log((p.x1 - p.x0) / aw);
  });
  return { puntajes, cajas };
}

type Opciones = {
  personas?: PersonaSimulada[];
  config?: ConfigEpp;
  /** Medidas de la foto analizada. */
  ancho?: number;
  alto?: number;
  /** Demora de cada modelo (para el tiempo límite). */
  demoraMs?: number;
  /** Error al cargar los modelos. */
  falla?: boolean;
};

let opciones: Opciones = {};

export const llamadas = { detector: 0, clasificador: 0, recortes: [] as Caja[], liberadas: 0 };

const esperar = (ms?: number) => (ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Lo que verá el próximo análisis. Sin argumentos: una foto sin personas. */
export function simularAnalisisEpp(nuevas: Opciones = {}): void {
  opciones = nuevas;
  llamadas.detector = 0;
  llamadas.clasificador = 0;
  llamadas.recortes = [];
  llamadas.liberadas = 0;
}

/** Los modelos simulados con las personas de `simularAnalisisEpp` (en orden de puntaje para el clasificador). */
export function modelosSimulados(o: Opciones = opciones): ModelosEpp {
  const personas = o.personas ?? [];
  const porPuntaje = [...personas].sort((a, b) => (b.puntaje ?? 0.8) - (a.puntaje ?? 0.8));
  const detector: ModeloTflite = {
    inputs: [{ name: 'serving_default_images:0', dataType: 'uint8', shape: [1, 320, 320, 3] }],
    outputs: [tensor('StatefulPartitionedCall:1', [1, 19206, CLASES]), tensor('StatefulPartitionedCall:0', [1, 19206, 4])],
    run: async () => {
      llamadas.detector++;
      await esperar(o.demoraMs);
      const { puntajes, cajas } = salidasDetectorCon(personas);
      return [puntajes.buffer as ArrayBuffer, cajas.buffer as ArrayBuffer];
    },
  };
  let siguiente = 0;
  const clasificador: ModeloTflite = {
    inputs: [{ name: 'entrada', dataType: 'float32', shape: [1, 224, 224, 3] }],
    outputs: [tensor('Identity', [1, 2])],
    run: async () => {
      const persona = porPuntaje[siguiente++ % Math.max(porPuntaje.length, 1)];
      llamadas.clasificador++;
      await esperar(o.demoraMs);
      return [Float32Array.from([persona?.casco ?? 1, persona?.chaleco ?? 1]).buffer as ArrayBuffer];
    },
  };
  return { detector, clasificador, config: o.config ?? CONFIG_SIMULADA };
}

/** `cargarModelos` simulado. */
export async function cargarModelosSimulados(): Promise<ModelosEpp> {
  if (opciones.falla) {
    throw new Error('Modelo no disponible');
  }
  return modelosSimulados();
}

/** `abrirFoto` simulado: una foto de `ancho` × `alto` (1280 × 960 si no se dice). */
export async function abrirFotoSimulada(_uri: string): Promise<FotoParaAnalizar> {
  return {
    ancho: opciones.ancho ?? 1280,
    alto: opciones.alto ?? 960,
    entradaDetector: async (lado) => new Uint8Array(lado * lado * 3),
    recorte: async (caja, ancho, alto) => {
      llamadas.recortes.push(caja);
      return new Float32Array(ancho * alto * 3);
    },
    liberar: () => {
      llamadas.liberadas++;
    },
  };
}
