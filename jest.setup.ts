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
