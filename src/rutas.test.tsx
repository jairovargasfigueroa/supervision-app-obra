import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import NetInfo from '@react-native-community/netinfo';

import { jsonRespuesta, simularFetch } from './pruebas/fetch-simulado';
import { tokenDeUsuario } from './pruebas/jwt';
import { cerrarSesionKeycloak, iniciarSesionKeycloak, renovarTokens } from './sesion/keycloak';
import { RenovacionRechazada } from './sesion/renovacion';
import { guardarTokens, leerTokens } from './sesion/tokens';
import type { PaqueteDatos } from './api/sincronizacion';
import { agregar, listar, marcarRechazada, obtener, tomarParaEnvio } from './sync/cola';
import { guardarPaquete, leerPaquete } from './sync/paquete';

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

/** Paquete de datos de Sincronización (101) con esas obras y materiales. */
const paqueteDe = (
  obrasDelPaquete: unknown[],
  materiales: unknown[] = [],
  versionDatos = 'v1',
) => ({ versionDatos, generadoEn: '2026-11-15T13:00:00Z', obras: obrasDelPaquete, materiales });
const OBRA_PAQUETE = { ...DETALLE, stock: [] };

beforeEach(() => {
  jest.clearAllMocks();
  iniciarMock.mockResolvedValue(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  obras = { 'GET /paquete-datos': () => jsonRespuesta(200, paqueteDe([])) };
  fetchMock = simularFetch();
  fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    // Obras (8081), Materiales (8082) y Sincronización (8084) no comparten rutas: la clave es la ruta
    // sin el servidor.
    const clave = `${init.method ?? 'GET'} ${url.replace(/^http:\/\/localhost:808[124]/, '')}`;
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
  ['Mis obras', 'Foto de avance', 'Ingreso', 'Salida', 'Stock', 'Pendientes'].filter(
    (titulo) => screen.queryAllByText(titulo).length > 0,
  );

describe('pestañas según el rol (criterio 5) y barra superior (criterio 11)', () => {
  it('maestro → Mis obras y Foto de avance, con su nombre y rol arriba', async () => {
    await entrarCon(['maestro'], 'Freddy Choque Mamani');
    expect(await screen.findByText('Freddy Choque Mamani')).toBeTruthy();
    expect(screen.getByText('Maestro de obra')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Foto de avance', 'Pendientes']);
  });

  it('almacenero → Mis obras, Ingreso, Salida y Stock', async () => {
    await entrarCon(['almacenero'], 'Rosa Flores');
    expect(await screen.findByText('Rosa Flores')).toBeTruthy();
    expect(screen.getByText('Almacenero')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Ingreso', 'Salida', 'Stock', 'Pendientes']);
  });

  it('con los dos roles → la unión, con «Mis obras» una sola vez', async () => {
    await entrarCon(['maestro', 'almacenero']);
    expect(await screen.findByText('Maestro de obra · Almacenero')).toBeTruthy();
    expect(pestanasVisibles()).toEqual(['Mis obras', 'Foto de avance', 'Ingreso', 'Salida', 'Stock', 'Pendientes']);
    expect(screen.getAllByText('Mis obras')).toHaveLength(1);
  });

  it('sin obras asignadas, cada pestaña muestra su estado vacío', async () => {
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

describe('cerrar sesión con registros sin enviar (101, criterio 18)', () => {
  const pendiente = (id: string) => ({
    idOperacion: id,
    usuarioId: 'id-usuario1',
    usuarioNombre: 'Juan Pérez',
    tipo: 'MOVIMIENTO_MATERIAL' as const,
    obraId: 'o1',
    datos: { id },
    descripcion: 'Ingreso · 5 bolsas de Cemento IP-30',
  });

  it('avisa, conserva la cola y borra los datos descargados', async () => {
    await agregar(pendiente('a'));
    await agregar(pendiente('b'));
    await guardarPaquete(
      'id-usuario1',
      { versionDatos: 'v1', generadoEn: '2026-11-15T13:00:00Z', obras: [], materiales: [] },
      '2026-11-15T13:00:00Z',
    );
    await entrarCon(['almacenero']);

    await fireEvent.press(await screen.findByLabelText('Cerrar sesión'));
    const aviso =
      'Tienes 2 registros sin enviar; se enviarán cuando vuelvas a iniciar sesión con este usuario';
    expect(await screen.findByText(aviso)).toBeTruthy();

    await fireEvent.press(screen.getByText('Cancelar'));
    await waitFor(() => expect(screen.queryByText(aviso)).toBeNull());
    await expect(leerTokens()).resolves.not.toBeNull();

    await fireEvent.press(screen.getByLabelText('Cerrar sesión'));
    await fireEvent.press(await screen.findByText('Cerrar sesión'));
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    await expect(leerTokens()).resolves.toBeNull();
    await expect(leerPaquete('id-usuario1')).resolves.toBeNull();
    expect((await listar('id-usuario1')).map((o) => o.idOperacion)).toEqual(['a', 'b']);
  });
});

describe('foto de avance (005)', () => {
  beforeEach(() => {
    obras['GET /paquete-datos'] = () => jsonRespuesta(200, paqueteDe([OBRA_PAQUETE]));
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
    await screen.findByText('Edificio Las Palmas');
    // «Foto de avance» es la pestaña y también el botón de la obra en «Mis obras»: la pestaña va al final.
    const textos = screen.getAllByText('Foto de avance');
    await fireEvent.press(textos[textos.length - 1]);
    expect(await screen.findByText('Elige la obra')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edificio Las Palmas'));
    expect(await screen.findByText('P-02 · Muro de ladrillo')).toBeTruthy();
    expect(screen).toHavePathname('/obras/o1/foto');
  });

  it('el almacenero no tiene «Foto de avance» ni llega a la pantalla', async () => {
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/foto' });
    await screen.findAllByText('Stock');
    expect(screen).not.toHavePathname('/obras/o1/foto');
    expect(screen.queryByText('Foto de avance')).toBeNull();
  });

  it('si la primera descarga de las obras falla, «Mis obras» pide señal con «Reintentar» (101, criterio 4)', async () => {
    obras['GET /paquete-datos'] = () =>
      jsonRespuesta(503, { codigo: 'SERVICIO_NO_DISPONIBLE' }, 'application/problem+json');
    await entrarCon(['maestro']);
    expect(await screen.findByText('Necesitas señal la primera vez para descargar tus obras')).toBeTruthy();

    obras['GET /paquete-datos'] = () => jsonRespuesta(200, paqueteDe([OBRA_PAQUETE]));
    await fireEvent.press(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Edificio Las Palmas')).toBeTruthy();
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

describe('obras del almacenero (004, criterio 1)', () => {
  beforeEach(() => {
    obras['GET /paquete-datos'] = () => jsonRespuesta(200, paqueteDe([OBRA_PAQUETE]));
    obras['GET /obras/o1'] = () => jsonRespuesta(200, DETALLE);
  });

  it('«Mis obras» tiene en cada obra Ingreso, Salida y Stock, y no Foto de avance', async () => {
    await entrarCon(['almacenero']);
    expect(await screen.findByText('Edificio Las Palmas')).toBeTruthy();
    expect(screen.getByLabelText('Ingreso: Edificio Las Palmas')).toBeTruthy();
    expect(screen.getByLabelText('Salida: Edificio Las Palmas')).toBeTruthy();
    expect(screen.getByLabelText('Stock: Edificio Las Palmas')).toBeTruthy();
    expect(screen.queryByLabelText('Foto de avance: Edificio Las Palmas')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Salida: Edificio Las Palmas'));
    await waitFor(() => expect(screen).toHavePathname('/obras/o1/salida'));
  });

  it('con los dos roles, cada obra tiene los cuatro botones', async () => {
    await entrarCon(['maestro', 'almacenero']);
    expect(await screen.findByLabelText('Foto de avance: Edificio Las Palmas')).toBeTruthy();
    expect(screen.getByLabelText('Ingreso: Edificio Las Palmas')).toBeTruthy();
    expect(screen.getByLabelText('Stock: Edificio Las Palmas')).toBeTruthy();
  });

  it.each([
    ['Ingreso', '/obras/o1/ingreso'],
    ['Salida', '/obras/o1/salida'],
    ['Stock', '/obras/o1/stock'],
  ])('la pestaña %s pide elegir la obra y lleva a su pantalla', async (pestana, ruta) => {
    await entrarCon(['almacenero']);
    await screen.findByLabelText('Ingreso: Edificio Las Palmas');
    // El último es la pestaña (la barra va después del contenido); los otros, botones de las obras.
    await fireEvent.press(screen.getAllByText(pestana).at(-1)!);
    expect(await screen.findByText('Elige la obra')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Edificio Las Palmas'));
    expect(screen).toHavePathname(ruta);
  });

  it.each(['/obras/o1/ingreso', '/obras/o1/salida', '/obras/o1/stock'])(
    'un maestro no llega a %s (criterio 10)',
    async (ruta) => {
      await guardarTokens(sesionDe(['maestro']));
      await renderRouter('src/app', { initialUrl: ruta });
      await screen.findAllByText('Foto de avance');
      expect(screen).not.toHavePathname(ruta);
    },
  );
});

describe('enviar la foto de avance (005)', () => {
  const blob = { tamano: 1 } as unknown as Blob;
  const cuerpo = (init: RequestInit) => JSON.parse(String(init.body));
  const fotoIdsPedidos: string[] = [];

  beforeEach(() => {
    fotoIdsPedidos.length = 0;
    obras['GET /obras/o1'] = () => jsonRespuesta(200, DETALLE);
    obras['POST /obras/o1/fotos/url-subida'] = (init) => {
      const { fotoId } = cuerpo(init);
      fotoIdsPedidos.push(fotoId);
      return jsonRespuesta(200, {
        url: `https://s3.test/subida/${fotoId}`,
        claveArchivo: `fotos/o1/${fotoId}.jpg`,
        expiraEn: '2999-01-01T00:00:00Z',
      });
    };
    obras['GET file:///comprimida.jpg'] = () => ({ blob: () => Promise.resolve(blob) }) as unknown as Response;
    obras['POST /obras/o1/fotos'] = (init) => jsonRespuesta(201, { ...cuerpo(init), registradoPor: 'id-usuario1' });
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///original.jpg', width: 4000, height: 3000 }],
    });
    // El almacenamiento (S3) acepta el PUT a cualquier URL firmada.
    const servicios = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) =>
      init.method === 'PUT' && url.startsWith('https://s3.test/')
        ? new Response(null, { status: 200 })
        : servicios(url, init),
    );
  });

  const prepararFoto = async () => {
    await guardarTokens(sesionDe(['maestro']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/foto' });
    await fireEvent.press(await screen.findByText('P-01 · Losa de hormigón armado'));
    await fireEvent.press(screen.getByRole('button', { name: /Tomar foto/ }));
    await screen.findByTestId('vista-previa');
  };
  const llamadas = (clave: string) =>
    fetchMock.mock.calls.filter(
      ([url, init = {}]: [string, RequestInit?]) =>
        `${init.method ?? 'GET'} ${url.replace('http://localhost:8081', '')}` === clave,
    );

  it('«Enviar» sube la foto con la URL firmada y la registra con partida y fecha (criterio 3)', async () => {
    await prepararFoto();
    await fireEvent.press(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText('Foto enviada.')).toBeTruthy();

    const [fotoId] = fotoIdsPedidos;
    const [[, put]] = llamadas(`PUT https://s3.test/subida/${fotoId}`);
    expect(put).toMatchObject({ method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
    const [[, registro]] = llamadas('POST /obras/o1/fotos');
    expect(cuerpo(registro)).toEqual({
      id: fotoId,
      partidaId: 'p1',
      claveArchivo: `fotos/o1/${fotoId}.jpg`,
      tomadaEn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    // La foto enviada se quita: la siguiente es un registro nuevo.
    expect(screen.queryByTestId('vista-previa')).toBeNull();
  });

  it('si url-subida responde 503, dice que no se pudo y «Reintentar» usa el mismo fotoId (criterio 5)', async () => {
    const pedirUrl = obras['POST /obras/o1/fotos/url-subida']!;
    obras['POST /obras/o1/fotos/url-subida'] = (init) => {
      fotoIdsPedidos.push(cuerpo(init).fotoId);
      return jsonRespuesta(503, { codigo: 'SERVICIO_NO_DISPONIBLE' }, 'application/problem+json');
    };
    await prepararFoto();
    await fireEvent.press(screen.getByRole('button', { name: /Enviar/ }));

    expect(await screen.findByText('No se pudo enviar.')).toBeTruthy();
    expect(
      screen.getByText('Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.'),
    ).toBeTruthy();
    expect(screen.getByTestId('vista-previa')).toBeTruthy();
    expect(llamadas('POST /obras/o1/fotos')).toHaveLength(0);

    obras['POST /obras/o1/fotos/url-subida'] = pedirUrl;
    await fireEvent.press(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Foto enviada.')).toBeTruthy();

    expect(fotoIdsPedidos).toHaveLength(2);
    expect(fotoIdsPedidos[1]).toBe(fotoIdsPedidos[0]);
    expect(cuerpo(llamadas('POST /obras/o1/fotos')[0][1]).id).toBe(fotoIdsPedidos[0]);
    // Sin volver a tomar ni a comprimir la foto.
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(1);
    expect(llamadas('GET file:///comprimida.jpg')).toHaveLength(1);
  });

  it('un registro repetido (200) cuenta como enviado (criterio 4)', async () => {
    obras['POST /obras/o1/fotos'] = (init) => jsonRespuesta(200, cuerpo(init));
    await prepararFoto();
    await fireEvent.press(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText('Foto enviada.')).toBeTruthy();
    expect(screen.queryByText('No se pudo enviar.')).toBeNull();
  });

  it('si la partida no es de la obra, lo dice y ofrece «Actualizar datos»', async () => {
    obras['POST /obras/o1/fotos'] = () =>
      jsonRespuesta(422, { codigo: 'PARTIDA_NO_ES_DE_LA_OBRA' }, 'application/problem+json');
    await prepararFoto();
    await fireEvent.press(screen.getByRole('button', { name: /Enviar/ }));
    expect(await screen.findByText('La partida elegida no pertenece a esta obra.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Actualizar datos/ })).toBeTruthy();
    expect(screen.getByTestId('vista-previa')).toBeTruthy();
  });
});

describe('ingreso y salida de material (004, con la cola de la 101)', () => {
  const CEMENTO = { id: 'm1', codigo: 'CEM-IP30', nombre: 'Cemento IP-30', unidad: 'bolsa', unidadPlural: 'bolsas' };
  const cuerpo = (init: RequestInit) => JSON.parse(String(init.body));
  let movimientos: { cuerpo: Record<string, unknown> }[];
  let lotes: RequestInit[];
  let stockActual: number;

  /** Paquete de datos que arma Sincronización con lo que hay en Obras y Materiales. */
  const paquete = () => ({
    versionDatos: `v-${stockActual}`,
    generadoEn: '2026-11-15T13:00:00Z',
    obras: [{ ...DETALLE, stock: [{ materialId: 'm1', cantidad: stockActual, minimo: 100, estado: 'JUSTO' as const }] }],
    materiales: [CEMENTO],
  });

  beforeEach(() => {
    movimientos = [];
    lotes = [];
    stockActual = 120;
    obras['GET /paquete-datos'] = (init) => {
      const version = (init.headers as Record<string, string>)['If-None-Match'];
      return version === `"v-${stockActual}"` ? new Response(null, { status: 304 }) : jsonRespuesta(200, paquete());
    };
    // Materiales, detrás de Sincronización.
    obras['POST /movimientos'] = (init) => {
      const datos = cuerpo(init);
      const previo = stockActual;
      stockActual += datos.tipo === 'INGRESO' ? datos.cantidad : -datos.cantidad;
      movimientos.push({ cuerpo: datos });
      return jsonRespuesta(201, {
        id: datos.id,
        periodo: '2026-11',
        superaStock: datos.tipo === 'SALIDA' && previo < datos.cantidad,
        stock: { cantidad: stockActual, minimo: 100, estado: stockActual < 100 ? 'BAJO' : 'OK' },
      });
    };
    // Sincronización: cada operación va a POST /movimientos; 2xx → PROCESADO, 4xx → ERROR, si no REINTENTAR.
    obras['POST /lotes'] = async (init) => {
      lotes.push(init);
      const resultados = [];
      for (const op of cuerpo(init).operaciones) {
        const respuesta = await obras['POST /movimientos']!({ method: 'POST', body: JSON.stringify(op.datos) });
        const json = await respuesta.json();
        const estado = respuesta.ok ? 'PROCESADO' : respuesta.status < 500 ? 'ERROR' : 'REINTENTAR';
        resultados.push({ idOperacion: op.idOperacion, estado, repetida: false, status: respuesta.status, respuesta: json });
      }
      return jsonRespuesta(200, { resultados });
    };
  });

  const abrir = async (ruta: string) => {
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: ruta });
    await screen.findByText('CEM-IP30 · Cemento IP-30');
  };

  it('ingreso: pasa por la cola y Sincronización → «Registrado» y el stock se actualiza (criterios 2, 4 y 8)', async () => {
    await abrir('/obras/o1/ingreso');
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    expect(await screen.findByText('Stock: 120 bolsas')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '12,5');
    await fireEvent.changeText(screen.getByLabelText('Nota de remisión'), 'NR-00123');
    await fireEvent.press(screen.getByRole('button', { name: /Registrar ingreso/ }));

    expect(await screen.findByText('Registrado')).toBeTruthy();
    expect(movimientos).toHaveLength(1);
    const [{ cuerpo: enviado }] = movimientos;
    expect(enviado).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      obraId: 'o1',
      materialId: 'm1',
      tipo: 'INGRESO',
      cantidad: 12.5,
      notaRemision: { numero: 'NR-00123' },
      registradoEn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(cuerpo(lotes[0]).operaciones[0]).toMatchObject({ idOperacion: enviado.id, tipo: 'MOVIMIENTO_MATERIAL' });
    expect(lotes[0].headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer /),
      'X-Dispositivo-Id': expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    const [enCola] = await listar('id-usuario1');
    expect(enCola).toMatchObject({
      estado: 'ENVIADO',
      descripcion: 'Ingreso · 12,5 bolsas de Cemento IP-30',
      usuarioNombre: 'Juan Pérez',
    });
    // El formulario queda listo para otro registro; el stock del material ya es el nuevo.
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    expect(await screen.findByText('Stock: 132,5 bolsas')).toBeTruthy();
  });

  it('salida sin partida no se registra y pide elegirla (criterio 3)', async () => {
    await abrir('/obras/o1/salida');
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '10');
    await fireEvent.press(screen.getByRole('button', { name: /Registrar salida/ }));
    expect(await screen.findByText('Elige la partida de destino.')).toBeTruthy();
    expect(movimientos).toHaveLength(0);
    await expect(listar('id-usuario1')).resolves.toEqual([]);
  });

  it('salida mayor al stock: se registra igual y muestra el aviso (criterio 5)', async () => {
    stockActual = 8;
    await abrir('/obras/o1/salida');
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '12,5');
    await fireEvent.press(screen.getByText('P-02 · Muro de ladrillo'));
    await fireEvent.press(screen.getByRole('button', { name: /Registrar salida/ }));

    expect(await screen.findByText('Registrado')).toBeTruthy();
    expect(
      screen.getByText('La salida supera el stock registrado (stock: 8 bolsas). Queda como alerta para revisión'),
    ).toBeTruthy();
    expect(movimientos[0].cuerpo).toMatchObject({ tipo: 'SALIDA', cantidad: 12.5, partidaId: 'p2' });
    expect(movimientos[0].cuerpo).not.toHaveProperty('notaRemision');
    expect((await listar('id-usuario1'))[0].descripcion).toBe('Salida · 12,5 bolsas de Cemento IP-30 · P-02');
  });

  it('periodo cerrado: queda «Rechazado» con el periodo del movimiento (criterios 7 y 14)', async () => {
    obras['POST /movimientos'] = () =>
      jsonRespuesta(
        409,
        { status: 409, codigo: 'PERIODO_CERRADO', detail: 'El periodo 2026-10 ya está cerrado.' },
        'application/problem+json',
      );
    await abrir('/obras/o1/ingreso');
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '5');
    await fireEvent.press(screen.getByRole('button', { name: /Registrar ingreso/ }));
    expect(await screen.findByText(/^El periodo \d{4}-\d{2} ya está cerrado$/)).toBeTruthy();
    expect(screen.queryByText('Registrado')).toBeNull();
    expect((await listar('id-usuario1'))[0]).toMatchObject({ estado: 'RECHAZADO', errorCodigo: 'PERIODO_CERRADO' });
  });

  it('sin señal: «Guardado en el celular», el stock incluye la salida y el siguiente registro es otro (criterios 8 a 10)', async () => {
    await abrir('/obras/o1/salida');
    obras['POST /lotes'] = () => Promise.reject(new TypeError('Network request failed'));
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '130');
    await fireEvent.press(screen.getByText('P-01 · Losa de hormigón armado'));
    await fireEvent.press(screen.getByRole('button', { name: /Registrar salida/ }));

    expect(await screen.findByText('Guardado en el celular · se enviará cuando haya señal')).toBeTruthy();
    expect(
      screen.getByText('La salida supera el stock registrado (stock: 120 bolsas). Queda como alerta para revisión'),
    ).toBeTruthy();
    expect(movimientos).toHaveLength(0);
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    expect(await screen.findByText('Stock: -10 bolsas')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '2');
    await fireEvent.press(screen.getByText('P-01 · Losa de hormigón armado'));
    await fireEvent.press(screen.getByRole('button', { name: /Registrar salida/ }));
    // Al quedar guardado, el formulario se vacía para el siguiente.
    await waitFor(() => expect(screen.getByLabelText('Cantidad').props.value).toBe(''));
    const [primero, segundo] = await listar('id-usuario1');
    expect(primero.estado).toBe('PENDIENTE');
    expect(segundo.idOperacion).not.toBe(primero.idOperacion);
  });

  it('si Materiales no está disponible queda en el celular para reintentarlo con el mismo id (criterios 12 y 13)', async () => {
    obras['POST /movimientos'] = () =>
      jsonRespuesta(503, { status: 503, codigo: 'SERVICIO_NO_DISPONIBLE' }, 'application/problem+json');
    await abrir('/obras/o1/ingreso');
    await fireEvent.press(screen.getByText('CEM-IP30 · Cemento IP-30'));
    await fireEvent.changeText(screen.getByLabelText('Cantidad'), '5');
    await fireEvent.press(screen.getByRole('button', { name: /Registrar ingreso/ }));

    expect(await screen.findByText('Guardado en el celular · se enviará cuando haya señal')).toBeTruthy();
    const [op] = await listar('id-usuario1');
    expect(op).toMatchObject({ estado: 'PENDIENTE', intentos: 1, errorCodigo: 'SERVICIO_NO_DISPONIBLE' });
    expect(op.datos.id).toBe(op.idOperacion);
  });

  it('con los datos guardados funciona sin señal (criterio 3)', async () => {
    await guardarPaquete('id-usuario1', paquete(), '2026-11-15T13:00:00Z');
    obras = {};
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/ingreso' });
    expect(await screen.findByText('CEM-IP30 · Cemento IP-30', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Edificio Las Palmas')).toBeTruthy();
  });

  it('el primer uso sin señal pide señal para descargar las obras (criterio 4)', async () => {
    obras = {};
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/ingreso' });
    expect(
      await screen.findByText('Necesitas señal la primera vez para descargar tus obras', {}, { timeout: 5000 }),
    ).toBeTruthy();
  });
});

describe('stock de la obra (004, criterio 9; desde la 101, del paquete local)', () => {
  const material = (codigo: string, nombre: string) => ({ id: codigo, codigo, nombre, unidad: 'bolsa', unidadPlural: 'bolsas' });
  const MATERIALES = [material('CEM-IP30', 'Cemento IP-30'), material('ARE-01', 'Arena fina'), material('LAD-6H', 'Ladrillo 6 huecos')];
  const fila = (materialId: string, cantidad: number, minimo: number, estado: string) => ({ materialId, cantidad, minimo, estado });
  const conStock = (stock: unknown[]) => () =>
    jsonRespuesta(200, paqueteDe([{ ...DETALLE, stock }], MATERIALES));

  const abrirStock = async () => {
    await guardarTokens(sesionDe(['almacenero']));
    await renderRouter('src/app', { initialUrl: '/obras/o1/stock' });
  };

  it('lista cada material con cantidad, mínimo y estado con los colores del ERP', async () => {
    obras['GET /paquete-datos'] = conStock([
      fila('CEM-IP30', 120, 100, 'JUSTO'),
      fila('ARE-01', 40, 100, 'BAJO'),
      fila('LAD-6H', 1, 0, 'OK'),
    ]);
    await abrirStock();
    expect(await screen.findByText('ARE-01 · Arena fina')).toBeTruthy();
    expect(screen.getByText('Cantidad: 40 bolsas')).toBeTruthy();
    expect(screen.getAllByText('Mínimo: 100 bolsas')).toHaveLength(2);
    expect(screen.getByText('Mínimo: 0 bolsas')).toBeTruthy();
    expect(screen.getByText('Cantidad: 1 bolsa')).toBeTruthy();
    expect(screen.getByTestId('chip-error')).toHaveTextContent('Bajo');
    expect(screen.getByTestId('chip-atencion')).toHaveTextContent('Justo');
    expect(screen.getByTestId('chip-exito')).toHaveTextContent('OK');
    expect(screen.getByText('Edificio Las Palmas')).toBeTruthy();
    expect(screen.queryByTestId('stock-sin-enviar')).toBeNull();
  });

  it('sin filas muestra el estado vacío', async () => {
    obras['GET /paquete-datos'] = conStock([]);
    await abrirStock();
    expect(
      await screen.findByText('Esta obra todavía no tiene materiales con movimientos ni mínimo definido.'),
    ).toBeTruthy();
  });

  it('una obra que no está en los datos descargados: «Obra no encontrada» con «Reintentar»', async () => {
    obras['GET /paquete-datos'] = () => jsonRespuesta(200, paqueteDe([], MATERIALES));
    await abrirStock();
    expect(await screen.findByText('Obra no encontrada')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeTruthy();
  });

  it('suma los movimientos sin enviar y lo dice; sin señal muestra la fecha de los datos (101, criterios 3 y 9)', async () => {
    obras = {}; // sin señal: no responde nada
    jest.mocked(NetInfo.addEventListener).mockImplementationOnce((oyente) => {
      (oyente as (estado: unknown) => void)({ isConnected: false, isInternetReachable: false });
      return jest.fn();
    });
    await guardarPaquete(
      'id-usuario1',
      paqueteDe([{ ...DETALLE, stock: [fila('CEM-IP30', 120, 100, 'JUSTO')] }], MATERIALES) as PaqueteDatos,
      '2026-11-15T18:30:00.000Z',
    );
    const salida = (id: string, cantidad: number) => ({
      idOperacion: id,
      usuarioId: 'id-usuario1',
      usuarioNombre: 'Juan Pérez',
      tipo: 'MOVIMIENTO_MATERIAL' as const,
      obraId: 'o1',
      datos: { id, obraId: 'o1', materialId: 'CEM-IP30', tipo: 'SALIDA', cantidad, partidaId: 'p1' },
      descripcion: 'Salida',
    });
    await agregar(salida('s1', 15));
    await agregar(salida('s2', 10));

    await abrirStock();
    expect(await screen.findByText('Cantidad: 95 bolsas', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Incluye 2 movimientos sin enviar')).toBeTruthy();
    expect(screen.getByTestId('chip-error')).toHaveTextContent('Bajo');
    expect(screen.getByText('Sin señal · datos del 15/11 14:30')).toBeTruthy();
  });
});

describe('pendientes de envío (101, criterios 16 y 17)', () => {
  const operacion = (id: string, descripcion: string) => ({
    idOperacion: id,
    usuarioId: 'id-usuario1',
    usuarioNombre: 'Juan Pérez',
    tipo: 'MOVIMIENTO_MATERIAL' as const,
    obraId: 'o1',
    datos: { id, obraId: 'o1', materialId: 'm1', tipo: 'SALIDA', cantidad: 2, partidaId: 'p1', registradoEn: '2026-10-31T14:00:00Z' },
    descripcion,
  });
  const procesarLote = (init: RequestInit) => {
    const { operaciones } = JSON.parse(String(init.body)) as { operaciones: { idOperacion: string }[] };
    return jsonRespuesta(200, {
      resultados: operaciones.map((o) => ({
        idOperacion: o.idOperacion,
        estado: 'PROCESADO',
        status: 201,
        respuesta: { id: o.idOperacion, periodo: '2026-11', superaStock: false, stock: { cantidad: 1, minimo: 0, estado: 'OK' } },
      })),
    });
  };

  beforeEach(async () => {
    await agregar(operacion('a', 'Salida · 2 bolsas de Cemento IP-30 · P-01'));
    await agregar(operacion('b', 'Salida · 3 bolsas de Cemento IP-30 · P-02'));
    await agregar(operacion('c', 'Salida · 4 bolsas de Cemento IP-30 · P-01'));
    await tomarParaEnvio('id-usuario1', new Date(), 1);
    await marcarRechazada('a', 'PERIODO_CERRADO', 'El periodo 2026-10 ya está cerrado.', { status: 409, codigo: 'PERIODO_CERRADO' });
  });

  const abrirPendientes = async () => {
    await entrarCon(['almacenero']);
    await fireEvent.press(await screen.findByText('Pendientes'));
    await screen.findByText('Pendientes de envío');
  };

  it('muestra el contador y cada registro con su estado y, si se rechazó, el motivo', async () => {
    await abrirPendientes();
    expect(await screen.findByLabelText('Pendientes: 2')).toBeTruthy();
    expect(await screen.findByText('Pendiente (2)')).toBeTruthy();
    expect(screen.getByText('Rechazado (1)')).toBeTruthy();
    expect(screen.getByText('Salida · 3 bolsas de Cemento IP-30 · P-02')).toBeTruthy();
    expect(screen.getByTestId('motivo-rechazo')).toHaveTextContent('El periodo 2026-10 ya está cerrado');
    expect(screen.getAllByText(/^Registrado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toHaveLength(3);
  });

  it('«Descartar» pide confirmación y borra el registro', async () => {
    await abrirPendientes();
    await fireEvent.press(await screen.findByLabelText('Descartar: Salida · 3 bolsas de Cemento IP-30 · P-02'));
    expect(await screen.findByText('¿Descartar este registro? No se enviará y no se podrá recuperar.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancelar'));
    await waitFor(() => expect(screen.queryByText('¿Descartar este registro? No se enviará y no se podrá recuperar.')).toBeNull());
    expect(await obtener('b')).not.toBeNull();

    await fireEvent.press(screen.getByLabelText('Descartar: Salida · 3 bolsas de Cemento IP-30 · P-02'));
    const botones = await screen.findAllByText('Descartar');
    await fireEvent.press(botones[botones.length - 1]);
    await waitFor(() => expect(screen.queryByText('Salida · 3 bolsas de Cemento IP-30 · P-02')).toBeNull());
    expect(await obtener('b')).toBeNull();
    expect(await screen.findByLabelText('Pendientes: 1')).toBeTruthy();
  });

  it('«Enviar ahora» envía los pendientes sin esperar su próximo intento', async () => {
    await abrirPendientes();
    // Al abrir la app el envío falló (Sincronización no respondía): quedaron esperando su próximo intento.
    await waitFor(() => expect(screen.getByText('Pendiente (2)')).toBeTruthy());
    obras['POST /lotes'] = procesarLote;
    await fireEvent.press(screen.getByRole('button', { name: /Enviar ahora/ }));
    expect(await screen.findByText('Enviado (2)')).toBeTruthy();
    expect(screen.queryByLabelText(/^Pendientes: /)).toBeNull();
  });
});
