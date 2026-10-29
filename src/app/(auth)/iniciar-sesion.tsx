import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { MENSAJES_SESION, useSesion } from '../../sesion/sesion';
import { TAMANO_TACTIL_MINIMO, useTema } from '../../tema';

// Inicio de sesión: abre el de Keycloak (realm supervision). Al abrir la app sin sesión se abre solo.
export default function IniciarSesion() {
  const { colors } = useTema();
  const { sesion, iniciando, error, iniciarSesion, iniciarSesionAlAbrir } = useSesion();
  const vencida = sesion.estado === 'sin-sesion' && sesion.motivo === 'vencida';

  useEffect(() => {
    iniciarSesionAlAbrir();
  }, [iniciarSesionAlAbrir]);

  return (
    <View style={[estilos.pantalla, { backgroundColor: colors.background }]}>
      <Text variant="headlineMedium" style={{ color: colors.primary }}>
        Supervisión de obras
      </Text>
      <Text variant="bodyLarge" style={{ color: colors.textoSecundario }}>
        App de obra
      </Text>
      {vencida ? (
        <Text variant="bodyMedium" style={[estilos.centrado, { color: colors.atencion }]}>
          {MENSAJES_SESION.sesionTerminada}
        </Text>
      ) : null}
      <Button
        mode="contained"
        onPress={() => void iniciarSesion()}
        loading={iniciando}
        disabled={iniciando}
        style={estilos.boton}
        contentStyle={estilos.contenidoBoton}
      >
        Iniciar sesión
      </Button>
      {error ? (
        <HelperText type="error" visible style={estilos.centrado}>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  centrado: { textAlign: 'center' },
  boton: { alignSelf: 'stretch' },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
});
