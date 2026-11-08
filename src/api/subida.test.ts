import { ErrorApi } from './errores';
import { subirArchivo, TIEMPO_MAXIMO_SUBIDA_MS } from './subida';
import { simularFetch } from '../pruebas/fetch-simulado';

let red: jest.Mock;
beforeEach(() => {
  red = simularFetch();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const archivo = { tamano: 1 } as unknown as Blob;

describe('subirArchivo', () => {
  it('hace PUT del archivo a la URL firmada como image/jpeg, sin token', async () => {
    red.mockResolvedValue(new Response(null, { status: 200 }));
    await subirArchivo('https://s3/firmada', archivo);
    const [url, init] = red.mock.calls[0];
    expect(url).toBe('https://s3/firmada');
    expect(init).toMatchObject({ method: 'PUT', body: archivo, headers: { 'Content-Type': 'image/jpeg' } });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('si el almacenamiento la rechaza, ErrorApi subida con el estado', async () => {
    red.mockResolvedValue(new Response('<Error>Request has expired</Error>', { status: 403 }));
    await expect(subirArchivo('https://s3/firmada', archivo)).rejects.toEqual(
      new ErrorApi({ tipo: 'subida', estado: 403 }),
    );
  });

  it('tiene 30 s como máximo (102, criterio 6)', () => {
    expect(TIEMPO_MAXIMO_SUBIDA_MS).toBe(30_000);
  });

  it('sin señal, ErrorApi red', async () => {
    await expect(subirArchivo('https://s3/firmada', archivo)).rejects.toEqual(new ErrorApi({ tipo: 'red' }));
  });
});
