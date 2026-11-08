// Carga de los dos modelos de TensorFlow Lite del análisis de casco y chaleco (301) con
// `react-native-fast-tflite`: una sola vez, al abrir la pantalla de foto o el control de seguridad.
// Delegado GPU en Android si el celular lo tiene; si no, CPU.
//
// La librería se pide con `require` dentro de la función: su módulo nativo no existe en Expo Go y, al
// importarla, falla en el momento. Así el resto de la app sigue funcionando en Expo Go y solo el
// análisis dice «No se pudo analizar la foto».
import { Platform } from 'react-native';
import type { TensorflowModelDelegate, TfliteModel } from 'react-native-fast-tflite';

import { leerConfigEpp, type ConfigEpp } from './config';
import type { Probabilidades } from './deteccion';

/** Lo que el análisis usa de un modelo (los simulados de las pruebas cumplen lo mismo). */
export type ModeloTflite = Pick<TfliteModel, 'inputs' | 'outputs' | 'run'>;

export type ModelosEpp = { detector: ModeloTflite; clasificador: ModeloTflite; config: ConfigEpp };

/** Un `require(...)` de un archivo empaquetado con la app, o una ruta. */
type FuenteModelo = number | { url: string };

export type FuentesModelos = { detector: FuenteModelo; clasificador: FuenteModelo; config: unknown };

type Cargador = (fuente: FuenteModelo, delegados: TensorflowModelDelegate[]) => Promise<ModeloTflite>;

/** Archivos de `assets/modelos/` (Metro empaqueta los `.tflite` por `metro.config.js`). */
function fuentesEmpaquetadas(): FuentesModelos {
  return {
    detector: require('../../../assets/modelos/efficientdet_lite0.tflite'),
    clasificador: require('../../../assets/modelos/clasificador_epp.tflite'),
    config: require('../../../assets/modelos/epp.json'),
  };
}

function cargadorTflite(): Cargador {
  const { loadTensorflowModel } = require('react-native-fast-tflite') as typeof import('react-native-fast-tflite');
  return loadTensorflowModel;
}

/** Carga un modelo con el delegado GPU (Android) y, si no se puede, en CPU. */
async function cargarConGpu(cargar: Cargador, fuente: FuenteModelo, os = Platform.OS): Promise<ModeloTflite> {
  if (os === 'android') {
    try {
      return await cargar(fuente, ['android-gpu']);
    } catch {
      // Sin OpenCL o con operaciones que el delegado no admite: CPU.
    }
  }
  return cargar(fuente, []);
}

/** Carga los dos modelos y la configuración (se prueba con un cargador simulado). */
export async function cargarModelosDesde(
  fuentes: FuentesModelos,
  cargar: Cargador,
  os: string = Platform.OS,
): Promise<ModelosEpp> {
  const config = leerConfigEpp(fuentes.config);
  const detector = await cargarConGpu(cargar, fuentes.detector, os as typeof Platform.OS);
  const clasificador = await cargarConGpu(cargar, fuentes.clasificador, os as typeof Platform.OS);
  return { detector, clasificador, config };
}

let cargando: Promise<ModelosEpp> | null = null;

/** Los modelos cargados, una sola vez por sesión de la app. Si falla, el próximo pedido lo reintenta. */
export function cargarModelos(): Promise<ModelosEpp> {
  if (!cargando) {
    cargando = Promise.resolve()
      .then(() => cargarModelosDesde(fuentesEmpaquetadas(), cargadorTflite()))
      .catch((error: unknown) => {
        cargando = null;
        throw error;
      });
  }
  return cargando;
}

/** Olvida los modelos cargados (pruebas). */
export function olvidarModelos(): void {
  cargando = null;
}

/** Salidas del detector: cuál trae los puntajes (`[1, anclas, clases]`) y cuál las cajas (`[1, anclas, 4]`). */
export function salidasDetector(detector: Pick<ModeloTflite, 'outputs'>): {
  puntajes: number;
  cajas: number;
  clases: number;
} {
  const ultima = (i: number) => detector.outputs[i]?.shape.at(-1) ?? 0;
  const cajas = detector.outputs.findIndex((_, i) => ultima(i) === 4);
  const puntajes = detector.outputs.findIndex((_, i) => i !== cajas && ultima(i) > 4);
  if (cajas < 0 || puntajes < 0) {
    throw new Error('El detector no tiene las salidas esperadas');
  }
  return { puntajes, cajas, clases: ultima(puntajes) };
}

/**
 * Probabilidades de casco y chaleco de una persona: con una salida de 2 valores, en el orden de
 * `config.salidas`; con dos salidas de 1 valor, cada una por su nombre (`casco`, `chaleco`) o, si no
 * lo dice, en ese orden.
 */
export function leerProbabilidades(
  clasificador: Pick<ModeloTflite, 'outputs'>,
  salidas: ArrayBuffer[],
  config: Pick<ConfigEpp, 'salidas'>,
): Probabilidades {
  const valores = salidas.map((s) => new Float32Array(s));
  const probabilidades: Partial<Probabilidades> = {};
  if (valores.length === 1 && valores[0]!.length === 2) {
    config.salidas.forEach((nombre, i) => {
      probabilidades[nombre] = valores[0]![i];
    });
  } else if (valores.length === 2) {
    const nombres = clasificador.outputs.map((t) => t.name.toLowerCase());
    const iCasco = nombres.findIndex((n) => n.includes('casco'));
    const iChaleco = nombres.findIndex((n) => n.includes('chaleco'));
    const porNombre = iCasco >= 0 && iChaleco >= 0 && iCasco !== iChaleco;
    config.salidas.forEach((nombre, i) => {
      const indice = porNombre ? (nombre === 'casco' ? iCasco : iChaleco) : i;
      probabilidades[nombre] = valores[indice]![0];
    });
  }
  const { casco, chaleco } = probabilidades;
  if (typeof casco !== 'number' || typeof chaleco !== 'number' || Number.isNaN(casco) || Number.isNaN(chaleco)) {
    throw new Error('El clasificador no tiene las salidas esperadas');
  }
  return { casco, chaleco };
}
