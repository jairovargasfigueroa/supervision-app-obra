import { escribirArchivo } from '../pruebas/archivos-simulados';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';
import { agregar, obtener, prepararCola, tomarArchivoParaSubir } from './cola';
import { subirSiguiente } from './subidor';

const T0 = new Date('2026-11-15T14:00:00.000Z');
const ARCHIVO = 'file:///documento/pendientes/f1.jpg';

async function fotoPendiente(id = 'f1', archivo = ARCHIVO) {
  escribirArchivo(archivo);
  await agregar(
    {
      idOperacion: id,
      usuarioId: 'u1',
      usuarioNombre: 'Ana',
      tipo: 'FOTO_AVANCE',
      obraId: 'o1',
      datos: { id, obraId: 'o1', partidaId: 'p1', tomadaEn: '2026-11-15T13:59:00Z' },
      descripcion: 'Foto de avance · P-01',
      archivoLocal: archivo,
    },
    T0,
  );
}

const opciones = (ahora = T0) => ({
  usuarioId: 'u1',
  token: 'token-1',
  idDispositivo: 'disp-1',
  ahora: () => ahora,
  azar: () => 0.5,
});

/** Sincronización da la URL firmada (`url-subida`) y S3 responde el PUT con `put`. */
function simular({ url = () => jsonRespuesta(201, urlFirmada()), put = () => new Response(null, { status: 200 }) }: {
  url?: (n: number) => Response | Promise<Response>;
  put?: (n: number) => Response | Promise<Response>;
} = {}) {
  let urls = 0;
  let puts = 0;
  const red = simularFetch().mockImplementation(async (direccion: string, init: RequestInit = {}) => {
    if (direccion === 'http://localhost:8084/fotos/url-subida') {
      return url(++urls);
    }
    if (init.method === 'PUT' && direccion.startsWith('https://s3.test/')) {
      return put(++puts);
    }
    throw new TypeError('Network request failed');
  });
  return red;
}

let firmas = 0;
const urlFirmada = () => ({
  url: `https://s3.test/subida/f1?firma=${++firmas}`,
  claveArchivo: 'fotos/o1/f1.jpg',
  expiraEn: '2026-11-15T14:10:00Z',
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('subidor (102)', () => {
  it('pide la URL a Sincronización, sube el archivo completo a S3 y guarda la claveArchivo', async () => {
    await fotoPendiente();
    const red = simular();

    await expect(subirSiguiente(opciones())).resolves.toEqual({ tipo: 'subido', idOperacion: 'f1' });

    const [direccion, init] = red.mock.calls[0];
    expect(direccion).toBe('http://localhost:8084/fotos/url-subida');
    expect(JSON.parse(String(init.body))).toEqual({ obraId: 'o1', fotoId: 'f1' });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-1', 'X-Dispositivo-Id': 'disp-1' });
    const [destino, put] = red.mock.calls[1];
    expect(destino).toMatch(/^https:\/\/s3\.test\/subida\/f1\?firma=/);
    expect(put).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } });
    expect(put.body.uri).toBe(ARCHIVO);
    expect(put.headers).not.toHaveProperty('Authorization');
    expect(await obtener('f1')).toMatchObject({
      estado: 'PENDIENTE',
      estadoArchivo: 'SUBIDO',
      datos: { id: 'f1', partidaId: 'p1', claveArchivo: 'fotos/o1/f1.jpg' },
    });
  });

  it('si falla el PUT se reintenta con espera creciente y una URL nueva (criterio 5)', async () => {
    await fotoPendiente();
    const urls: string[] = [];
    const red = simular({ put: (n) => new Response(null, { status: n === 1 ? 500 : 200 }) });
    red.mockImplementation(
      ((anterior) => async (direccion: string, init: RequestInit = {}) => {
        if (init.method === 'PUT') {
          urls.push(direccion);
        }
        return anterior(direccion, init);
      })(red.getMockImplementation()!),
    );

    await expect(subirSiguiente(opciones())).resolves.toMatchObject({ tipo: 'reintento', renovar: false });
    expect(await obtener('f1')).toMatchObject({
      estadoArchivo: 'PENDIENTE',
      intentos: 1,
      proximoIntentoEn: '2026-11-15T14:00:01.000Z',
    });
    // Antes de su próximo intento no se toma.
    await expect(subirSiguiente(opciones(new Date('2026-11-15T14:00:00.500Z')))).resolves.toEqual({ tipo: 'nada' });

    await expect(subirSiguiente(opciones(new Date('2026-11-15T14:00:01.000Z')))).resolves.toMatchObject({
      tipo: 'subido',
    });
    expect(urls).toHaveLength(2);
    expect(urls[1]).not.toBe(urls[0]);
  });

  it('sin señal o con tiempo agotado al pedir la URL, reintento', async () => {
    await fotoPendiente();
    simularFetch();
    await expect(subirSiguiente(opciones())).resolves.toMatchObject({ tipo: 'reintento' });
    expect((await obtener('f1'))?.estadoArchivo).toBe('PENDIENTE');
  });

  it('un 404 (o 403, 422) al pedir la URL deja la foto «Rechazada» y no se reintenta (criterio 9)', async () => {
    await fotoPendiente();
    simular({ url: () => jsonRespuesta(404, { status: 404, codigo: 'OBRA_NO_ENCONTRADA' }) });
    await expect(subirSiguiente(opciones())).resolves.toEqual({ tipo: 'rechazado', idOperacion: 'f1' });
    expect(await obtener('f1')).toMatchObject({
      estado: 'RECHAZADO',
      errorCodigo: 'OBRA_NO_ENCONTRADA',
      estadoArchivo: 'PENDIENTE',
    });
    await expect(subirSiguiente(opciones())).resolves.toEqual({ tipo: 'nada' });
  });

  it('un 401 pide renovar el token y un 503 se reintenta', async () => {
    await fotoPendiente();
    simular({ url: () => jsonRespuesta(401, { status: 401, codigo: 'NO_AUTENTICADO' }) });
    await expect(subirSiguiente(opciones())).resolves.toMatchObject({ tipo: 'reintento', renovar: true });

    simular({ url: () => jsonRespuesta(503, { status: 503, codigo: 'SERVICIO_NO_DISPONIBLE' }) });
    await expect(subirSiguiente(opciones(new Date('2026-11-15T15:00:00Z')))).resolves.toMatchObject({
      tipo: 'reintento',
      renovar: false,
    });
    expect(await obtener('f1')).toMatchObject({ intentos: 2, errorCodigo: 'SERVICIO_NO_DISPONIBLE' });
  });

  it('si el archivo ya no está en el celular, queda «Rechazada»', async () => {
    await fotoPendiente('f1', 'file:///documento/pendientes/f1.jpg');
    jest.requireMock<typeof import('../pruebas/archivos-simulados')>('expo-file-system').reiniciarArchivos();
    const red = simular();
    await expect(subirSiguiente(opciones())).resolves.toMatchObject({ tipo: 'rechazado' });
    expect((await obtener('f1'))?.errorCodigo).toBe('FOTO_NO_DISPONIBLE');
    expect(red).not.toHaveBeenCalled();
  });

  it('una subida cortada (SUBIENDO) vuelve a PENDIENTE al abrir la app', async () => {
    await fotoPendiente();
    await tomarArchivoParaSubir('u1', T0);
    expect((await obtener('f1'))?.estadoArchivo).toBe('SUBIENDO');
    await prepararCola(T0);
    expect((await obtener('f1'))?.estadoArchivo).toBe('PENDIENTE');
  });
});
