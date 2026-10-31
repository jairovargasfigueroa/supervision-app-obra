import NetInfo from '@react-native-community/netinfo';

import { escucharConexion, hayConexion, hayConexionEn } from './red';

describe('red', () => {
  it('hay conexión con isConnected, salvo que internet no se alcance', () => {
    expect(hayConexionEn({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(hayConexionEn({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(hayConexionEn({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(hayConexionEn({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(hayConexionEn({ isConnected: null, isInternetReachable: null })).toBe(false);
  });

  it('lee y escucha NetInfo', async () => {
    await expect(hayConexion()).resolves.toBe(true);
    const dejar = jest.fn();
    let oyente: ((estado: unknown) => void) | undefined;
    jest.mocked(NetInfo.addEventListener).mockImplementationOnce((l) => {
      oyente = l as (estado: unknown) => void;
      return dejar;
    });
    const avisos: boolean[] = [];
    const detener = escucharConexion((c) => avisos.push(c));
    oyente?.({ isConnected: false, isInternetReachable: false });
    oyente?.({ isConnected: true, isInternetReachable: true });
    expect(avisos).toEqual([false, true]);
    detener();
    expect(dejar).toHaveBeenCalled();
  });
});
