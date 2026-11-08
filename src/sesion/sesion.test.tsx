import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { tokenDeUsuario } from '../pruebas/jwt';
import { contenidoSecureStore } from '../pruebas/secure-store-simulado';
import { cerrarSesionKeycloak, iniciarSesionKeycloak, renovarTokens } from './keycloak';
import { RenovacionRechazada } from './renovacion';
import { MENSAJES_SESION, SesionProvider, useSesion } from './sesion';
import { guardarTokens, leerTokens, type Tokens } from './tokens';
import { guardarUsuarioLocal, leerUsuarioLocal } from './usuario-local';

jest.mock('./keycloak');

const iniciarMock = jest.mocked(iniciarSesionKeycloak);
const renovarMock = jest.mocked(renovarTokens);
const cerrarMock = jest.mocked(cerrarSesionKeycloak);

const ahora = () => Math.floor(Date.now() / 1000);
const tokens = (venceEn: number, acceso = tokenDeUsuario(['maestro'])): Tokens => ({
  accessToken: acceso,
  refreshToken: 'r-guardado',
  venceEn,
});

let valor: ReturnType<typeof useSesion>;

function Sonda() {
  valor = useSesion();
  const { sesion, error } = valor;
  return (
    <Text>
      {sesion.estado === 'activa'
        ? `activa:${sesion.usuario.nombre}`
        : sesion.estado === 'sin-sesion'
          ? `sin-sesion:${sesion.motivo}`
          : 'cargando'}
      {error ? ` error:${error}` : ''}
    </Text>
  );
}

