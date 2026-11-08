import { waitFor } from '@testing-library/react-native';

import { contenidoSecureStore } from '../pruebas/secure-store-simulado';
import {
  abrirDesdeNotificacion,
  fallarTemas,
  hayManejadorEnSegundoPlano,
  moduloMensajeria,
  recibirEnPrimerPlano,
  repararTemas,
  simularPermiso,
  simularSinFirebase,
  temasEnFirebase,
  tocarNotificacion,
  vecesQueSePidioPermiso,
} from '../pruebas/firebase-simulado';
import {
  actualizarAvisos,
  ESPERA_TEMA_MS,
  escucharAvisos,
  prepararAvisosEnSegundoPlano,
  quitarTodosLosTemas,
  temasGuardados,
} from './push';

const almacenero = ['almacenero'];
const maestro = ['maestro'];
const dosObras = [{ id: 'o1' }, { id: 'o2' }];

describe('actualizarAvisos', () => {
  it('la primera vez con señal pide el permiso y suscribe los temas de las obras del paquete', async () => {
    expect(await actualizarAvisos({ obras: dosObras, roles: almacenero, conectado: true })).toBe('activos');
    expect(vecesQueSePidioPermiso()).toBe(1);
    expect(temasEnFirebase()).toEqual(['obra-o1-almacenero', 'obra-o2-almacenero']);
    expect(await temasGuardados()).toEqual(['obra-o1-almacenero', 'obra-o2-almacenero']);
  });

  it('el permiso se pide una sola vez en el celular', async () => {
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    expect(vecesQueSePidioPermiso()).toBe(1);
  });

  it('sin señal no pide el permiso; lo pide al volver la señal', async () => {
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: false })).toBe('sin-permiso');
    expect(vecesQueSePidioPermiso()).toBe(0);
    expect(temasEnFirebase()).toEqual([]);

    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('activos');
    expect(vecesQueSePidioPermiso()).toBe(1);
    expect(temasEnFirebase()).toEqual(['obra-o1-maestro', 'obra-o2-maestro']);
  });

  it('permiso negado: no se suscribe y no vuelve a pedirlo (la app sigue igual)', async () => {
    simularPermiso({ alPedir: false });
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('sin-permiso');
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('sin-permiso');
    expect(vecesQueSePidioPermiso()).toBe(1);
    expect(temasEnFirebase()).toEqual([]);
    expect(moduloMensajeria.subscribeToTopic).not.toHaveBeenCalled();
  });

  it('si después concede el permiso en los ajustes, se suscribe al actualizar los datos', async () => {
    simularPermiso({ alPedir: false });
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    simularPermiso({ concedido: true });
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('activos');
    expect(temasEnFirebase()).toEqual(['obra-o1-maestro', 'obra-o2-maestro']);
  });

  it('si quita el permiso, se da de baja de todos', async () => {
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    simularPermiso({ concedido: false });
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('sin-permiso');
    expect(temasEnFirebase()).toEqual([]);
    expect(await temasGuardados()).toEqual([]);
  });

  it('al actualizar los datos deja la obra que ya no tiene y suscribe la nueva', async () => {
    await actualizarAvisos({ obras: dosObras, roles: almacenero, conectado: true });
    moduloMensajeria.subscribeToTopic.mockClear();

    await actualizarAvisos({ obras: [{ id: 'o2' }, { id: 'o3' }], roles: almacenero, conectado: true });
    expect(temasEnFirebase()).toEqual(['obra-o2-almacenero', 'obra-o3-almacenero']);
    expect(moduloMensajeria.unsubscribeFromTopic).toHaveBeenCalledTimes(1);
    expect(moduloMensajeria.unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'obra-o1-almacenero');
    // La que ya estaba no se vuelve a suscribir.
    expect(moduloMensajeria.subscribeToTopic).toHaveBeenCalledTimes(1);
    expect(moduloMensajeria.subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'obra-o3-almacenero');
  });

  it('con los dos roles, los dos temas de cada obra', async () => {
    await actualizarAvisos({ obras: [{ id: 'o1' }], roles: ['maestro', 'almacenero'], conectado: true });
    expect(temasEnFirebase()).toEqual(['obra-o1-almacenero', 'obra-o1-maestro']);
  });

  it('si FCM rechaza una suscripción: guarda solo lo que quedó y la reintenta la próxima vez', async () => {
    simularPermiso({ concedido: true });
    fallarTemas('obra-o2-maestro');
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: false });
    expect(await temasGuardados()).toEqual(['obra-o1-maestro']);

    repararTemas();
    moduloMensajeria.subscribeToTopic.mockClear();
    await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    expect(moduloMensajeria.subscribeToTopic).toHaveBeenCalledTimes(1);
    expect(await temasGuardados()).toEqual(['obra-o1-maestro', 'obra-o2-maestro']);
  });

  describe('sin red FCM no contesta: la operación queda en su cola y se da por aplicada', () => {
    const sinRespuesta = () => new Promise<void>(() => undefined);

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('no se queda esperando y guarda el tema suscrito', async () => {
      simularPermiso({ concedido: true });
      moduloMensajeria.subscribeToTopic.mockImplementationOnce(sinRespuesta);
      const resultado = actualizarAvisos({ obras: [{ id: 'o1' }], roles: maestro, conectado: false });
      await jest.advanceTimersByTimeAsync(ESPERA_TEMA_MS);
      expect(await resultado).toBe('activos');
      expect(await temasGuardados()).toEqual(['obra-o1-maestro']);
    });

    it('cierra sesión sin señal y vuelve a entrar: se suscribe otra vez (la baja pendiente no lo deja sin avisos)', async () => {
      await actualizarAvisos({ obras: [{ id: 'o1' }], roles: maestro, conectado: true });
      moduloMensajeria.unsubscribeFromTopic.mockImplementationOnce(sinRespuesta);
      const baja = quitarTodosLosTemas();
      await jest.advanceTimersByTimeAsync(ESPERA_TEMA_MS);
      await baja;
      expect(await temasGuardados()).toEqual([]);

      moduloMensajeria.subscribeToTopic.mockClear();
      await actualizarAvisos({ obras: [{ id: 'o1' }], roles: maestro, conectado: true });
      // La suscripción va detrás de la baja pendiente en la cola de FCM: queda suscrito.
      expect(moduloMensajeria.subscribeToTopic).toHaveBeenCalledWith(expect.anything(), 'obra-o1-maestro');
      expect(await temasGuardados()).toEqual(['obra-o1-maestro']);
    });

    it('se suscribe sin señal y cierra sesión: la baja incluye ese tema', async () => {
      simularPermiso({ concedido: true });
      moduloMensajeria.subscribeToTopic.mockImplementationOnce(sinRespuesta);
      const alta = actualizarAvisos({ obras: [{ id: 'o1' }], roles: almacenero, conectado: false });
      await jest.advanceTimersByTimeAsync(ESPERA_TEMA_MS);
      await alta;

      await quitarTodosLosTemas();
      expect(moduloMensajeria.unsubscribeFromTopic).toHaveBeenCalledWith(expect.anything(), 'obra-o1-almacenero');
      expect(await temasGuardados()).toEqual([]);
    });
  });

  it('si el diálogo del permiso no se pudo mostrar, lo vuelve a pedir en la próxima actualización', async () => {
    simularPermiso({ alPedir: 'falla' });
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('sin-permiso');
    expect(contenidoSecureStore()['avisos.permiso-pedido']).toBeUndefined();

    simularPermiso({ alPedir: true });
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('activos');
    expect(vecesQueSePidioPermiso()).toBe(2);
    expect(contenidoSecureStore()['avisos.permiso-pedido']).toBe('si');
  });

  it('sin Firebase (sin google-services.json o en Expo Go) no hace nada', async () => {
    simularSinFirebase();
    expect(await actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true })).toBe('sin-firebase');
    expect(vecesQueSePidioPermiso()).toBe(0);
    expect(moduloMensajeria.subscribeToTopic).not.toHaveBeenCalled();
    expect(contenidoSecureStore()).toEqual({});
  });
});

