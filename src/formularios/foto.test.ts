import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { comprimirFoto, obtenerFoto, reduccion, tomadaEnDeExif } from './foto';
import { contextoSimulado, simularManipulador } from '../pruebas/imagen-simulada';

// expo-image-manipulator y expo-image-picker están simulados en jest.setup.ts.

const camara = jest.mocked(ImagePicker.launchCameraAsync);
const galeria = jest.mocked(ImagePicker.launchImageLibraryAsync);
const permisoCamara = jest.mocked(ImagePicker.requestCameraPermissionsAsync);

const asset = (extra: Partial<ImagePicker.ImagePickerAsset> = {}): ImagePicker.ImagePickerAsset => ({
  uri: 'file:///original.jpg',
  width: 4000,
  height: 3000,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  simularManipulador({ ancho: 4000, alto: 3000 });
  permisoCamara.mockResolvedValue({ granted: true } as ImagePicker.CameraPermissionResponse);
});

describe('reduccion (criterio 2)', () => {
  it('fija el lado más largo en 1600 px', () => {
    expect(reduccion(4000, 3000)).toEqual({ width: 1600 });
    expect(reduccion(3000, 4000)).toEqual({ height: 1600 });
    expect(reduccion(2000, 2000)).toEqual({ width: 1600 });
  });

  it('no agranda una foto que ya cabe', () => {
    expect(reduccion(1600, 1200)).toBeNull();
    expect(reduccion(800, 600)).toBeNull();
  });
});

describe('comprimirFoto (criterio 2)', () => {
  it('reduce a 1600 px por lado y guarda JPEG con compress 0.8', async () => {
    const comprimida = await comprimirFoto('file:///original.jpg');
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///original.jpg');
    expect(contextoSimulado().resize).toHaveBeenCalledWith({ width: 1600 });
    expect(contextoSimulado().guardar).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
    expect(comprimida).toEqual({ uri: 'file:///comprimida.jpg', ancho: 1600, alto: 1200 });
    expect(contextoSimulado().release).toHaveBeenCalled();
  });

  it('una foto vertical se reduce por el alto', async () => {
    simularManipulador({ ancho: 3000, alto: 4000 });
    await comprimirFoto('file:///vertical.jpg');
    expect(contextoSimulado().resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('una foto chica no se agranda, pero igual se guarda como JPEG 0.8', async () => {
    simularManipulador({ ancho: 1200, alto: 900 });
    await comprimirFoto('file:///chica.jpg');
    expect(contextoSimulado().resize).not.toHaveBeenCalled();
    expect(contextoSimulado().guardar).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });
});

describe('tomadaEnDeExif', () => {
  const ahora = new Date('2026-11-15T20:00:00Z');

  it('usa DateTimeOriginal con su desfase', () => {
    expect(
      tomadaEnDeExif({ DateTimeOriginal: '2026:11:15 11:20:00', OffsetTimeOriginal: '-04:00' }, ahora),
    ).toBe('2026-11-15T15:20:00.000Z');
  });

  it('lee el grupo {Exif} de iOS', () => {
    expect(
      tomadaEnDeExif(
        { '{Exif}': { DateTimeOriginal: '2026:11:15 11:20:00', OffsetTimeOriginal: '-04:00' } },
        ahora,
      ),
    ).toBe('2026-11-15T15:20:00.000Z');
  });

  it('sin desfase toma la hora del celular', () => {
    const esperado = new Date(2026, 10, 15, 11, 20, 0).toISOString();
    expect(tomadaEnDeExif({ DateTimeOriginal: '2026:11:15 11:20:00' }, ahora)).toBe(esperado);
  });

  it('sin fecha, con una fecha rota o futura, usa ahora', () => {
    expect(tomadaEnDeExif(null, ahora)).toBe(ahora.toISOString());
    expect(tomadaEnDeExif({ DateTimeOriginal: 'ayer' }, ahora)).toBe(ahora.toISOString());
    expect(
      tomadaEnDeExif({ DateTimeOriginal: '2027:01:01 10:00:00', OffsetTimeOriginal: '-04:00' }, ahora),
    ).toBe(ahora.toISOString());
  });
});

describe('obtenerFoto (criterio 1)', () => {
  const ahora = () => new Date('2026-11-15T15:20:00Z');

  it('con la cámara pide permiso, comprime y fecha la foto en el momento', async () => {
    camara.mockResolvedValue({ canceled: false, assets: [asset()] });
    await expect(obtenerFoto('camara', ahora)).resolves.toEqual({
      tipo: 'lista',
      foto: {
        foto: { uri: 'file:///comprimida.jpg', ancho: 1600, alto: 1200 },
        tomadaEn: '2026-11-15T15:20:00.000Z',
      },
    });
    expect(camara).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], quality: 1 }));
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///original.jpg');
  });

  it('sin permiso de cámara no la abre', async () => {
    permisoCamara.mockResolvedValue({ granted: false } as ImagePicker.CameraPermissionResponse);
    await expect(obtenerFoto('camara', ahora)).resolves.toEqual({ tipo: 'sin-permiso' });
    expect(camara).not.toHaveBeenCalled();
  });

  it('de la galería lee el EXIF para la fecha', async () => {
    galeria.mockResolvedValue({
      canceled: false,
      assets: [asset({ exif: { DateTimeOriginal: '2026:11:14 09:00:00', OffsetTimeOriginal: '-04:00' } })],
    });
    const resultado = await obtenerFoto('galeria', ahora);
    expect(galeria).toHaveBeenCalledWith(expect.objectContaining({ exif: true }));
    expect(resultado).toMatchObject({ tipo: 'lista', foto: { tomadaEn: '2026-11-14T13:00:00.000Z' } });
  });

  it('si el usuario cancela no hay foto', async () => {
    galeria.mockResolvedValue({ canceled: true, assets: null });
    await expect(obtenerFoto('galeria', ahora)).resolves.toEqual({ tipo: 'cancelada' });
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });
});
