import { salidasDetectorCon } from '../../pruebas/epp-simulado';
import { anclasDetector } from './anclas';
import {
  cajaRecorte,
  contarEpp,
  decodificarPersonas,
  personasParaClasificar,
  pixelesRgb,
  suprimirNoMaximos,
  superposicion,
  type CajaNormalizada,
} from './deteccion';

const ancla = (anclas: Float32Array, i: number) => Array.from(anclas.subarray(i * 4, i * 4 + 4));

describe('anclas del detector', () => {
  it('son las 19 206 de los metadatos de efficientdet_lite0.tflite, en el mismo orden', () => {
    const anclas = anclasDetector();
    expect(anclas.length).toBe(19206 * 4);
    // Valores leídos de DETECTOR_METADATA del modelo de MediaPipe (x, y, ancho, alto).
    const esperadas: [number, number[]][] = [
      [0, [0.0125, 0.0125, 0.075, 0.075]],
      [1, [0.0125, 0.0125, 0.1060660183, 0.0530330092]],
      [2, [0.0125, 0.0125, 0.0530330092, 0.1060660183]],
      [3, [0.0125, 0.0125, 0.094494082, 0.094494082]],
      [9, [0.0375, 0.0125, 0.075, 0.075]],
      [14400, [0.025, 0.025, 0.15, 0.15]],
      [19205, [0.8333333, 0.8333333, 1.1224620342, 2.2449240685]],
    ];
    for (const [i, valores] of esperadas) {
      ancla(anclas, i).forEach((v, k) => expect(v).toBeCloseTo(valores[k]!, 6));
    }
  });
});

describe('decodificarPersonas', () => {
  // Dos anclas propias y 3 clases (la 0 es «person»).
  const anclas = Float32Array.from([0.5, 0.5, 0.2, 0.4, 0.2, 0.2, 0.1, 0.1]);

  it('decodifica centro y, centro x, alto y ancho respecto del ancla, con exponencial en el tamaño', () => {
    const puntajes = Float32Array.from([0.9, 0.1, 0.1, 0.3, 0.9, 0.9]);
    const cajas = Float32Array.from([0.1, -0.1, 0, Math.log(2), 0, 0, 0, 0]);
    const [persona, ...resto] = decodificarPersonas(puntajes, cajas, 3, 0.5, anclas);
    expect(resto).toEqual([]);
    expect(persona!.puntaje).toBeCloseTo(0.9);
    expect(persona!.x0).toBeCloseTo(0.28);
    expect(persona!.x1).toBeCloseTo(0.68);
    expect(persona!.y0).toBeCloseTo(0.34);
    expect(persona!.y1).toBeCloseTo(0.74);
  });

  it('solo la clase «person» con puntaje ≥ 0,50 y la caja dentro de la imagen', () => {
    const puntajes = Float32Array.from([0.5, 0, 0, 0.49, 0, 0]);
    const cajas = Float32Array.from([0, 0, Math.log(4), 0, 0, 0, 0, 0]);
    const personas = decodificarPersonas(puntajes, cajas, 3, 0.5, anclas);
    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({ y0: 0, y1: 1 });
  });

  it('con las anclas reales recupera las cajas codificadas', () => {
    const { puntajes, cajas } = salidasDetectorCon([{ x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.9, puntaje: 0.7 }]);
    const [persona] = decodificarPersonas(puntajes, cajas, 90);
    expect(persona!.x0).toBeCloseTo(0.1, 5);
    expect(persona!.y1).toBeCloseTo(0.9, 5);
    expect(persona!.puntaje).toBeCloseTo(0.7);
  });

  it('falla si las salidas no tienen el tamaño del modelo', () => {
    expect(() => decodificarPersonas(new Float32Array(10), new Float32Array(10), 90)).toThrow();
  });
});

