import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Appbar, PaperProvider } from 'react-native-paper';

import { EstadoVacio } from './src/componentes/EstadoVacio';
import { fuentesInter, tema, temaSistema, useTema } from './src/tema';

// Pantalla base de la fase 1 (tarea 1.9). En la 001 se reemplaza por Expo Router (src/app/).
function PantallaInicio() {
  const { colors } = useTema();
  return (
    <View style={[estilos.pantalla, { backgroundColor: colors.background }]}>
      <Appbar.Header style={{ backgroundColor: colors.primary }}>
        <Appbar.Content title="Supervisión de obras" color={colors.onPrimary} />
      </Appbar.Header>
      <View style={estilos.contenido}>
        <EstadoVacio icono="office-building-outline" mensaje="Aún no hay obras asignadas." />
      </View>
    </View>
  );
}

export default function App() {
  const [interCargada, errorFuente] = useFonts(fuentesInter);

  // Mientras carga Inter no se muestra nada; si falla, se sigue con la fuente del sistema.
  if (!interCargada && !errorFuente) {
    return null;
  }

  return (
    <PaperProvider theme={interCargada ? tema : temaSistema}>
      <StatusBar style="light" />
      <PantallaInicio />
    </PaperProvider>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { flex: 1, justifyContent: 'center', padding: 16 },
});
