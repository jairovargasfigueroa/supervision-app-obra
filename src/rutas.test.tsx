import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import * as ImagePicker from 'expo-image-picker';

import { jsonRespuesta, simularFetch } from './pruebas/fetch-simulado';
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

/** Respuestas simuladas de Obras por «MÉTODO /ruta»; lo que no está responde 404. */
type Manejador = (init: RequestInit) => Response | Promise<Response>;
let obras: Record<string, Manejador>;
let fetchMock: jest.Mock;

const OBRA = { id: 'o1', nombre: 'Edificio Las Palmas', ubicacion: 'Av. Banzer 4to anillo', estado: 'EN_EJECUCION' };
const DETALLE = {
  ...OBRA,
  partidas: [
    { id: 'p1', codigo: 'P-01', nombre: 'Losa de hormigón armado', unidad: 'm2' },
    { id: 'p2', codigo: 'P-02', nombre: 'Muro de ladrillo', unidad: 'm2' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  iniciarMock.mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  obras = { 'GET /obras': () => jsonRespuesta(200, []) };
  fetchMock = simularFetch();
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const clave = `${init.method ?? 'GET'} ${url.replace('http://localhost:8081', '')}`;
    const manejador = obras[clave];
    return manejador ? manejador(init) : jsonRespuesta(404, { codigo: 'RUTA_NO_ENCONTRADA' });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
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

describe('foto de avance (005)', () => {
  beforeEach(() => {
    obras['GET /obras'] = () => jsonRespuesta(200, [OBRA]);
    obras['GET /obras/o1'] = () => jsonRespuesta(200, DETALLE);
  });

  it('en «Mis obras» el maestro elige una obra y pulsa «Foto de avance» (criterio 1)', async () => {
    await entrarCon(['maestro']);
    expect(await screen.findByText('Edificio Las Palmas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Foto de avance: Edificio Las Palmas'));
    expect(await screen.findByText('P-01 · Losa de hormigón armado')).toBeTruthy();
    expect(screen).toHavePathname('/obras/o1/foto');
  });

  it('la pestaña Foto de avance lista sus obras y lleva a la pantalla de la obra', async () => {
    await entrarCon(['maestro']);
    await fireEvent.press(await screen.findByText('Foto de avance'));
    expect(await screen.findByText('Elige la obra')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edificio Las Palmas'));
    expect(await screen.findByText('P-02 · Muro de ladrillo')).toBeTruthy();
    expect(screen).toHavePathname('/obras/o1/foto');
  });

  it('el almacenero no tiene «Foto de avance» ni llega a la pantalla', async () => {
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/foto' });
    await screen.findByText('Stock');
    expect(screen).not.toHavePathname('/obras/o1/foto');
    expect(screen.queryByText('Foto de avance')).toBeNull();
  });

  it('si Obras no responde, «Mis obras» muestra el error con «Reintentar»', async () => {
    obras['GET /obras'] = () => jsonRespuesta(404, { codigo: 'RUTA_NO_ENCONTRADA' });
    await entrarCon(['maestro']);
    expect(
      await screen.findByText('No encontramos lo que buscas. Puede que ya no exista o que no tengas acceso.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeTruthy();
  });

  it('elige la partida, toma la foto comprimida y la ve antes de enviar (criterios 1 y 2)', async () => {
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///original.jpg', width: 4000, height: 3000 }],
    });
    await guardarTokens(sesionDe(['maestro']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/foto' });
    await screen.findByText('P-01 · Losa de hormigón armado');
    const enviar = () => screen.getByRole('button', { name: /Enviar/ });
    expect(enviar()).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: /Tomar foto/ }));
    const vista = await screen.findByTestId('vista-previa');
    expect(vista.props.source).toEqual({ uri: 'file:///comprimida.jpg' });
    expect(screen.getByText('Elige la partida.')).toBeTruthy();
    expect(enviar()).toBeDisabled();

    await fireEvent.press(screen.getByText('P-01 · Losa de hormigón armado'));
    expect(screen.queryByText('Elige la partida.')).toBeNull();
  });

  it('sin permiso de cámara lo dice y no abre la cámara', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as ImagePicker.CameraPermissionResponse);
    await guardarTokens(sesionDe(['maestro']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/foto' });
    await fireEvent.press(await screen.findByRole('button', { name: /Tomar foto/ }));
    expect(
      await screen.findByText('Para tomar la foto, permite el uso de la cámara en los ajustes del celular.'),
    ).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
