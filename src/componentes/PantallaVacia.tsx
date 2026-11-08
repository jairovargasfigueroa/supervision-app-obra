import { StyleSheet, View } from 'react-native';

import { EstadoVacio } from './EstadoVacio';

export const MENSAJE_SIN_OBRAS = 'Aún no hay obras asignadas.';

type Props = {
  icono: string;
  mensaje?: string;
};

/** Pantalla de una pestaña con su estado vacío centrado. */
export function PantallaVacia({ icono, mensaje = MENSAJE_SIN_OBRAS }: Props) {
  return (
    <View style={estilos.contenido}>
      <EstadoVacio icono={icono} mensaje={mensaje} />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { flex: 1, justifyContent: 'center', padding: 16 },
});
