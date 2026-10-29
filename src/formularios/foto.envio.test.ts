import { ErrorApi, type FalloApi } from '../api/errores';
import {
  decidirTrasError,
  decidirTrasFallo,
  enviarFoto,
  nuevoEnvio,
  urlVencida,
  type DependenciasEnvio,
} from './foto.envio';

const AHORA = Date.parse('2026-11-15T15:30:00Z');
const URL_1 = { url: 'https://s3/u1', claveArchivo: 'fotos/o1/f1.jpg', expiraEn: '2026-11-15T15:40:00Z' };
const URL_2 = { url: 'https://s3/u2', claveArchivo: 'fotos/o1/f1.jpg', expiraEn: '2026-11-15T15:45:00Z' };
const archivo = { tamano: 1 } as unknown as Blob;

const fallo = (f: FalloApi) => new ErrorApi(f);
const NO_DISPONIBLE = fallo({ tipo: 'http', estado: 503, codigo: 'SERVICIO_NO_DISPONIBLE' });

function dependencias(): jest.Mocked<DependenciasEnvio> {
  return {
    pedirUrlSubida: jest.fn().mockResolvedValue(URL_1),
    leerArchivo: jest.fn().mockResolvedValue(archivo),
    subirArchivo: jest.fn().mockResolvedValue(undefined),
    registrarFoto: jest.fn().mockResolvedValue({ yaExistia: false }),
    ahora: jest.fn(() => AHORA),
  };
}

const envio = () =>
  nuevoEnvio({ obraId: 'o1', fotoId: 'f1', archivoUri: 'file:///comprimida.jpg', tomadaEn: '2026-11-15T15:20:00.000Z' });

describe('enviarFoto (criterios 3 a 5)', () => {
  it('pide la URL con el fotoId, sube el archivo y registra la foto', async () => {
    const d = dependencias();
    await expect(enviarFoto(envio(), 'p1', d)).resolves.toEqual({ yaExistia: false });
    expect(d.pedirUrlSubida).toHaveBeenCalledWith('o1', 'f1');
    expect(d.leerArchivo).toHaveBeenCalledWith('file:///comprimida.jpg');
    expect(d.subirArchivo).toHaveBeenCalledWith('https://s3/u1', archivo);
    expect(d.registrarFoto).toHaveBeenCalledWith('o1', {
      id: 'f1',
      partidaId: 'p1',
      claveArchivo: 'fotos/o1/f1.jpg',
      tomadaEn: '2026-11-15T15:20:00.000Z',
    });
  });

  it('un registro repetido (200) cuenta como enviado (criterio 4)', async () => {
    const d = dependencias();
    d.registrarFoto.mockResolvedValue({ yaExistia: true });
    await expect(enviarFoto(envio(), 'p1', d)).resolves.toEqual({ yaExistia: true });
  });

  it('si url-subida responde 503, el reintento usa el mismo fotoId y el mismo archivo', async () => {
    const d = dependencias();
    d.pedirUrlSubida.mockRejectedValueOnce(NO_DISPONIBLE);
    const actual = envio();
    await expect(enviarFoto(actual, 'p1', d)).rejects.toBe(NO_DISPONIBLE);
    await expect(enviarFoto(actual, 'p1', d)).resolves.toEqual({ yaExistia: false });
    expect(d.pedirUrlSubida.mock.calls).toEqual([
      ['o1', 'f1'],
      ['o1', 'f1'],
    ]);
    expect(d.leerArchivo).toHaveBeenCalledWith('file:///comprimida.jpg');
    expect(d.registrarFoto).toHaveBeenCalledWith('o1', expect.objectContaining({ id: 'f1' }));
  });

  it('si falla el registro, el reintento no vuelve a subir el archivo', async () => {
    const d = dependencias();
    d.registrarFoto.mockRejectedValueOnce(fallo({ tipo: 'red' }));
    const actual = envio();
    await expect(enviarFoto(actual, 'p1', d)).rejects.toBeInstanceOf(ErrorApi);
    await expect(enviarFoto(actual, 'p1', d)).resolves.toEqual({ yaExistia: false });
    expect(d.pedirUrlSubida).toHaveBeenCalledTimes(1);
    expect(d.subirArchivo).toHaveBeenCalledTimes(1);
    expect(d.registrarFoto).toHaveBeenCalledTimes(2);
    expect(d.registrarFoto.mock.calls[0]).toEqual(d.registrarFoto.mock.calls[1]);
  });

  it('si la subida falló y la URL venció, el reintento pide otra con el mismo fotoId', async () => {
    const d = dependencias();
    d.subirArchivo.mockRejectedValueOnce(fallo({ tipo: 'red' }));
    const actual = envio();
    await expect(enviarFoto(actual, 'p1', d)).rejects.toBeInstanceOf(ErrorApi);
    d.ahora.mockReturnValue(Date.parse('2026-11-15T15:50:00Z'));
    d.pedirUrlSubida.mockResolvedValueOnce(URL_2);
    await enviarFoto(actual, 'p1', d);
    expect(d.pedirUrlSubida.mock.calls).toEqual([
      ['o1', 'f1'],
      ['o1', 'f1'],
    ]);
    expect(d.subirArchivo).toHaveBeenLastCalledWith('https://s3/u2', archivo);
  });

  it('si S3 rechaza la URL (403), pide otra con el mismo fotoId y vuelve a subir', async () => {
    const d = dependencias();
    d.subirArchivo.mockRejectedValueOnce(fallo({ tipo: 'subida', estado: 403 }));
    d.pedirUrlSubida.mockResolvedValueOnce(URL_1).mockResolvedValueOnce(URL_2);
    await expect(enviarFoto(envio(), 'p1', d)).resolves.toEqual({ yaExistia: false });
    expect(d.pedirUrlSubida).toHaveBeenCalledTimes(2);
    expect(d.subirArchivo.mock.calls).toEqual([
      ['https://s3/u1', archivo],
      ['https://s3/u2', archivo],
    ]);
  });

  it('urlVencida: vencida, por vencer (30 s) o sin fecha', () => {
    expect(urlVencida(URL_1, AHORA)).toBe(false);
    expect(urlVencida(URL_1, Date.parse('2026-11-15T15:39:45Z'))).toBe(true);
    expect(urlVencida({ ...URL_1, expiraEn: 'mañana' }, AHORA)).toBe(true);
  });
});

