import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import { iniciarDisparadores, INTERVALO_ENVIO_MS } from './disparadores';

type Estado = { isConnected: boolean; isInternetReachable: boolean };

let avisarRed: (estado: Estado) => void;
let avisarApp: (estado: AppStateStatus) => void;
const dejarRed = jest.fn();
const quitarApp = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(NetInfo.addEventListener).mockImplementation((oyente) => {
    avisarRed = oyente as unknown as (estado: Estado) => void;
    return dejarRed;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, oyente) => {
    avisarApp = oyente as (estado: AppStateStatus) => void;
    return { remove: quitarApp } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const conSenal = { isConnected: true, isInternetReachable: true };
const sinSenal = { isConnected: false, isInternetReachable: false };

describe('disparadores del envío', () => {
  it('envía al volver la señal, no con el primer aviso ni al perderla', () => {
    const enviar = jest.fn();
    const conexion: boolean[] = [];
    iniciarDisparadores({ enviar, hayPendientes: async () => false, alCambiarConexion: (c) => conexion.push(c) });

    avisarRed(conSenal); // estado al abrir la app
    avisarRed(sinSenal);
    expect(enviar).not.toHaveBeenCalled();
    avisarRed(conSenal);
    expect(enviar).toHaveBeenCalledTimes(1);
    avisarRed(conSenal); // sigue con señal
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(conexion).toEqual([true, false, true, true]);
  });

  it('envía cuando la app vuelve a primer plano', () => {
    const enviar = jest.fn();
    iniciarDisparadores({ enviar, hayPendientes: async () => false });
    avisarApp('background');
    expect(enviar).not.toHaveBeenCalled();
    avisarApp('active');
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('cada 60 s envía si hay pendientes y hay señal', async () => {
    const enviar = jest.fn();
    let hay = false;
    iniciarDisparadores({ enviar, hayPendientes: async () => hay });

    await jest.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS);
    expect(enviar).not.toHaveBeenCalled();
    hay = true;
    await jest.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS - 1);
    expect(enviar).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(enviar).toHaveBeenCalledTimes(1);

    avisarRed(sinSenal);
    await jest.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('al detener deja de escuchar todo', async () => {
    const enviar = jest.fn();
    const detener = iniciarDisparadores({ enviar, hayPendientes: async () => true });
    detener();
    expect(dejarRed).toHaveBeenCalled();
    expect(quitarApp).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS * 3);
    expect(enviar).not.toHaveBeenCalled();
  });
});
