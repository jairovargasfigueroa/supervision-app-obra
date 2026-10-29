import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { TAMANO_TACTIL_MINIMO, useTema } from '../../tema';

export default function IniciarSesion() {
  const { colors } = useTema();
  return (
    <View style={[estilos.pantalla, { backgroundColor: colors.background }]}>
      <Text variant="headlineMedium" style={{ color: colors.primary }}>
        Supervisión de obras
      </Text>
      <Text variant="bodyLarge" style={{ color: colors.textoSecundario }}>
        App de obra
      </Text>
      <Button
        mode="contained"
        onPress={() => router.replace('/obras')}
        style={estilos.boton}
        contentStyle={estilos.contenidoBoton}
      >
        Iniciar sesión
      </Button>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  boton: { alignSelf: 'stretch' },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
});