describe('quitarTodosLosTemas', () => {
  it('al cerrar sesión se da de baja de todos', async () => {
    await actualizarAvisos({ obras: dosObras, roles: ['maestro', 'almacenero'], conectado: true });
    await quitarTodosLosTemas();
    expect(temasEnFirebase()).toEqual([]);
    expect(await temasGuardados()).toEqual([]);
    expect(moduloMensajeria.unsubscribeFromTopic).toHaveBeenCalledTimes(4);
  });

  it('si FCM rechaza las bajas, quedan guardadas y se quitan al entrar otro usuario', async () => {
    await actualizarAvisos({ obras: dosObras, roles: almacenero, conectado: true });
    fallarTemas();
    await quitarTodosLosTemas();
    expect(await temasGuardados()).toEqual(['obra-o1-almacenero', 'obra-o2-almacenero']);

    repararTemas();
    await actualizarAvisos({ obras: [{ id: 'o9' }], roles: maestro, conectado: true });
    expect(temasEnFirebase()).toEqual(['obra-o9-maestro']);
    expect(await temasGuardados()).toEqual(['obra-o9-maestro']);
  });

  it('va después de una suscripción en curso (una operación a la vez)', async () => {
    const suscripcion = actualizarAvisos({ obras: dosObras, roles: maestro, conectado: true });
    const baja = quitarTodosLosTemas();
    await Promise.all([suscripcion, baja]);
    expect(temasEnFirebase()).toEqual([]);
    expect(await temasGuardados()).toEqual([]);
  });

  it('sin Firebase no hace nada', async () => {
    simularSinFirebase();
    await expect(quitarTodosLosTemas()).resolves.toBeUndefined();
    expect(moduloMensajeria.unsubscribeFromTopic).not.toHaveBeenCalled();
  });
});

