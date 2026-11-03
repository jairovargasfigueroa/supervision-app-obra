import { PermissionsAndroid } from 'react-native';

// jest.setup.ts simula este módulo para el resto de las pruebas; aquí se prueba el real.
const { pedirPermiso, permisoConcedido } = jest.requireActual<typeof import('./permiso')>('./permiso');

const android13 = { os: 'android', version: 33 };
const android12 = { os: 'android', version: 32 };

afterEach(() => jest.restoreAllMocks());

describe('permiso de notificaciones', () => {
  it('en Android 13+ pide POST_NOTIFICATIONS y dice si lo concedió', async () => {
    const pedir = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    expect(await pedirPermiso(android13)).toBe(true);
    expect(pedir).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');

    pedir.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    expect(await pedirPermiso(android13)).toBe(false);
    pedir.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    expect(await pedirPermiso({ os: 'android', version: 35 })).toBe(false);
  });

  it('en Android 13+ consulta el permiso sin preguntar', async () => {
    const consultar = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    expect(await permisoConcedido(android13)).toBe(false);
    consultar.mockResolvedValue(true);
    expect(await permisoConcedido(android13)).toBe(true);
    expect(consultar).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
  });

  it('antes de Android 13 no hace falta pedirlo', async () => {
    const pedir = jest.spyOn(PermissionsAndroid, 'request');
    const consultar = jest.spyOn(PermissionsAndroid, 'check');
    expect(await pedirPermiso(android12)).toBe(true);
    expect(await permisoConcedido(android12)).toBe(true);
    expect(pedir).not.toHaveBeenCalled();
    expect(consultar).not.toHaveBeenCalled();
  });

  it('fuera de Android, sin avisos', async () => {
    expect(await pedirPermiso({ os: 'ios', version: '18.0' })).toBe(false);
    expect(await permisoConcedido({ os: 'ios', version: '18.0' })).toBe(false);
  });

  it('si el sistema falla, lo da por no concedido', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockRejectedValue(new Error('sin actividad'));
    jest.spyOn(PermissionsAndroid, 'check').mockRejectedValue(new Error('sin actividad'));
    expect(await pedirPermiso(android13)).toBe(false);
    expect(await permisoConcedido(android13)).toBe(false);
  });
});
