// 601: direcciones de Keycloak y de Sincronización por variable al compilar (por defecto, las de app.json).
const crearConfig = require('./app.config');
const { expo: appJson } = require('./app.json');

const VARIABLES = ['EXPO_PUBLIC_KEYCLOAK_URL', 'EXPO_PUBLIC_SINCRONIZACION_URL', 'GOOGLE_SERVICES_JSON'];

describe('app.config.js · direcciones al compilar (601)', () => {
  const anteriores = {};

  beforeEach(() => {
    for (const nombre of VARIABLES) {
      anteriores[nombre] = process.env[nombre];
      delete process.env[nombre];
    }
  });

  afterEach(() => {
    for (const nombre of VARIABLES) {
      if (anteriores[nombre] === undefined) delete process.env[nombre];
      else process.env[nombre] = anteriores[nombre];
    }
  });

  const armar = () => crearConfig({ config: appJson });

  it('sin variables deja las direcciones de desarrollo de app.json', () => {
    expect(armar().extra).toEqual(appJson.extra);
    expect(armar().extra.keycloakUrl).toBe('http://localhost:8080');
    expect(armar().extra.sincronizacionUrl).toBe('http://localhost:8084');
  });

  it('con las variables reemplaza solo Keycloak y Sincronización', () => {
    process.env.EXPO_PUBLIC_KEYCLOAK_URL = 'https://keycloak.azure.localhost:8443';
    process.env.EXPO_PUBLIC_SINCRONIZACION_URL = 'https://sincronizacion.aws.localhost:10443';

    expect(armar().extra).toEqual({
      ...appJson.extra,
      keycloakUrl: 'https://keycloak.azure.localhost:8443',
      sincronizacionUrl: 'https://sincronizacion.aws.localhost:10443',
    });
  });

  it('ignora las variables vacías y quita espacios y la barra final', () => {
    process.env.EXPO_PUBLIC_KEYCLOAK_URL = '   ';
    process.env.EXPO_PUBLIC_SINCRONIZACION_URL = ' https://sinc.ejemplo/ ';

    const { extra } = armar();
    expect(extra.keycloakUrl).toBe('http://localhost:8080');
    expect(extra.sincronizacionUrl).toBe('https://sinc.ejemplo');
  });

  it('no cambia el resto de la configuración ni el app.json leído', () => {
    process.env.EXPO_PUBLIC_KEYCLOAK_URL = 'https://keycloak.ejemplo';

    const config = armar();
    expect(config.plugins).toEqual(appJson.plugins);
    expect(config.android).toEqual(appJson.android);
    expect(appJson.extra.keycloakUrl).toBe('http://localhost:8080');
  });

  it('extraConDirecciones funciona sin extra', () => {
    expect(crearConfig.extraConDirecciones(undefined, { EXPO_PUBLIC_KEYCLOAK_URL: 'https://k' })).toEqual({
      keycloakUrl: 'https://k',
    });
  });
});