describe('prepararAvisosEnSegundoPlano', () => {
  it('registra el manejador de los mensajes en segundo plano', () => {
    prepararAvisosEnSegundoPlano();
    expect(hayManejadorEnSegundoPlano()).toBe(true);
  });

  it('sin Firebase no registra nada', () => {
    simularSinFirebase();
    prepararAvisosEnSegundoPlano();
    expect(hayManejadorEnSegundoPlano()).toBe(false);
  });
});

describe('escucharAvisos', () => {
  const stockBajo = {
    notification: { title: 'Stock bajo: Cemento IP-30', body: 'Edificio Las Palmas: quedan 40 bolsas (mínimo 100)' },
    data: { tipo: 'STOCK_BAJO', obraId: 'o1' },
  };

  it('avisa el toque con la app en segundo plano y los que llegan con la app abierta', () => {
    const alTocar = jest.fn();
    const conLaAppAbierta = jest.fn();
    const dejar = escucharAvisos({ alTocar, conLaAppAbierta });

    tocarNotificacion(stockBajo);
    expect(alTocar).toHaveBeenCalledWith({
      titulo: 'Stock bajo: Cemento IP-30',
      cuerpo: 'Edificio Las Palmas: quedan 40 bolsas (mínimo 100)',
      datos: { tipo: 'STOCK_BAJO', obraId: 'o1' },
    });
    recibirEnPrimerPlano({ data: { tipo: 'DIARIO', obraId: 'o2' } });
    expect(conLaAppAbierta).toHaveBeenCalledWith({ titulo: '', cuerpo: '', datos: { tipo: 'DIARIO', obraId: 'o2' } });

    dejar();
    tocarNotificacion(stockBajo);
    recibirEnPrimerPlano(stockBajo);
    expect(alTocar).toHaveBeenCalledTimes(1);
    expect(conLaAppAbierta).toHaveBeenCalledTimes(1);
  });

  it('avisa la notificación que abrió la app desde cerrada, una sola vez', async () => {
    abrirDesdeNotificacion(stockBajo);
    const alTocar = jest.fn();
    escucharAvisos({ alTocar, conLaAppAbierta: jest.fn() })();
    const otra = jest.fn();
    escucharAvisos({ alTocar: otra, conLaAppAbierta: jest.fn() });
    await waitFor(() => expect(otra).toHaveBeenCalledTimes(1));
    // La primera dejó de escuchar antes de que llegara: no la recibe.
    expect(alTocar).not.toHaveBeenCalled();
    expect(otra.mock.calls[0][0].datos).toEqual({ tipo: 'STOCK_BAJO', obraId: 'o1' });
  });

  it('sin Firebase no escucha nada', () => {
    simularSinFirebase();
    const alTocar = jest.fn();
    const dejar = escucharAvisos({ alTocar, conLaAppAbierta: alTocar });
    tocarNotificacion(stockBajo);
    expect(alTocar).not.toHaveBeenCalled();
    expect(dejar).not.toThrow();
  });
});
