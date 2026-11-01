// Análisis de casco y chaleco de una foto, en el celular y sin conexión (301, criterios 1, 5, 7 y 10):
// detector de personas (EfficientDet-Lite0, 320 × 320) → personas con puntaje ≥ 0,50 y alto ≥ 64 px
// (máximo 10) → recorte de cada una (10 % de margen, 224 × 224) → clasificador de casco y chaleco →
// conteo con los umbrales de `epp.json`. La foto no sale del celular.
import { LADO_DETECTOR } from './anclas';
import { versionModelo } from './config';
import {
  cajaRecorte,
  contarEpp,
  decodificarPersonas,
  personasParaClasificar,
  suprimirNoMaximos,
  type Caja,
  type PersonaEpp,
  type Probabilidades,
} from './deteccion';
import { abrirFoto, type FotoParaAnalizar } from './imagen';
import { cargarModelos, leerProbabilidades, salidasDetector, type ModelosEpp } from './modelos';

/** Tiempo máximo de todo el análisis (criterio 5); si se pasa, el resultado se descarta. */
export const LIMITE_ANALISIS_MS = 5000;

/** Lo que se envía con la foto (`deteccion` de `FOTO_AVANCE`, criterio 6). */
export type DeteccionEpp = { personas: number; sinCasco: number; sinChaleco: number; versionModelo: string };

export type ResultadoEpp = DeteccionEpp & {
  /** Personas clasificadas, en píxeles de la foto analizada (para los recuadros). */
  cajas: PersonaEpp[];
  /** Medidas de la foto analizada. */
  ancho: number;
  alto: number;
};

export type DependenciasAnalisis = {
  modelos: () => Promise<ModelosEpp>;
  abrir: (uri: string) => Promise<FotoParaAnalizar>;
};

const dependenciasReales: DependenciasAnalisis = { modelos: cargarModelos, abrir: abrirFoto };

/** El `ArrayBuffer` exacto de un arreglo (puede ser una parte de uno más grande). */
function comoArrayBuffer(arreglo: Uint8Array | Float32Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = arreglo;
  return byteOffset === 0 && byteLength === buffer.byteLength
    ? (buffer as ArrayBuffer)
    : (buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer);
}

/** Analiza la foto comprimida (`uri`) con los dos modelos. */
export async function analizarFoto(
  uri: string,
  dependencias: DependenciasAnalisis = dependenciasReales,
): Promise<ResultadoEpp> {
  const { detector, clasificador, config } = await dependencias.modelos();
  const foto = await dependencias.abrir(uri);
  try {
    const { ancho, alto } = foto;
    const salidas = await detector.run([comoArrayBuffer(await foto.entradaDetector(LADO_DETECTOR))]);
    const indices = salidasDetector(detector);
    const candidatas = decodificarPersonas(
      new Float32Array(salidas[indices.puntajes]!),
      new Float32Array(salidas[indices.cajas]!),
      indices.clases,
    );
    const personas = personasParaClasificar(suprimirNoMaximos(candidatas), ancho, alto);
    const clasificadas: (Caja & { probabilidades: Probabilidades })[] = [];
    for (const persona of personas) {
      const recorte = await foto.recorte(cajaRecorte(persona, ancho, alto), config.entrada.ancho, config.entrada.alto);
      const probabilidades = leerProbabilidades(
        clasificador,
        await clasificador.run([comoArrayBuffer(recorte)]),
        config,
      );
      clasificadas.push({ x: persona.x, y: persona.y, ancho: persona.ancho, alto: persona.alto, probabilidades });
    }
    return { ...contarEpp(clasificadas, config.umbrales), versionModelo: versionModelo(config), ancho, alto };
  } finally {
    foto.liberar();
  }
}

export type EstadoAnalisis = { estado: 'listo'; resultado: ResultadoEpp } | { estado: 'fallo' };

/**
 * Analiza con el tiempo límite de 5 s (criterio 5): si falla o se pasa, `fallo` (la foto se envía sin
 * detección). Nunca rechaza.
 */
export async function analizarConLimite(
  uri: string,
  limiteMs = LIMITE_ANALISIS_MS,
  analizar: (uri: string) => Promise<ResultadoEpp> = (u) => analizarFoto(u),
): Promise<EstadoAnalisis> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<EstadoAnalisis>((resolver) => {
    temporizador = setTimeout(() => resolver({ estado: 'fallo' }), limiteMs);
  });
  const analisis = analizar(uri).then(
    (resultado): EstadoAnalisis => ({ estado: 'listo', resultado }),
    (error: unknown): EstadoAnalisis => {
      console.warn('[epp] no se pudo analizar la foto', error);
      return { estado: 'fallo' };
    },
  );
  try {
    return await Promise.race([analisis, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

/** `deteccion` para `datos` de `FOTO_AVANCE`: los cuatro campos del contrato, sin las cajas. */
export function deteccionParaEnvio(resultado: DeteccionEpp): DeteccionEpp {
  const { personas, sinCasco, sinChaleco, versionModelo: version } = resultado;
  return { personas, sinCasco, sinChaleco, versionModelo: version };
}
