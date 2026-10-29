import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { tokenDeUsuario } from './pruebas/jwt';
import { cerrarSesionKeycloak, iniciarSesionKeycloak, renovarTokens } from './sesion/keycloak';
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

const entrarCon = async (roles: string[], nombre = 'Juan Pérez') => {
  await guardarTokens(sesionDe(roles, nombre));
  await abrirApp();
};

const pestanasVisibles = () =>
  ['Mis obras', 'Foto de avance', 'Ingreso', 'Salida', 'Stock'].filter(
    (titulo) => screen.queryAllByText(titulo).length > 0,
  );

describe('pestañas según el rol (criterio 5) y barra superior (criterio 11)', () => {
  it('maestro → Mis obras y Foto de avance, con su nombre y rol arriba', async () => {
    await entrarCon(['maestro'], 'Freddy Choque Mamani');
    expect(await screen.findByText('Freddy Choque Mamani')).toBeTruthy();
    expect(screen.getByText('Maestro de obra')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Foto de avance']);
  });

  it('almacenero → Mis obras, Ingreso, Salida y Stock', async () => {
    await entrarCon(['almacenero'], 'Rosa Flores');
    expect(await screen.findByText('Rosa Flores')).toBeTruthy();
    expect(screen.getByText('Almacenero')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Ingreso', 'Salida', 'Stock']);
  });

  it('con los dos roles → la unión, con «Mis obras» una sola vez', async () => {
    await entrarCon(['maestro', 'almacenero']);
    expect(await screen.findByText('Maestro de obra · Almacenero')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Foto de avance', 'Ingreso', 'Salida', 'Stock']);
    expect(screen.getAllByText('Mis obras')).toHaveLength(1);
  });

  it('cada pestaña muestra por ahora su estado vacío', async () => {
    await entrarCon(['almacenero']);
    await fireEvent.press(await screen.findByText('Stock'));
    expect(screen).toHavePathname('/stock');
    expect(screen.getByText('Aún no hay obras asignadas.')).toBeTruthy();
  });

  it('un maestro no llega a las pantallas del almacenero', async () => {
    await guardarTokens(sesionDe(['maestro']));
    await renderRouter('src/app', { initialUrl: '/ingreso' });
    await screen.findByText('Foto de avance');
    expect(screen).not.toHavePathname('/ingreso');
  });
});

describe('sin rol de la app (criterio 3)', () => {
  it('muestra «No tienes acceso a esta aplicación» con su nombre y «Cerrar sesión»', async () => {
    await entrarCon(['residente', 'cliente'], 'Demo Uno');
    expect(await screen.findByText('No tienes acceso a esta aplicación')).toBeTruthy();
    expect(screen.getByText('Demo Uno, tu cuenta no tiene un rol de la app de obra.')).toBeTruthy();
    expect(screen.getByText('Cerrar sesión')).toBeTruthy();
    expect(screen).toHavePathname('/sin-acceso');
    expect(pestanasVisibles()).toEqual([]);
  });

  it('«Cerrar sesión» borra los tokens, cierra la sesión en Keycloak y vuelve al inicio de sesión', async () => {
    await entrarCon(['cliente']);
    await fireEvent.press(await screen.findByText('Cerrar sesión'));
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    expect(screen).toHavePathname('/iniciar-sesion');
    await expect(leerTokens()).resolves.toBeNull();
    expect(jest.mocked(cerrarSesionKeycloak)).toHaveBeenCalledWith('r1');
  });
});

describe('cerrar sesión desde la barra superior', () => {
  it('borra los tokens, llama al end_session_endpoint y no vuelve a abrir Keycloak solo', async () => {
    await entrarCon(['maestro']);
    await fireEvent.press(await screen.findByLabelText('Cerrar sesión'));
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    expect(screen).toHavePathname('/iniciar-sesion');
    await expect(leerTokens()).resolves.toBeNull();
    expect(jest.mocked(cerrarSesionKeycloak)).toHaveBeenCalledWith('r1');
    expect(iniciarMock).not.toHaveBeenCalled();
  });
});
