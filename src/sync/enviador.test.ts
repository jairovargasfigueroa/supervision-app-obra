import type { PaqueteDatos, ResultadoLote } from '../api/sincronizacion';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';
import { agregar, listar, obtener, type NuevaOperacion } from './cola';
import { idDispositivo } from './dispositivo';
import { enviarPendientes, esperaCreciente } from './enviador';
import { guardarPaquete, leerPaquete } from './paquete';

const T0 = new Date('2026-11-15T14:00:00.000Z');
const ahora = () => T0;
const azar = () => 0.5; // factor 1,0

function nueva(id: string, usuarioId = 'u1', creada = 0): [NuevaOperacion, Date] {
  return [
    {
      idOperacion: id,
      usuarioId,
      usuarioNombre: 'Ana',
      tipo: 'MOVIMIENTO_MATERIAL',
      obraId: 'obra-1',
      datos: {
        id,
        obraId: 'obra-1',
        materialId: 'mat-1',
        tipo: 'SALIDA',
        cantidad: 12.5,
        partidaId: 'p-1',
        registradoEn: T0.toISOString(),
      },
      descripcion: 'Salida · 12,5 bolsas de Cemento IP-30 · P-01',
    },
    new Date(T0.getTime() - 60_000 + creada),
  ];
}

const procesado = (id: string, cantidad = 107.5): ResultadoLote => ({
  idOperacion: id,
  estado: 'PROCESADO',
  repetida: false,
  status: 201,
  respuesta: { id, periodo: '2026-11', superaStock: false, stock: { cantidad, minimo: 100, estado: 'JUSTO' } },
});

const problema = (status: number, codigo: string, detail?: string) => ({
  title: 'x',
  status,
  codigo,
  ...(detail ? { detail } : {}),
});

type Lote = { operaciones: { idOperacion: string; tipo: string; creadaEn: string; datos: unknown }[] };

/**
 * Red simulada de Sincronización: `POST /lotes` responde con `alLote` (por lote recibido) y
 * `GET /paquete-datos` con un 304.
 */
function simularSincronizacion(alLote: (lote: Lote, n: number) => Response | Promise<Response>) {
  const lotes: Lote[] = [];
  const red = simularFetch().mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith('/lotes')) {
      const lote = JSON.parse(String(init.body)) as Lote;
      lotes.push(lote);
      return alLote(lote, lotes.length);
    }
    if (url.includes('/paquete-datos')) {
      return new Response(null, { status: 304 });
    }
    throw new TypeError('Network request failed');
  });
  return { red, lotes };
}

const todoProcesado = (lote: Lote) =>
  jsonRespuesta(200, { resultados: lote.operaciones.map((o) => procesado(o.idOperacion)) });

