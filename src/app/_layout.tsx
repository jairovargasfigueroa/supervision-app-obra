import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';

import { colores, fuentesInter, tema, temaSistema } from '../tema';

// Colores de la navegación (pestañas y fondo de las pantallas) iguales a los del tema de Paper.
const temaNavegacion: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colores.primario,
    background: colores.fondo,
    card: colores.superficie,
    text: colores.texto,
    border: colores.borde,
    notification: colores.acento,
  },
};

export default function RaizLayout() {
  const [interCargada, errorFuente] = useFonts(fuentesInter);

  // Mientras carga Inter no se muestra nada; si falla, se sigue con la fuente del sistema.
  if (!interCargada && !errorFuente) {
    return null;
  }

  return (
    <PaperProvider theme={interCargada ? tema : temaSistema}>
      <ThemeProvider value={temaNavegacion}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </PaperProvider>
  );
}
