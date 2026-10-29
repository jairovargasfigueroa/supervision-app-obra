import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { TAMANO_TACTIL_MINIMO, useTema } from '../tema';

export const MENSAJE_NO_DISPONIBLE = 'No disponible por el momento.';

type Props = {
  onReintentar: () => void;
  /** Por defecto «No disponible por el momento.» (docs/mensajes.md). */
  mensaje?: string;
};

/** Estado de error de un área, con «Reintentar» (docs/diseno-visual.md). */
export function EstadoError({ onReintentar, mensaje = MENSAJE_NO_DISPONIBLE }: Props) {
  const tema = useTema();
  return (
    <View style={estilos.contenedor} testID="estado-error" accessibilityRole="alert">
      <Icon source="alert-circle-outline" size={48} color={tema.colors.error} />
      <Text variant="bodyLarge" style={[estilos.mensaje, { color: tema.colors.onSurface }]}>
        {mensaje}
      </Text>
      <Button
        mode="outlined"
        icon="refresh"
        onPress={onReintentar}
        style={estilos.boton}
        contentStyle={estilos.contenidoBoton}
      >
        Reintentar
      </Button>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  mensaje: { textAlign: 'center' },
  boton: { minWidth: TAMANO_TACTIL_MINIMO },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO, paddingHorizontal: 8 },
});
