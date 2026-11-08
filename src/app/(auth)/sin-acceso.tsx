import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useSesion } from '../../sesion/sesion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../../tema';

// Usuario sin maestro ni almacenero (001, criterio 3): su nombre y «Cerrar sesión».
export default function SinAcceso() {
  const { colors } = useTema();
  const { sesion, cerrarSesion } = useSesion();
  const nombre = sesion.estado === 'activa' ? sesion.usuario.nombre : '';

  return (
    <View style={[estilos.pantalla, { backgroundColor: colors.background }]}>
      <View
        accessibilityRole="alert"
        style={[estilos.tarjeta, { backgroundColor: colors.surface, borderColor: colors.borde }]}
      >
        <Icon source="account-cancel-outline" size={48} color={colors.error} />
        <Text variant="titleLarge" style={[estilos.centrado, { color: colors.onSurface }]}>
          No tienes acceso a esta aplicación
        </Text>
        <Text variant="bodyMedium" style={[estilos.centrado, { color: colors.textoSecundario }]}>
          {nombre}, tu cuenta no tiene un rol de la app de obra.
        </Text>
        <Button
          mode="contained"
          icon="logout"
          onPress={() => void cerrarSesion()}
          style={estilos.boton}
          contentStyle={estilos.contenidoBoton}
        >
          Cerrar sesión
        </Button>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center', padding: 16 },
  tarjeta: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderRadius: radios.tarjeta,
  },
  centrado: { textAlign: 'center' },
  boton: { alignSelf: 'stretch', marginTop: 8 },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
});
