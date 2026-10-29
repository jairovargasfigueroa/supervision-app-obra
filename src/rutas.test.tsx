import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { tokenDeUsuario } from './pruebas/jwt';
import { iniciarSesionKeycloak, renovarTokens } from './sesion/keycloak';
import { RenovacionRechazada } from './sesion/renovacion';
import { guardarTokens, leerTokens } from './sesion/tokens';

// Las pruebas de navegación usan las rutas reales de src/app; Keycloak está simulado.
jest.mock('./sesion/keycloak');

const iniciarMock = jest.mocked(iniciarSesionKeycloak);
const renovarMock = jest.mocked(renovarTokens);

const ahora = () => Math.floor(Date.now() / 1000);
const sesionDe = (roles: string[], nombre = 'Juan Pérez') => ({
  accessToken: tokenDeUsuario(roles, { nombre }),
  refreshToken: 'r1',
  venceEn: ahora() + 300,
});

const abrirApp = () => renderRouter('src/app', { initialUrl: '/' });

beforeEach(() => {
  jest.clearAllMocks();
  iniciarMock.mockResolvedValue(null);
});

describe('inicio de sesión', () => {
  it('sin sesión muestra el inicio de sesión y abre el de Keycloak solo, una vez (criterio 1)', async () => {
    await abrirApp();
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    expect(screen).toHavePathname('/iniciar-sesion');
    expect(iniciarMock).toHaveBeenCalledTimes(1);
  });

  it('al iniciar sesión entra a «Mis obras» y guarda los tokens (criterio 2)', async () => {
    await abrirApp();
    const sesion = sesionDe(['maestro']);
    iniciarMock.mockResolvedValue(sesion);
    await fireEvent.press(await screen.findByText('Iniciar sesión'));
    expect(await screen.findByText('Aún no hay obras asignadas.')).toBeTruthy();
    expect(screen).toHavePathname('/obras');
    await expect(leerTokens()).resolves.toEqual(sesion);
  });

  it('con la sesión guardada entra directo a «Mis obras»', async () => {
    await guardarTokens(sesionDe(['maestro']));
    await abrirApp();
    expect(await screen.findByText('Aún no hay obras asignadas.')).toBeTruthy();
    expect(screen).toHavePathname('/obras');
    expect(iniciarMock).not.toHaveBeenCalled();
  });

  it('si la sesión venció y no se puede renovar, vuelve al inicio de sesión con el aviso (criterio 8)', async () => {
    await guardarTokens({ ...sesionDe(['maestro']), venceEn: ahora() - 10 });
    renovarMock.mockRejectedValue(new RenovacionRechazada());
    await abrirApp();
    expect(await screen.findByText('Tu sesión terminó. Vuelve a iniciar sesión.')).toBeTruthy();
    expect(screen).toHavePathname('/iniciar-sesion');
    // Tras una sesión vencida no se abre Keycloak solo: el usuario pulsa «Iniciar sesión».
    expect(iniciarMock).not.toHaveBeenCalled();
    await expect(leerTokens()).resolves.toBeNull();
  });
});
