import { useFonts } from 'expo-font';
import { DefaultTheme, SplashScreen, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';

import { tieneAccesoApp } from '../sesion/roles';
import { SesionProvider, useSesion } from '../sesion/sesion';
import { colores, fuentesInter, tema, temaSistema } from '../tema';

// La pantalla de bienvenida queda hasta que cargan la fuente y la sesión guardada.
void SplashScreen.preventAutoHideAsync().catch(() => {});

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

/**
 * Sin sesión solo se llega al inicio de sesión; con sesión y un rol de la app, a las pestañas; con
 * sesión pero sin `maestro` ni `almacenero`, solo a «No tienes acceso» (criterio 3).
 */
function Navegacion() {
  const { sesion } = useSesion();

  useEffect(() => {
    if (sesion.estado !== 'cargando') {
      SplashScreen.hide();
    }
  }, [sesion.estado]);

  if (sesion.estado === 'cargando') {
    return null;
  }
  const activa = sesion.estado === 'activa';
  const conAcceso = activa && tieneAccesoApp(sesion.usuario.roles);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={conAcceso}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={activa && !conAcceso}>
        <Stack.Screen name="(auth)/sin-acceso" />
      </Stack.Protected>
      <Stack.Protected guard={!activa}>
        <Stack.Screen name="(auth)/iniciar-sesion" />
      </Stack.Protected>
    </Stack>
  );
}

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
        <SesionProvider>
          <Navegacion />
        </SesionProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