const montar = () =>
  render(
    <SesionProvider>
      <Sonda />
    </SesionProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SesionProvider', () => {
  it('sin tokens guardados queda sin sesión', async () => {
    await montar();
    expect(await screen.findByText('sin-sesion:inicio')).toBeTruthy();
  });

  it('inicia sesión y guarda los tokens', async () => {
    const nuevos = tokens(ahora() + 300, tokenDeUsuario(['maestro'], { nombre: 'Ana Quispe' }));
    iniciarMock.mockResolvedValue(nuevos);
    await montar();
    await screen.findByText('sin-sesion:inicio');
    await act(() => valor.iniciarSesion());
    expect(screen.getByText('activa:Ana Quispe')).toBeTruthy();
    await expect(leerTokens()).resolves.toEqual(nuevos);
  });

  it('si cierra el inicio de sesión de Keycloak, sigue sin sesión', async () => {
    iniciarMock.mockResolvedValue(null);
    await montar();
    await screen.findByText('sin-sesion:inicio');
    await act(() => valor.iniciarSesion());
    expect(screen.getByText('sin-sesion:inicio')).toBeTruthy();
  });

  it('si Keycloak no responde al iniciar sesión, muestra el aviso', async () => {
    iniciarMock.mockRejectedValue(new TypeError('Network request failed'));
    await montar();
    await screen.findByText('sin-sesion:inicio');
    await act(() => valor.iniciarSesion());
    expect(screen.getByText(`sin-sesion:inicio error:${MENSAJES_SESION.sinConexion}`)).toBeTruthy();
  });

  it('recupera la sesión guardada vigente sin renovar', async () => {
    await guardarTokens(tokens(ahora() + 300));
    await montar();
    expect(await screen.findByText('activa:Juan Pérez')).toBeTruthy();
    expect(renovarMock).not.toHaveBeenCalled();
  });

  it('token vencido → lo renueva con el refresh token y guarda los nuevos', async () => {
    const renovados = { ...tokens(ahora() + 300), refreshToken: 'r-nuevo' };
    renovarMock.mockResolvedValue(renovados);
    await guardarTokens(tokens(ahora() - 10));
    await montar();
    expect(await screen.findByText('activa:Juan Pérez')).toBeTruthy();
    expect(renovarMock).toHaveBeenCalledWith('r-guardado');
    await expect(leerTokens()).resolves.toEqual(renovados);
  });

  it('obtenerToken renueva una sola vez aunque lo pidan varias pantallas juntas', async () => {
    let terminarRenovacion: (t: Tokens) => void = () => {};
    renovarMock.mockReturnValue(
      new Promise<Tokens>((resolver) => {
        terminarRenovacion = resolver;
      }),
    );
    const renovado = tokens(ahora() + 300, tokenDeUsuario(['maestro'], { nombre: 'Renovado' }));
    await guardarTokens(tokens(ahora() - 10));
    await montar();
    await waitFor(() => expect(renovarMock).toHaveBeenCalledTimes(1));

    // Mientras la renovación del arranque sigue en curso, otras dos pantallas piden el token.
    let pedidos: Promise<(string | null)[]> = Promise.resolve([]);
    await act(async () => {
      pedidos = Promise.all([valor.obtenerToken(), valor.obtenerToken()]);
    });
    await act(async () => {
      terminarRenovacion(renovado);
    });
    await expect(pedidos).resolves.toEqual([renovado.accessToken, renovado.accessToken]);
    expect(renovarMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('activa:Renovado')).toBeTruthy();
  });

  it('falla la renovación → borra los tokens y vuelve al inicio de sesión', async () => {
    renovarMock.mockRejectedValue(new RenovacionRechazada());
    await guardarTokens(tokens(ahora() - 10));
    await montar();
    expect(await screen.findByText('sin-sesion:vencida')).toBeTruthy();
    expect(contenidoSecureStore()).toEqual({});
  });

  it('sin conexión al renovar conserva la sesión guardada', async () => {
    renovarMock.mockRejectedValue(new TypeError('Network request failed'));
    await guardarTokens(tokens(ahora() - 10));
    await montar();
    expect(await screen.findByText('activa:Juan Pérez')).toBeTruthy();
    await expect(leerTokens()).resolves.not.toBeNull();
  });

  it('guarda el usuario en el celular al entrar (101, usuarioLocal)', async () => {
    await guardarTokens(tokens(ahora() + 300, tokenDeUsuario(['almacenero'], { nombre: 'Ana Quispe' })));
    await montar();
    await screen.findByText('activa:Ana Quispe');
    await waitFor(async () => expect(await leerUsuarioLocal()).toMatchObject({ nombre: 'Ana Quispe', roles: expect.arrayContaining(['almacenero']) }));
  });

  it('sin señal entra con el último usuario guardado aunque el token haya vencido (101, criterio 6)', async () => {
    renovarMock.mockRejectedValue(new TypeError('Network request failed'));
    const vencidos = tokens(ahora() - 3600, tokenDeUsuario(['almacenero'], { nombre: 'Del token' }));
    await guardarTokens(vencidos);
    await guardarUsuarioLocal({ id: 'u-local', nombre: 'Ana Quispe', usuario: 'ana', roles: ['almacenero'] });
    await montar();
    expect(await screen.findByText('activa:Ana Quispe')).toBeTruthy();
    await expect(leerTokens()).resolves.toEqual(vencidos);
  });

  it('si Keycloak rechaza la renovación también se borra el usuario guardado', async () => {
    renovarMock.mockRejectedValue(new RenovacionRechazada());
    await guardarTokens(tokens(ahora() - 10));
    await guardarUsuarioLocal({ id: 'u1', nombre: 'Ana', usuario: 'ana', roles: ['almacenero'] });
    await montar();
    expect(await screen.findByText('sin-sesion:vencida')).toBeTruthy();
    await expect(leerUsuarioLocal()).resolves.toBeNull();
  });

  it('renueva solo mientras el usuario trabaja y, si ya no puede, vuelve al inicio de sesión', async () => {
    jest.useFakeTimers({ now: Date.now() });
    try {
      // Vence en 2 minutos: se renueva a 1 minuto del vencimiento.
      await guardarTokens(tokens(ahora() + 120));
      renovarMock.mockResolvedValueOnce(tokens(ahora() + 300 + 60));
      await montar();
      await screen.findByText('activa:Juan Pérez');
      expect(renovarMock).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
      expect(renovarMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('activa:Juan Pérez')).toBeTruthy();

      // La siguiente renovación la rechaza Keycloak (sesión cerrada en el servidor).
      renovarMock.mockRejectedValueOnce(new RenovacionRechazada());
      await act(async () => {
        await jest.advanceTimersByTimeAsync(300_000);
      });
      await waitFor(() => expect(screen.getByText('sin-sesion:vencida')).toBeTruthy());
      expect(contenidoSecureStore()).toEqual({});
    } finally {
      jest.useRealTimers();
    }
  });

  it('cerrar sesión borra los tokens guardados y llama al end_session_endpoint', async () => {
    cerrarMock.mockResolvedValue(true);
    await guardarTokens(tokens(ahora() + 300));
    await montar();
    await screen.findByText('activa:Juan Pérez');
    await act(() => valor.cerrarSesion());
    expect(screen.getByText('sin-sesion:cerrada')).toBeTruthy();
    expect(contenidoSecureStore()).toEqual({});
    expect(cerrarMock).toHaveBeenCalledWith('r-guardado');
  });

  it('sin conexión, cerrar sesión igual borra los tokens del celular', async () => {
    cerrarMock.mockResolvedValue(false);
    await guardarTokens(tokens(ahora() + 300));
    await montar();
    await screen.findByText('activa:Juan Pérez');
    await act(() => valor.cerrarSesion());
    expect(screen.getByText('sin-sesion:cerrada')).toBeTruthy();
    expect(contenidoSecureStore()).toEqual({});
  });
});