const obtenerToken = jest.fn<Promise<string | null>, [{ renovar?: boolean }?]>();
beforeEach(() => {
  obtenerToken.mockReset();
  obtenerToken.mockResolvedValue('token-1');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const enviar = (usuarioId = 'u1') => enviarPendientes({ usuarioId, obtenerToken, ahora, azar });

describe('esperaCreciente', () => {
  it('1 s, 2 s, 4 s… hasta 5 minutos, por un factor entre 0,8 y 1,2', () => {
    expect([1, 2, 3, 4].map((n) => esperaCreciente(n, azar))).toEqual([1000, 2000, 4000, 8000]);
    expect(esperaCreciente(9, azar)).toBe(256_000);
    expect(esperaCreciente(10, azar)).toBe(300_000);
    expect(esperaCreciente(50, azar)).toBe(300_000);
    expect(esperaCreciente(1, () => 0)).toBe(800);
    expect(esperaCreciente(1, () => 0.999_999)).toBe(1200);
    for (let i = 0; i < 50; i++) {
      const ms = esperaCreciente(3);
      expect(ms).toBeGreaterThanOrEqual(3200);
      expect(ms).toBeLessThanOrEqual(4800);
    }
  });
});

describe('enviarPendientes', () => {
  it('envía en un lote, en orden, con X-Dispositivo-Id, y marca ENVIADO con la respuesta', async () => {
    await agregar(...nueva('b', 'u1', 2));
    await agregar(...nueva('a', 'u1', 1));
    const { red, lotes } = simularSincronizacion(todoProcesado);

    await expect(enviar()).resolves.toEqual({ enviadas: 2, rechazadas: 0, reintentos: 0 });

    expect(lotes).toHaveLength(1);
    expect(lotes[0].operaciones.map((o) => o.idOperacion)).toEqual(['a', 'b']);
    expect(lotes[0].operaciones[0]).toEqual({
      idOperacion: 'a',
      tipo: 'MOVIMIENTO_MATERIAL',
      creadaEn: nueva('a', 'u1', 1)[1].toISOString(),
      datos: nueva('a')[0].datos,
    });
    const [url, init] = red.mock.calls[0];
    expect(url).toBe('http://localhost:8084/lotes');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'X-Dispositivo-Id': await idDispositivo(),
    });
    expect(await obtener('a')).toMatchObject({
      estado: 'ENVIADO',
      enviadaEn: T0.toISOString(),
      respuesta: procesado('a').respuesta,
    });
  });

  it('actualiza el stock del paquete local con la respuesta y vuelve a pedir el paquete', async () => {
    const paquete: PaqueteDatos = {
      versionDatos: 'v1',
      generadoEn: T0.toISOString(),
      obras: [
        {
          id: 'obra-1',
          nombre: 'Obra',
          ubicacion: 'Calle',
          partidas: [],
          stock: [{ materialId: 'mat-1', cantidad: 120, minimo: 100, estado: 'OK' }],
        },
      ],
      materiales: [],
    };
    await guardarPaquete('u1', paquete, T0.toISOString());
    await agregar(...nueva('a'));
    const { red } = simularSincronizacion(todoProcesado);

    await enviar();

    const guardado = await leerPaquete('u1');
    expect(guardado?.contenido.obras[0].stock).toEqual([
      { materialId: 'mat-1', cantidad: 107.5, minimo: 100, estado: 'JUSTO' },
    ]);
    const pedidoPaquete = red.mock.calls.find(([u]) => String(u).includes('/paquete-datos'));
    expect(pedidoPaquete?.[1].headers['If-None-Match']).toBe('"v1"');
  });

  it('ERROR → RECHAZADO con el código (y el detail solo para soporte); no se reintenta', async () => {
    await agregar(...nueva('a'));
    const { lotes } = simularSincronizacion(() =>
      jsonRespuesta(200, {
        resultados: [
          {
            idOperacion: 'a',
            estado: 'ERROR',
            repetida: true,
            status: 409,
            respuesta: problema(409, 'PERIODO_CERRADO', 'El periodo 2026-10 ya está cerrado.'),
          },
        ],
      }),
    );

    await expect(enviar()).resolves.toEqual({ enviadas: 0, rechazadas: 1, reintentos: 0 });
    expect(await obtener('a')).toMatchObject({
      estado: 'RECHAZADO',
      errorCodigo: 'PERIODO_CERRADO',
      errorMensaje: 'El periodo 2026-10 ya está cerrado.',
    });
    await enviar();
    expect(lotes).toHaveLength(1);
  });

  it('REINTENTAR → PENDIENTE con un intento más y espera creciente', async () => {
    await agregar(...nueva('a'));
    await agregar(...nueva('b', 'u1', 1));
    simularSincronizacion(() =>
      jsonRespuesta(200, {
        resultados: [
          procesado('a'),
          { idOperacion: 'b', estado: 'REINTENTAR', status: 503, respuesta: problema(503, 'SERVICIO_NO_DISPONIBLE') },
        ],
      }),
    );

    await expect(enviar()).resolves.toEqual({ enviadas: 1, rechazadas: 0, reintentos: 1 });
    expect(await obtener('b')).toMatchObject({
      estado: 'PENDIENTE',
      intentos: 1,
      proximoIntentoEn: new Date(T0.getTime() + 1000).toISOString(),
      errorCodigo: 'SERVICIO_NO_DISPONIBLE',
    });
  });

  it('si falla el lote completo, todas vuelven a PENDIENTE con espera creciente y se detiene', async () => {
    await agregar(...nueva('a'));
    await agregar(...nueva('b', 'u1', 1));
    const { lotes } = simularSincronizacion(() =>
      jsonRespuesta(503, problema(503, 'SERVICIO_NO_DISPONIBLE')),
    );

    await expect(enviar()).resolves.toEqual({ enviadas: 0, rechazadas: 0, reintentos: 2, detenido: 'lote' });
    expect(lotes).toHaveLength(1);
    for (const op of await listar('u1')) {
      expect(op).toMatchObject({ estado: 'PENDIENTE', intentos: 1, proximoIntentoEn: '2026-11-15T14:00:01.000Z' });
    }
  });

  it('sin señal o con tiempo agotado: vuelven a PENDIENTE y queda detenido por la red', async () => {
    await agregar(...nueva('a'));
    simularFetch(); // sin red

    await expect(enviar()).resolves.toMatchObject({ reintentos: 1, detenido: 'sin-red' });
    expect(await obtener('a')).toMatchObject({ estado: 'PENDIENTE', intentos: 1 });
  });

  it('la espera crece con cada intento fallido', async () => {
    await agregar(...nueva('a'));
    let momento = T0;
    simularFetch();
    for (const esperado of [1000, 2000, 4000]) {
      await enviarPendientes({ usuarioId: 'u1', obtenerToken, ahora: () => momento, azar });
      const op = await obtener('a');
      expect(Date.parse(op!.proximoIntentoEn!) - momento.getTime()).toBe(esperado);
      momento = new Date(op!.proximoIntentoEn!);
    }
  });

  it('TOKEN_VENCIDO → renueva el token antes del siguiente lote', async () => {
    await agregar(...nueva('a'));
    simularSincronizacion(() =>
      jsonRespuesta(200, {
        resultados: [{ idOperacion: 'a', estado: 'REINTENTAR', status: 401, respuesta: problema(401, 'TOKEN_VENCIDO') }],
      }),
    );

    await enviar();
    expect(obtenerToken.mock.calls[0][0]).toBeUndefined();
    expect(obtenerToken).toHaveBeenCalledWith({ renovar: true });
    expect(await obtener('a')).toMatchObject({ estado: 'PENDIENTE', errorCodigo: 'TOKEN_VENCIDO' });
  });

  it('un 401 del lote renueva el token y lo vuelve a enviar una vez', async () => {
    await agregar(...nueva('a'));
    const { lotes } = simularSincronizacion((lote, n) =>
      n === 1 ? jsonRespuesta(401, problema(401, 'NO_AUTENTICADO')) : todoProcesado(lote),
    );

    await expect(enviar()).resolves.toEqual({ enviadas: 1, rechazadas: 0, reintentos: 0 });
    expect(lotes).toHaveLength(2);
    expect(obtenerToken).toHaveBeenCalledWith({ renovar: true });
    expect((await obtener('a'))?.intentos).toBe(0);
  });

  it('400 LOTE_INVALIDO → las del lote quedan RECHAZADO', async () => {
    await agregar(...nueva('a'));
    simularSincronizacion(() => jsonRespuesta(400, problema(400, 'LOTE_INVALIDO')));

    await expect(enviar()).resolves.toEqual({ enviadas: 0, rechazadas: 1, reintentos: 0 });
    expect(await obtener('a')).toMatchObject({ estado: 'RECHAZADO', errorCodigo: 'LOTE_INVALIDO' });
  });

  it('más de 20: lotes de 20 en orden hasta vaciar la cola', async () => {
    for (let i = 0; i < 45; i++) {
      await agregar(...nueva(`op-${String(i).padStart(2, '0')}`, 'u1', i));
    }
    const { lotes } = simularSincronizacion(todoProcesado);

    await expect(enviar()).resolves.toMatchObject({ enviadas: 45 });
    expect(lotes.map((l) => l.operaciones.length)).toEqual([20, 20, 5]);
    expect(lotes.flatMap((l) => l.operaciones.map((o) => o.idOperacion))).toEqual(
      Array.from({ length: 45 }, (_, i) => `op-${String(i).padStart(2, '0')}`),
    );
  });

  it('solo envía las del usuario de la sesión', async () => {
    await agregar(...nueva('mia'));
    await agregar(...nueva('ajena', 'u2'));
    const { lotes } = simularSincronizacion(todoProcesado);

    await enviar('u1');
    expect(lotes.flatMap((l) => l.operaciones.map((o) => o.idOperacion))).toEqual(['mia']);
    expect((await obtener('ajena'))?.estado).toBe('PENDIENTE');
  });

  it('sin poder renovar el token no toca la cola: sin red o sin sesión', async () => {
    await agregar(...nueva('a'));
    const { lotes } = simularSincronizacion(todoProcesado);

    obtenerToken.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(enviar()).resolves.toMatchObject({ enviadas: 0, detenido: 'sin-red' });
    obtenerToken.mockResolvedValueOnce(null);
    await expect(enviar()).resolves.toMatchObject({ enviadas: 0, detenido: 'sin-sesion' });

    expect(lotes).toHaveLength(0);
    expect(await obtener('a')).toMatchObject({ estado: 'PENDIENTE', intentos: 0 });
  });

  it('un solo envío a la vez: lo agregado durante el envío sale en otra vuelta', async () => {
    await agregar(...nueva('a'));
    let soltar!: () => void;
    const espera = new Promise<void>((listo) => {
      soltar = listo;
    });
    const { lotes } = simularSincronizacion(async (lote, n) => {
      if (n === 1) {
        await espera;
      }
      return todoProcesado(lote);
    });

    const primero = enviar();
    await new Promise((listo) => setTimeout(listo, 10));
    await agregar(...nueva('b', 'u1', 5));
    const segundo = enviar();
    expect(segundo).toBe(primero);
    soltar();

    await expect(primero).resolves.toMatchObject({ enviadas: 2 });
    expect(lotes.map((l) => l.operaciones.map((o) => o.idOperacion))).toEqual([['a'], ['b']]);
  });
});
