import { TIEMPO_MAXIMO_MS } from './cliente';
import { ErrorApi, type FalloApi } from './errores';
import {
  listarMaterialesActivos,
  obtenerStock,
  registrarMovimiento,
  type RegistroMovimiento,
} from './materiales';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';

// Cliente REST hacia Materiales (004): URLs de app.json, reintentos 1-2-4 s con el mismo `id`,
// 201/200 y validación de las respuestas.
const token = () => Promise.resolve('token-1');
const sinEsperar = { esperar: () => Promise.resolve() };

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

const REGISTRO: RegistroMovimiento = {
  id: '7f1c2a9e-5b8d-4c3a-9e21-0d6f4b8a1c33',
  obraId: 'o1',
  materialId: 'm1',
  tipo: 'SALIDA',
  cantidad: 12.5,
  partidaId: 'p1',
  registradoEn: '2026-11-15T14:00:00.000Z',
};
const RESPUESTA = {
  id: REGISTRO.id,
  periodo: '2026-11',
  superaStock: false,
  stock: { cantidad: 107.5, minimo: 100, estado: 'JUSTO' },
};
const servicioCaido = () => jsonRespuesta(503, { codigo: 'SERVICIO_NO_DISPONIBLE' }, 'application/problem+json');
const sinRed = () => Promise.reject(new TypeError('Network request failed'));
const cuerpos = () => fetchMock.mock.calls.map(([, init]) => init.body as string);
const requestIds = () => fetchMock.mock.calls.map(([, init]) => init.headers['X-Request-Id'] as string);

describe('POST /movimientos', () => {
  it('envía el registro a materialesUrl con el token; 201 es nuevo', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(201, RESPUESTA));
    await expect(registrarMovimiento(REGISTRO, token)).resolves.toEqual({
      movimiento: RESPUESTA,
      yaExistia: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8082/movimientos');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(REGISTRO);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-1', 'Content-Type': 'application/json' });
  });

  it('200 (el id ya existía) cuenta como registrado (criterio 6)', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(200, { ...RESPUESTA, superaStock: true }));
    await expect(registrarMovimiento(REGISTRO, token)).resolves.toMatchObject({
      yaExistia: true,
      movimiento: { superaStock: true },
    });
  });

  it('sin red o con 503 lo repite a 1 s, 2 s y 4 s con el mismo cuerpo y el mismo id', async () => {
    const esperas: number[] = [];
    fetchMock
      .mockImplementationOnce(sinRed)
      .mockResolvedValueOnce(servicioCaido())
      .mockImplementationOnce(sinRed)
      .mockResolvedValueOnce(jsonRespuesta(200, RESPUESTA));
    await expect(
      registrarMovimiento(REGISTRO, token, { esperar: async (ms) => void esperas.push(ms) }),
    ).resolves.toMatchObject({ yaExistia: true });
    expect(esperas).toEqual([1000, 2000, 4000]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Mismo cuerpo (mismo id del celular) en los cuatro intentos; X-Request-Id distinto en cada pedido.
    expect(new Set(cuerpos())).toEqual(new Set([JSON.stringify(REGISTRO)]));
    expect(new Set(requestIds()).size).toBe(4);
  });

  it('tras 3 reintentos sin red se rinde con el error de red', async () => {
    fetchMock.mockImplementation(sinRed);
    await expect(falloDe(registrarMovimiento(REGISTRO, token, sinEsperar))).resolves.toEqual({ tipo: 'red' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('el tiempo agotado también se reintenta', async () => {
    jest.useFakeTimers();
    try {
      fetchMock
        .mockImplementationOnce(
          (_url: string, init: RequestInit) =>
            new Promise((_ok, falla) => init.signal?.addEventListener('abort', () => falla(new Error('abort')))),
        )
        .mockResolvedValueOnce(jsonRespuesta(201, RESPUESTA));
      const registro = registrarMovimiento(REGISTRO, token, sinEsperar);
      await jest.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);
      await expect(registro).resolves.toMatchObject({ yaExistia: false });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(cuerpos()[1]).toBe(cuerpos()[0]);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    [409, 'PERIODO_CERRADO'],
    [422, 'MATERIAL_INACTIVO'],
    [404, 'OBRA_NO_ENCONTRADA'],
    [403, 'SIN_PERMISO'],
    [400, 'DATOS_INVALIDOS'],
    [500, 'ERROR_INTERNO'],
  ])('%i %s no se reintenta', async (estado, codigo) => {
    fetchMock.mockResolvedValue(jsonRespuesta(estado, { status: estado, codigo }, 'application/problem+json'));
    await expect(falloDe(registrarMovimiento(REGISTRO, token, sinEsperar))).resolves.toMatchObject({
      tipo: 'http',
      estado,
      codigo,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('una respuesta fuera del contrato es respuesta-invalida (sin reintentar)', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(201, { id: REGISTRO.id }));
    await expect(falloDe(registrarMovimiento(REGISTRO, token, sinEsperar))).resolves.toEqual({
      tipo: 'respuesta-invalida',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /materiales?soloActivos=true', () => {
  const material = (n: number) => ({
    id: `m${n}`, codigo: `MAT-${n}`, nombre: `Material ${n}`, tipo: 'OTRO',
    unidad: 'pieza', unidadPlural: 'piezas', precioReferencial: 1, activo: true, atributos: [],
  });

  it('pide todas las páginas de 100 hasta completar el total', async () => {
    const primera = Array.from({ length: 100 }, (_, i) => material(i + 1));
    fetchMock
      .mockResolvedValueOnce(jsonRespuesta(200, { items: primera, total: 102, pagina: 1, tamano: 100 }))
      .mockResolvedValueOnce(
        jsonRespuesta(200, { items: [material(101), material(102)], total: 102, pagina: 2, tamano: 100 }),
      );
    const materiales = await listarMaterialesActivos(token);
    expect(materiales).toHaveLength(102);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8082/materiales?soloActivos=true&pagina=1&tamano=100',
      'http://localhost:8082/materiales?soloActivos=true&pagina=2&tamano=100',
    ]);
  });

  it('una página vacía termina la lista', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(200, { items: [], total: 5, pagina: 1, tamano: 100 }));
    await expect(listarMaterialesActivos(token)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /obras/{obraId}/stock', () => {
  const fila = {
    materialId: 'm1', codigo: 'CEM-IP30', nombre: 'Cemento IP-30', unidad: 'bolsa',
    unidadPlural: 'bolsas', cantidad: 120, minimo: 100, estado: 'JUSTO',
  };

  it('devuelve las filas de la obra', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(200, [fila]));
    await expect(obtenerStock('o1', token)).resolves.toEqual([fila]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8082/obras/o1/stock');
  });

  it('un estado que no es BAJO, JUSTO ni OK es respuesta-invalida', async () => {
    fetchMock.mockResolvedValue(jsonRespuesta(200, [{ ...fila, estado: 'ALTO' }]));
    await expect(falloDe(obtenerStock('o1', token))).resolves.toEqual({ tipo: 'respuesta-invalida' });
  });
});
