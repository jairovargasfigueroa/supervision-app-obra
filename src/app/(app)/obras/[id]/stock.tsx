import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConObra, TituloObra } from '../../../../componentes/ConObra';

// Pantalla de obra del almacenero (004): por ahora solo la obra elegida.
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObra key={id} id={id}>
      {(obra) => (
        <View style={estilos.contenido}>
          <TituloObra obra={obra} />
        </View>
      )}
    </ConObra>
  );
}

const estilos = StyleSheet.create({ contenido: { padding: 16 } });
