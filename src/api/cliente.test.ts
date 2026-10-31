import {
  esperaReintento,
  fetchConTiempo,
  pedir,
  reintentarConsulta,
  urlServicio,
} from './cliente';
import { ErrorApi, esReintentable, mensajeDeFallo, type FalloApi } from './errores';
import { listarObras, obtenerObra, registrarFoto } from './obras';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';

const token = () => Promise.resolve('token-1');

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = simularFetch();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const falloDe = async (promesa: Promise<unknown>): Promise<FalloApi> => {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ErrorApi) {
      return error.fallo;
    }
    throw error;
  }
  throw new Error('no falló');
};

describe('pedir', () => {
  it('envía el token, X-Request-Id y el cuerpo JSON', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(201, { ok: true }));
    const respuesta = await pedir('http://obras/x', { obtenerToken: token, metodo: 'POST', cuerpo: { a: 1 } });
    expect(respuesta).toEqual({ estado: 201, datos: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://obras/x');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
      'X-Request-Id': expect.any(String),
    });
  });

  it('agrega los encabezados propios del servicio y acepta 304 sin cambios', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }));
    const respuesta = await pedir('http://sync/x', {
      obtenerToken: token,
      encabezados: { 'X-Dispositivo-Id': 'd-1', 'If-None-Match': '"v1"' },
    });
    expect(respuesta).toEqual({ estado: 304, datos: undefined });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'X-Dispositivo-Id': 'd-1',
      'If-None-Match': '"v1"',
    });
  });

  it('un error trae el codigo del Problem Details', async () => {
    fetchMock.mockResolvedValue(
      jsonRespuesta(422, { status: 422, codigo: 'PARTIDA_NO_ES_DE_LA_OBRA' }, 'application/problem+json'),
    );
    await expect(falloDe(pedir('http://obras/x', { obtenerToken: token }))).resolves.toMatchObject({
      tipo: 'http',
      estado: 422,
      codigo: 'PARTIDA_NO_ES_DE_LA_OBRA',
    });
  });

  it('sin codigo en el cuerpo usa el genérico del estado', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));
    await expect(falloDe(pedir('http://obras/x', { obtenerToken: token }))).resolves.toMatchObject({
      estado: 503,
      codigo: 'SERVICIO_NO_DISPONIBLE',
    });
  });

  it('sin respuesta → red; sin token → sin-sesion; la renovación sin red → red', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(falloDe(pedir('http://obras/x', { obtenerToken: token }))).resolves.toEqual({ tipo: 'red' });
    await expect(
      falloDe(pedir('http://obras/x', { obtenerToken: () => Promise.resolve(null) })),
    ).resolves.toEqual({ tipo: 'sin-sesion' });
    await expect(
      falloDe(pedir('http://obras/x', { obtenerToken: () => Promise.reject(new Error('sin red')) })),
    ).resolves.toEqual({ tipo: 'red' });
  });

  it('pasado el tiempo máximo → tiempo', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_ok, falla) => init.signal?.addEventListener('abort', () => falla(new Error('abort')))),
    );
    await expect(falloDe(fetchConTiempo('http://obras/x', {}, 10))).resolves.toEqual({ tipo: 'tiempo' });
  });
});

