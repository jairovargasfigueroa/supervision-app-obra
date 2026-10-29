import { ErrorApi } from './errores';
import { leerArchivo, subirArchivo } from './subida';
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

  it('sin señal, ErrorApi red', async () => {
    await expect(subirArchivo('https://s3/firmada', archivo)).rejects.toEqual(new ErrorApi({ tipo: 'red' }));
  });
});

describe('leerArchivo', () => {
  it('lee la foto comprimida del celular', async () => {
    const blob = { tamano: 2 } as unknown as Blob;
    red.mockResolvedValue({ blob: () => Promise.resolve(blob) });
    await expect(leerArchivo('file:///comprimida.jpg')).resolves.toBe(blob);
    expect(red).toHaveBeenCalledWith('file:///comprimida.jpg');
  });

  it('si ya no está, ErrorApi archivo', async () => {
    await expect(leerArchivo('file:///no-existe.jpg')).rejects.toEqual(new ErrorApi({ tipo: 'archivo' }));
  });
});
