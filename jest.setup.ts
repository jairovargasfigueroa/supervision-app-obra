// En las pruebas no hay archivos de fuentes reales: expo-font da todo por cargado
// (también los íconos de @expo/vector-icons, que cargan su fuente con expo-font).
jest.mock('expo-font', () => {
  const real = jest.requireActual('expo-font');
  return {
    ...real,
    isLoaded: () => true,
    isLoading: () => false,
    loadAsync: () => Promise.resolve(),
    useFonts: () => [true, null],
  };
});

// Almacenamiento cifrado simulado en memoria (se vacía antes de cada prueba).
jest.mock('expo-secure-store', () => jest.requireActual('./src/pruebas/secure-store-simulado'));

// Base local simulada: SQLite real en memoria de Node (src/pruebas/sqlite-simulado.ts, se vacía antes de cada prueba).
jest.mock('expo-sqlite', () => jest.requireActual('./src/pruebas/sqlite-simulado'));

// Archivos del celular en memoria (src/pruebas/archivos-simulados.ts, se vacían antes de cada prueba).
jest.mock('expo-file-system', () => jest.requireActual('./src/pruebas/archivos-simulados'));

// Red del celular: el simulado oficial de NetInfo (con conexión; las pruebas cambian lo que avisa).
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// En Jest expo-constants no trae el app.json: la configuración se lee de app.json directamente.
jest.mock('./src/nucleo/configuracion', () => {
  const real = jest.requireActual<typeof import('./src/nucleo/configuracion')>(
    './src/nucleo/configuracion',
  );
  const { expo } = jest.requireActual<typeof import('./app.json')>('./app.json');
  return { ...real, configuracion: () => real.leerConfiguracion(expo.extra) };
});

// El módulo nativo de expo-crypto no existe en Jest: los UUID salen del crypto de Node.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => globalThis.crypto.randomUUID(),
}));

// Sin red real: cada prueba da sus respuestas (src/pruebas/fetch-simulado.ts).
jest.mock('./src/api/red', () => ({
  enviar: jest.fn(() => Promise.reject(new TypeError('Network request failed'))),
}));

// Cámara, galería y compresión simuladas (src/pruebas/imagen-simulada.ts).
jest.mock('expo-image-manipulator', () =>
  jest.requireActual('./src/pruebas/imagen-simulada').moduloManipulador,
);
jest.mock('expo-image-picker', () =>
  jest.requireActual('./src/pruebas/imagen-simulada').moduloSelector,
);

beforeEach(() => {
  jest.requireMock<typeof import('./src/pruebas/secure-store-simulado')>(
    'expo-secure-store',
  ).reiniciarSecureStore();
  jest.requireMock<typeof import('./src/pruebas/sqlite-simulado')>('expo-sqlite').reiniciarSqlite();
  jest.requireMock<typeof import('./src/pruebas/archivos-simulados')>('expo-file-system').reiniciarArchivos();
  jest.requireActual<typeof import('./src/sync/base-local')>('./src/sync/base-local').olvidarBaseLocal();
  jest.requireActual<typeof import('./src/sync/dispositivo')>('./src/sync/dispositivo').olvidarIdDispositivo();
  jest.requireActual<typeof import('./src/pruebas/imagen-simulada')>(
    './src/pruebas/imagen-simulada',
  ).simularManipulador({ ancho: 4000, alto: 3000 });
});
