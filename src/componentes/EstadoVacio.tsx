import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { TAMANO_TACTIL_MINIMO, useTema } from '../tema';

type Props = {
  /** Texto que explica por qué no hay nada, p. ej. «Aún no hay obras.» */
  mensaje: string;
  /** Ícono de MaterialCommunityIcons. */
  icono?: string;
  /** Acción opcional, p. ej. «Registrar obra». */
  accion?: { texto: string; onPress: () => void };
};

/** Estado vacío de un área: ícono, texto y una acción opcional (docs/diseno-visual.md). */
export function EstadoVacio({ mensaje, icono = 'inbox-outline', accion }: Props) {
  const tema = useTema();
  return (
    <View style={estilos.contenedor} testID="estado-vacio">
      <Icon source={icono} size={48} color={tema.colors.textoSecundario} />
      <Text variant="bodyLarge" style={[estilos.mensaje, { color: tema.colors.textoSecundario }]}>
        {mensaje}
      </Text>
      {accion ? (
        <Button
          mode="contained"
          onPress={accion.onPress}
          style={estilos.boton}
          contentStyle={estilos.contenidoBoton}
        >
          {accion.texto}
        </Button>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  mensaje: { textAlign: 'center' },
  boton: { minWidth: TAMANO_TACTIL_MINIMO },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO, paddingHorizontal: 8 },
});