describe('reintentos de las consultas', () => {
  const error = (fallo: FalloApi) => new ErrorApi(fallo);

  it('hasta 3, a 1 s, 2 s y 4 s, solo si puede pasar solo', () => {
    expect([0, 1, 2].map(esperaReintento)).toEqual([1000, 2000, 4000]);
    expect(reintentarConsulta(0, error({ tipo: 'red' }))).toBe(true);
    expect(reintentarConsulta(2, error({ tipo: 'http', estado: 503, codigo: 'SERVICIO_NO_DISPONIBLE' }))).toBe(true);
    expect(reintentarConsulta(3, error({ tipo: 'red' }))).toBe(false);
    expect(reintentarConsulta(0, error({ tipo: 'http', estado: 404, codigo: 'OBRA_NO_ENCONTRADA' }))).toBe(false);
    expect(reintentarConsulta(0, new Error('otro'))).toBe(false);
  });

  it('esReintentable', () => {
    expect(esReintentable({ tipo: 'tiempo' })).toBe(true);
    expect(esReintentable({ tipo: 'http', estado: 429, codigo: 'DEMASIADAS_PETICIONES' })).toBe(true);
    expect(esReintentable({ tipo: 'http', estado: 403, codigo: 'SIN_PERMISO' })).toBe(false);
    expect(esReintentable({ tipo: 'sin-sesion' })).toBe(false);
  });
});

describe('URLs de los servicios (app.json → extra)', () => {
  it('Obras en obrasUrl, Materiales en materialesUrl y Sincronización en sincronizacionUrl', () => {
    expect(urlServicio('obras', '/obras')).toBe('http://localhost:8081/obras');
    expect(urlServicio('materiales', '/movimientos')).toBe('http://localhost:8082/movimientos');
    expect(urlServicio('sincronizacion', '/lotes')).toBe('http://localhost:8084/lotes');
  });
});

describe('mensajes (docs/mensajes.md)', () => {
  it('por codigo, por estado si no lo conoce, y sin red', () => {
    expect(mensajeDeFallo({ tipo: 'http', estado: 404, codigo: 'OBRA_NO_ENCONTRADA' })).toBe('Obra no encontrada');
    expect(mensajeDeFallo({ tipo: 'http', estado: 422, codigo: 'OTRO' })).toBe(
      'No se pudo completar la operación porque no cumple una regla del sistema.',
    );
    expect(mensajeDeFallo({ tipo: 'http', estado: 502, codigo: 'X' })).toBe(
      'Ocurrió un error inesperado. Intenta de nuevo; si se repite, avisa a soporte.',
    );
    expect(mensajeDeFallo({ tipo: 'red' })).toBe(
      'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
    );
  });
});

describe('Obras', () => {
  it('GET /obras y GET /obras/{id} contra obrasUrl de app.json', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRespuesta(200, [{ id: 'o1', nombre: 'Edificio', ubicacion: 'SCZ', estado: 'EN_EJECUCION' }]))
      .mockResolvedValueOnce(
        jsonRespuesta(200, {
          id: 'o1', nombre: 'Edificio', ubicacion: 'SCZ', estado: 'EN_EJECUCION',
          partidas: [{ id: 'p1', codigo: 'P-01', nombre: 'Losa', unidad: 'm2' }],
        }),
      );
    await expect(listarObras(token)).resolves.toHaveLength(1);
    await expect(obtenerObra('o1', token)).resolves.toMatchObject({ partidas: [{ codigo: 'P-01' }] });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8081/obras',
      'http://localhost:8081/obras/o1',
    ]);
  });

  it('una respuesta fuera del contrato es respuesta-invalida', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(200, [{ id: 1 }]));
    await expect(falloDe(listarObras(token))).resolves.toEqual({ tipo: 'respuesta-invalida' });
  });

  it('registrarFoto: 201 es nueva y 200 es repetida (criterio 4)', async () => {
    const registro = { id: 'f1', partidaId: 'p1', claveArchivo: 'fotos/o1/f1.jpg', tomadaEn: '2026-11-15T15:20:00Z' };
    fetchMock
      .mockResolvedValueOnce(jsonRespuesta(201, { id: 'f1', partidaId: 'p1' }))
      .mockResolvedValueOnce(jsonRespuesta(200, { id: 'f1', partidaId: 'p1' }));
    await expect(registrarFoto('o1', registro, token)).resolves.toMatchObject({ yaExistia: false });
    await expect(registrarFoto('o1', registro, token)).resolves.toMatchObject({ yaExistia: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(registro);
  });
});
