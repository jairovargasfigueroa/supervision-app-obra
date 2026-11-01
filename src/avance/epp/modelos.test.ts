import { CONFIG_SIMULADA } from '../../pruebas/epp-simulado';
import { leerConfigEpp, versionModelo } from './config';
import { cargarModelosDesde, leerProbabilidades, salidasDetector, type ModeloTflite } from './modelos';

const tensor = (name: string, shape: number[]) => ({ name, dataType: 'float32' as const, shape });
const modelo = (outputs: ReturnType<typeof tensor>[]): ModeloTflite => ({ inputs: [], outputs, run: jest.fn() });
// Valores exactos en float32 (0,25, 0,5, 0,75…) para comparar con toEqual.
const buffer = (...valores: number[]) => Float32Array.from(valores).buffer as ArrayBuffer;

describe('epp.json', () => {
  it('lee el epp.json que escribe el entrenamiento', () => {
    const config = leerConfigEpp({
      version: '1.0.0',
      versionModelo: 'epp-1.0.0',
      entrada: { alto: 224, ancho: 224, canales: 3, tipo: 'float32', rango: [0, 255] },
      salidas: ['casco', 'chaleco'],
      umbrales: { casco: 0.67, chaleco: 0.35 },
    });
    expect(config).toEqual({
      version: '1.0.0',
      versionModelo: 'epp-1.0.0',
      entrada: { alto: 224, ancho: 224, canales: 3, tipo: 'float32' },
      salidas: ['casco', 'chaleco'],
      umbrales: { casco: 0.67, chaleco: 0.35 },
    });
    expect(versionModelo(config)).toBe('epp-1.0.0');
  });

  it('si faltan, entrada de 224 × 224, salidas casco, chaleco y versionModelo epp-<versión>', () => {
    const config = leerConfigEpp({ version: '1.1.0', umbrales: { casco: 0.42, chaleco: 0.5 } });
    expect(config.entrada).toEqual({ alto: 224, ancho: 224, canales: 3, tipo: 'float32' });
    expect(config.salidas).toEqual(['casco', 'chaleco']);
    expect(versionModelo(config)).toBe('epp-1.1.0');
  });

  it('rechaza umbrales fuera de 0 a 1, sin versión o con una versión que no entra en 40 caracteres', () => {
    expect(() => leerConfigEpp({ version: '1.0.0', umbrales: { casco: 1.2, chaleco: 0.5 } })).toThrow();
    expect(() => leerConfigEpp({ umbrales: { casco: 0.5, chaleco: 0.5 } })).toThrow();
    expect(() => leerConfigEpp({ version: 'x'.repeat(37), umbrales: { casco: 0.5, chaleco: 0.5 } })).toThrow();
    expect(() => leerConfigEpp({ version: '1', versionModelo: 'x'.repeat(41), umbrales: { casco: 0.5, chaleco: 0.5 } })).toThrow();
    expect(() => leerConfigEpp({ version: '1', salidas: ['casco', 'casco'], umbrales: { casco: 0.5, chaleco: 0.5 } })).toThrow();
  });
});

describe('cargarModelosDesde', () => {
  const fuentes = { detector: 1, clasificador: 2, config: CONFIG_SIMULADA };

  it('en Android usa el delegado GPU', async () => {
    const cargar = jest.fn(async () => modelo([]));
    await cargarModelosDesde(fuentes, cargar, 'android');
    expect(cargar.mock.calls).toEqual([
      [1, ['android-gpu']],
      [2, ['android-gpu']],
    ]);
  });

  it('si el celular no tiene GPU (o el modelo no se puede delegar), carga en CPU', async () => {
    const cargar = jest.fn(async (_fuente: unknown, delegados: string[]) => {
      if (delegados.length > 0) {
        throw new Error('sin OpenCL');
      }
      return modelo([]);
    });
    const modelos = await cargarModelosDesde(fuentes, cargar, 'android');
    expect(modelos.config.version).toBe('1.0.0');
    expect(cargar.mock.calls.map(([f, d]) => [f, d])).toEqual([
      [1, ['android-gpu']],
      [1, []],
      [2, ['android-gpu']],
      [2, []],
    ]);
  });

  it('con un epp.json inválido falla antes de cargar', async () => {
    const cargar = jest.fn();
    await expect(cargarModelosDesde({ ...fuentes, config: {} }, cargar, 'android')).rejects.toThrow();
    expect(cargar).not.toHaveBeenCalled();
  });
});

describe('salidas de los modelos', () => {
  it('detector: los puntajes son la salida de 90 clases y las cajas la de 4 valores, en cualquier orden', () => {
    const mediapipe = modelo([tensor('StatefulPartitionedCall:1', [1, 19206, 90]), tensor('StatefulPartitionedCall:0', [1, 19206, 4])]);
    expect(salidasDetector(mediapipe)).toEqual({ puntajes: 0, cajas: 1, clases: 90 });
    const alReves = modelo([tensor('b', [1, 19206, 4]), tensor('a', [1, 19206, 90])]);
    expect(salidasDetector(alReves)).toEqual({ puntajes: 1, cajas: 0, clases: 90 });
    expect(() => salidasDetector(modelo([tensor('a', [1, 10])]))).toThrow();
  });

  it('clasificador con una salida de 2 valores: en el orden de epp.json', () => {
    const clasificador = modelo([tensor('Identity', [1, 2])]);
    expect(leerProbabilidades(clasificador, [buffer(0.25, 0.75)], CONFIG_SIMULADA)).toEqual({ casco: 0.25, chaleco: 0.75 });
    expect(leerProbabilidades(clasificador, [buffer(0.25, 0.75)], { salidas: ['chaleco', 'casco'] })).toEqual({
      casco: 0.75,
      chaleco: 0.25,
    });
  });

  it('clasificador con dos salidas: cada una por su nombre', () => {
    const clasificador = modelo([tensor('StatefulPartitionedCall:chaleco', [1, 1]), tensor('StatefulPartitionedCall:casco', [1, 1])]);
    expect(leerProbabilidades(clasificador, [buffer(0.25), buffer(0.75)], CONFIG_SIMULADA)).toEqual({ casco: 0.75, chaleco: 0.25 });
  });

  it('clasificador con dos salidas sin nombre reconocible: en el orden de epp.json', () => {
    const clasificador = modelo([tensor('Identity', [1, 1]), tensor('Identity_1', [1, 1])]);
    expect(leerProbabilidades(clasificador, [buffer(0.25), buffer(0.75)], CONFIG_SIMULADA)).toEqual({ casco: 0.25, chaleco: 0.75 });
  });

  it('falla si el clasificador no devuelve dos probabilidades', () => {
    expect(() => leerProbabilidades(modelo([tensor('a', [1, 3])]), [buffer(1, 2, 3)], CONFIG_SIMULADA)).toThrow();
  });
});
