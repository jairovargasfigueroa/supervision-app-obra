import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { useTema } from '../tema';

/** Nombre de la obra como título de la pantalla. */
export function TituloObra({ obra }: { obra: { nombre: string } }) {
  const { colors } = useTema();
  return (
    <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
      {obra.nombre}
    </Text>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontWeight: '600' },
});