describe('supresión de no máximos', () => {
  const caja = (x0: number, puntaje: number): CajaNormalizada => ({ x0, y0: 0, x1: x0 + 0.2, y1: 0.5, puntaje });

  it('superposicion es la intersección sobre la unión', () => {
    expect(superposicion(caja(0, 1), caja(0, 1))).toBeCloseTo(1);
    expect(superposicion(caja(0, 1), caja(0.1, 1))).toBeCloseTo(1 / 3);
    expect(superposicion(caja(0, 1), caja(0.5, 1))).toBe(0);
  });

  it('deja la de mayor puntaje entre las que se superponen más de 0,5', () => {
    const elegidas = suprimirNoMaximos([caja(0.02, 0.6), caja(0, 0.9), caja(0.5, 0.7)]);
    expect(elegidas.map((c) => c.puntaje)).toEqual([0.9, 0.7]);
  });
});

describe('personasParaClasificar', () => {
  const caja = (alto: number, puntaje: number): CajaNormalizada => ({ x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.1 + alto, puntaje });

  it('pasa las cajas a píxeles de la foto y quita las de menos de 64 px de alto', () => {
    // Foto de 1280 × 960: una de 65 px de alto queda y una de 63 px no.
    const personas = personasParaClasificar([caja(65 / 960, 0.8), caja(63 / 960, 0.9)], 1280, 960);
    expect(personas).toHaveLength(1);
    expect(personas[0]!.x).toBeCloseTo(128);
    expect(personas[0]!.ancho).toBeCloseTo(128);
    expect(personas[0]!.alto).toBeCloseTo(65);
  });

  it('como máximo 10, las de mayor puntaje', () => {
    const cajas = Array.from({ length: 12 }, (_, i) => caja(0.5, i / 20));
    const personas = personasParaClasificar(cajas, 1280, 960);
    expect(personas).toHaveLength(10);
    expect(personas[0]!.puntaje).toBeCloseTo(11 / 20);
    expect(personas[9]!.puntaje).toBeCloseTo(2 / 20);
  });
});

describe('cajaRecorte', () => {
  it('agrega 10 % de margen por lado, en píxeles enteros', () => {
    expect(cajaRecorte({ x: 100, y: 200, ancho: 100, alto: 300 }, 1280, 960)).toEqual({
      x: 90,
      y: 170,
      ancho: 120,
      alto: 360,
    });
  });

  it('no sale de la foto', () => {
    expect(cajaRecorte({ x: 5, y: 10, ancho: 100, alto: 940 }, 1280, 960)).toEqual({
      x: 0,
      y: 0,
      ancho: 115,
      alto: 960,
    });
  });
});

describe('contarEpp', () => {
  const persona = (casco: number, chaleco: number) => ({ x: 0, y: 0, ancho: 10, alto: 80, probabilidades: { casco, chaleco } });

  it('lleva casco o chaleco con probabilidad ≥ su umbral; cuenta las que no', () => {
    const conteo = contarEpp(
      [persona(0.9, 0.9), persona(0.2, 0.9), persona(0.6, 0.39), persona(0.59, 0.4)],
      { casco: 0.6, chaleco: 0.4 },
    );
    expect(conteo).toMatchObject({ personas: 4, sinCasco: 2, sinChaleco: 1 });
    expect(conteo.cajas.map((c) => [c.sinCasco, c.sinChaleco])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [true, false],
    ]);
  });

  it('sin personas, todo en 0', () => {
    expect(contarEpp([], { casco: 0.5, chaleco: 0.5 })).toEqual({ personas: 0, sinCasco: 0, sinChaleco: 0, cajas: [] });
  });
});

describe('pixelesRgb', () => {
  it('RGBA → RGB en uint8 (sin el canal alfa)', () => {
    const rgba = Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(Array.from(pixelesRgb(rgba, 4, 'uint8'))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('RGB → float32 de 0 a 255 para el clasificador', () => {
    const salida = pixelesRgb(Uint8Array.from([0, 128, 255]), 3, 'float32');
    expect(salida).toBeInstanceOf(Float32Array);
    expect(Array.from(salida)).toEqual([0, 128, 255]);
  });

  it('RGBA → float32', () => {
    expect(Array.from(pixelesRgb(Uint8Array.from([10, 20, 30, 0]), 4, 'float32'))).toEqual([10, 20, 30]);
  });
});
