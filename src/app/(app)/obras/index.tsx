import { StyleSheet, View } from 'react-native';

import { EstadoVacio } from '../../../componentes/EstadoVacio';

// Mis obras: la lista real llega con la 004 y la 005.
export default function MisObras() {
  return (
    <View style={estilos.contenido}>
      <EstadoVacio icono="office-building-outline" mensaje="Aún no hay obras asignadas." />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: { flex: 1, justifyContent: 'center', padding: 16 },
});