describe('decidirTrasFallo', () => {
  const accion = (f: FalloApi) => decidirTrasFallo(f).accion;

  it('sin señal, tiempo agotado, 503, 500 y 429 se reintentan', () => {
    expect(decidirTrasFallo({ tipo: 'red' })).toEqual({
      mensaje: 'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
      accion: 'reintentar',
    });
    expect(decidirTrasError(NO_DISPONIBLE)).toEqual({
      mensaje: 'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
      accion: 'reintentar',
    });
    expect(accion({ tipo: 'tiempo' })).toBe('reintentar');
    expect(accion({ tipo: 'subida', estado: 500 })).toBe('reintentar');
    expect(accion({ tipo: 'http', estado: 500, codigo: 'ERROR_INTERNO' })).toBe('reintentar');
    expect(accion({ tipo: 'http', estado: 429, codigo: 'DEMASIADAS_PETICIONES' })).toBe('reintentar');
  });

  it('partida de otra obra → elegir otra partida', () => {
    expect(decidirTrasFallo({ tipo: 'http', estado: 422, codigo: 'PARTIDA_NO_ES_DE_LA_OBRA' })).toEqual({
      mensaje: 'La partida elegida no pertenece a esta obra.',
      accion: 'elegir-partida',
    });
  });

  it('clave inválida, archivo perdido o demasiado grande → tomar otra foto', () => {
    expect(decidirTrasFallo({ tipo: 'http', estado: 422, codigo: 'CLAVE_ARCHIVO_INVALIDA' })).toEqual({
      mensaje: 'No se pudo asociar el archivo a este registro.',
      accion: 'tomar-otra',
    });
    expect(accion({ tipo: 'archivo' })).toBe('tomar-otra');
    expect(accion({ tipo: 'http', estado: 413, codigo: 'ARCHIVO_DEMASIADO_GRANDE' })).toBe('tomar-otra');
  });

  it('sin permiso u obra no asignada no se reintenta; sesión vencida pide iniciar sesión', () => {
    expect(decidirTrasFallo({ tipo: 'http', estado: 404, codigo: 'OBRA_NO_ENCONTRADA' })).toEqual({
      mensaje: 'Obra no encontrada',
      accion: 'ninguna',
    });
    expect(accion({ tipo: 'http', estado: 403, codigo: 'SIN_PERMISO' })).toBe('ninguna');
    expect(accion({ tipo: 'http', estado: 401, codigo: 'NO_AUTENTICADO' })).toBe('iniciar-sesion');
    expect(accion({ tipo: 'sin-sesion' })).toBe('iniciar-sesion');
  });
});
