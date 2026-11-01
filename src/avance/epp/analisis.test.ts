import {
  abrirFotoSimulada,
  CONFIG_SIMULADA,
  llamadas,
  modelosSimulados,
  simularAnalisisEpp,
  type PersonaSimulada,
} from '../../pruebas/epp-simulado';
import {
  AnalisisCancelado,
  analizarConLimite,
  analizarFoto,
  correrEnCola,
  deteccionParaEnvio,
  type ResultadoEpp,
} from './analisis';
import { cargarModelos } from './modelos';

const analizarCon = (personas: PersonaSimulada[], extra: Parameters<typeof simularAnalisisEpp>[0] = {}) => {
  simularAnalisisEpp({ personas, ...extra });
  return analizarFoto('file:///comprimida.jpg', { modelos: async () => modelosSimulados(), abrir: abrirFotoSimulada });
};

// Foto de 1280 × 960: alto 0,5 son 480 px.
const persona = (x0: number, casco: number, chaleco: number, puntaje = 0.8): PersonaSimulada => ({
  x0,
  y0: 0.2,
  x1: x0 + 0.1,
  y1: 0.7,
  puntaje,
  casco,
  chaleco,
});

describe('analizarFoto (con modelos simulados)', () => {
  it('cuenta las personas sin casco y sin chaleco y da la versión del modelo (criterios 1 y 6)', async () => {
    const resultado = await analizarCon([persona(0, 0.9, 0.9), persona(0.2, 0.1, 0.8), persona(0.4, 0.2, 0.3), persona(0.6, 0.9, 0.1)]);
    expect(resultado).toMatchObject({
      personas: 4,
      sinCasco: 2,
      sinChaleco: 2,
      versionModelo: 'epp-1.0.0',
      ancho: 1280,
      alto: 960,
    });
    expect(llamadas).toMatchObject({ detector: 1, clasificador: 4, liberadas: 1 });
  });

  it('recorta cada persona con 10 % de margen y deja su caja en píxeles de la foto', async () => {
    const resultado = await analizarCon([persona(0.5, 0.1, 0.9)]);
    expect(resultado.cajas).toHaveLength(1);
    const [caja] = resultado.cajas;
    expect(caja!.x).toBeCloseTo(640, 0);
    expect(caja!.y).toBeCloseTo(192, 0);
    expect(caja!.ancho).toBeCloseTo(128, 0);
    expect(caja!.alto).toBeCloseTo(480, 0);
    expect(caja).toMatchObject({ sinCasco: true, sinChaleco: false });
    const [recorte] = llamadas.recortes;
    expect(recorte!.x).toBeGreaterThanOrEqual(626);
    expect(recorte!.x).toBeLessThanOrEqual(628);
    expect(recorte!.alto).toBeGreaterThanOrEqual(575);
    expect(recorte!.alto).toBeLessThanOrEqual(578);
  });

  it('sin personas no llama al clasificador (criterio 4)', async () => {
    const resultado = await analizarCon([]);
    expect(resultado).toMatchObject({ personas: 0, sinCasco: 0, sinChaleco: 0, cajas: [] });
    expect(llamadas.clasificador).toBe(0);
  });

  it('no cuenta las personas con puntaje menor a 0,50 ni las de menos de 64 px de alto', async () => {
    const chica: PersonaSimulada = { x0: 0.8, y0: 0.1, x1: 0.85, y1: 0.16, casco: 0, chaleco: 0 };
    const resultado = await analizarCon([persona(0, 0, 0, 0.49), chica, persona(0.3, 1, 1)]);
    expect(resultado.personas).toBe(1);
    expect(llamadas.clasificador).toBe(1);
  });

  it('clasifica como máximo 10 personas', async () => {
    const personas = Array.from({ length: 12 }, (_, i) => persona(i * 0.08, 0, 0, 0.6 + i * 0.01));
    const resultado = await analizarCon(personas);
    expect(resultado.personas).toBe(10);
    expect(llamadas.clasificador).toBe(10);
  });

  it('usa los umbrales de epp.json', async () => {
    const config = { ...CONFIG_SIMULADA, umbrales: { casco: 0.95, chaleco: 0.05 } };
    const resultado = await analizarCon([persona(0, 0.9, 0.1)], { config });
    expect(resultado).toMatchObject({ sinCasco: 1, sinChaleco: 0 });
  });

  it('libera la foto aunque falle un modelo', async () => {
    simularAnalisisEpp({ personas: [persona(0, 1, 1)] });
    const modelos = modelosSimulados();
    modelos.clasificador.run = async () => {
      throw new Error('falla');
    };
    await expect(analizarFoto('file:///x.jpg', { modelos: async () => modelos, abrir: abrirFotoSimulada })).rejects.toThrow();
    expect(llamadas.liberadas).toBe(1);
  });

  it('por defecto usa cargarModelos (los modelos se cargan una vez al abrir la pantalla)', async () => {
    simularAnalisisEpp({ personas: [persona(0, 0.1, 0.1)] });
    const resultado = await analizarFoto('file:///comprimida.jpg');
    expect(cargarModelos).toHaveBeenCalled();
    expect(resultado).toMatchObject({ personas: 1, sinCasco: 1, sinChaleco: 1 });
  });
});

