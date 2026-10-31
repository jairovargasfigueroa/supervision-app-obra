import { ErrorApi, type FalloApi } from './errores';
import { listarMaterialesActivos, obtenerStock } from './materiales';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';

// Cliente REST hacia Materiales (004): URLs de app.json y validación de las respuestas.
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
