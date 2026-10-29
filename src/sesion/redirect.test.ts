import appJson from '../../app.json';

// Archivo aparte de keycloak.test.ts: aquí expo-auth-session es el real, con expo-constants simulado.

/** Redirect permitidos del cliente app-obra en el realm (infra/keycloak/realm-supervision.json). */
const REDIRECT_DEL_REALM = ['exp://*', 'appobra://*'];

const encaja = (uri: string) =>
  REDIRECT_DEL_REALM.some((patron) => uri.startsWith(patron.replace(/\*$/, '')));

/** `redirectUri()` con expo-constants (y el origen del código) como en Expo Go o en un development build. */
function redirectEn(entorno: 'expo-go' | 'development-build'): string {
  let uri = '';
  jest.isolateModules(() => {
    const expoGo = entorno === 'expo-go';
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        executionEnvironment: expoGo ? 'storeClient' : 'bare',
        expoConfig: { ...appJson.expo, hostUri: expoGo ? 'localhost:8090' : undefined },
        expoGoConfig: expoGo ? { developer: { tool: 'expo-cli' } } : null,
        linkingUri: expoGo ? 'exp://localhost:8090/--/' : 'appobra://',
      },
      ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
    }));
    jest.doMock('expo/internal/bundle-origin', () => ({
      getBundleOrigin: () => (expoGo ? 'http://localhost:8090' : null),
    }));
    uri = (require('./keycloak') as typeof import('./keycloak')).redirectUri();
  });
  return uri;
}

describe('redirectUri', () => {
  it('en Expo Go vuelve por exp:// a la pantalla de inicio de sesión', () => {
    const uri = redirectEn('expo-go');
    expect(uri).toBe('exp://localhost:8090/--/iniciar-sesion');
    expect(encaja(uri)).toBe(true);
  });

  it('en un development build vuelve por appobra:// (con ruta: Keycloak rechaza «appobra://» sola)', () => {
    const uri = redirectEn('development-build');
    expect(uri).toBe('appobra://iniciar-sesion');
    expect(encaja(uri)).toBe(true);
  });
});