describe('un solo análisis a la vez sobre los modelos', () => {
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('las inferencias de dos análisis simultáneos nunca corren a la vez', async () => {
    simularAnalisisEpp({ personas: [persona(0, 1, 1), persona(0.3, 0, 0)] });
    const modelos = modelosSimulados();
    let activas = 0;
    let maximo = 0;
    for (const modelo of [modelos.detector, modelos.clasificador]) {
      const run = modelo.run.bind(modelo);
      modelo.run = async (entradas) => {
        activas++;
        maximo = Math.max(maximo, activas);
        await esperar(5);
        try {
          return await run(entradas);
        } finally {
          activas--;
        }
      };
    }
    const dependencias = { modelos: async () => modelos, abrir: abrirFotoSimulada };
    const [a, b] = await Promise.all([
      analizarFoto('file:///a.jpg', dependencias),
      analizarFoto('file:///b.jpg', dependencias),
    ]);
    expect(maximo).toBe(1);
    expect(a.personas).toBe(2);
    expect(b.personas).toBe(2);
  });

  it('copia las salidas: el modelo puede reutilizar su buffer en la siguiente inferencia', async () => {
    const compartido = Float32Array.from([0.1, 0.2]);
    const modelo = { run: async () => [compartido.buffer as ArrayBuffer] };
    const [salida] = await correrEnCola(modelo, []);
    compartido[0] = 0.9;
    expect(new Float32Array(salida!)[0]).toBeCloseTo(0.1);
  });

  it('un error de un modelo no traba la cola', async () => {
    await expect(correrEnCola({ run: async () => Promise.reject(new Error('falla')) }, [])).rejects.toThrow('falla');
    await expect(correrEnCola({ run: async () => [new ArrayBuffer(4)] }, [])).resolves.toHaveLength(1);
  });

  it('con la señal cancelada termina antes de la siguiente inferencia y libera la foto', async () => {
    simularAnalisisEpp({ personas: [persona(0, 1, 1), persona(0.3, 0, 0), persona(0.6, 1, 0)] });
    const control = new AbortController();
    const modelos = modelosSimulados();
    const clasificar = modelos.clasificador.run.bind(modelos.clasificador);
    modelos.clasificador.run = async (entradas) => {
      control.abort();
      return clasificar(entradas);
    };
    await expect(
      analizarFoto('file:///x.jpg', { modelos: async () => modelos, abrir: abrirFotoSimulada }, control.signal),
    ).rejects.toBeInstanceOf(AnalisisCancelado);
    expect(llamadas.clasificador).toBe(1);
    expect(llamadas.liberadas).toBe(1);
  });
});

describe('analizarConLimite (criterio 5)', () => {
  const resultado: ResultadoEpp = {
    personas: 1,
    sinCasco: 0,
    sinChaleco: 0,
    versionModelo: 'epp-1.0.0',
    cajas: [],
    ancho: 1,
    alto: 1,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('devuelve el resultado si termina a tiempo', async () => {
    await expect(analizarConLimite('u', 5000, async () => resultado)).resolves.toEqual({ estado: 'listo', resultado });
  });

  it('si falla, «fallo» (no rechaza)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      analizarConLimite('u', 5000, async () => {
        throw new Error('sin modelo');
      }),
    ).resolves.toEqual({ estado: 'fallo' });
  });

  it('si tarda más de 5 s, «fallo» y el resultado se descarta', async () => {
    jest.useFakeTimers();
    let terminar: (r: ResultadoEpp) => void = () => {};
    const promesa = analizarConLimite('u', 5000, () => new Promise((r) => (terminar = r)));
    await jest.advanceTimersByTimeAsync(4999);
    let estado: unknown = null;
    void promesa.then((e) => (estado = e));
    await jest.advanceTimersByTimeAsync(1);
    expect(estado).toEqual({ estado: 'fallo' });
    terminar(resultado);
    await expect(promesa).resolves.toEqual({ estado: 'fallo' });
  });

  it('al vencer, cancela el análisis para que deje de usar los modelos', async () => {
    jest.useFakeTimers();
    let senal: AbortSignal | null = null;
    const promesa = analizarConLimite('u', 5000, (_u, s) => {
      senal = s;
      return new Promise(() => {});
    });
    expect(senal!.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(5000);
    await expect(promesa).resolves.toEqual({ estado: 'fallo' });
    expect(senal!.aborted).toBe(true);
  });

  it('se puede cortar desde afuera (otra foto, «Otro control»)', async () => {
    const afuera = new AbortController();
    let senal: AbortSignal | null = null;
    const promesa = analizarConLimite(
      'u',
      5000,
      (_u, s) => {
        senal = s;
        return new Promise(() => {});
      },
      afuera.signal,
    );
    afuera.abort();
    await expect(promesa).resolves.toEqual({ estado: 'fallo' });
    expect(senal!.aborted).toBe(true);
  });

  it('una cancelación no se registra como error', async () => {
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    aviso.mockClear();
    await expect(
      analizarConLimite('u', 5000, async () => {
        throw new AnalisisCancelado();
      }),
    ).resolves.toEqual({ estado: 'fallo' });
    expect(aviso).not.toHaveBeenCalled();
  });

  it('el límite por defecto es de 5 s', async () => {
    jest.useFakeTimers();
    const promesa = analizarConLimite('u', undefined, () => new Promise(() => {}));
    await jest.advanceTimersByTimeAsync(5000);
    await expect(promesa).resolves.toEqual({ estado: 'fallo' });
  });
});

describe('deteccionParaEnvio', () => {
  it('solo los cuatro campos del contrato', () => {
    expect(
      deteccionParaEnvio({ personas: 4, sinCasco: 1, sinChaleco: 2, versionModelo: 'epp-1.0.0', cajas: [], ancho: 1, alto: 1 } as ResultadoEpp),
    ).toEqual({ personas: 4, sinCasco: 1, sinChaleco: 2, versionModelo: 'epp-1.0.0' });
  });
});
