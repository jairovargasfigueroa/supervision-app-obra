import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Surface, Text } from 'react-native-paper';

import { mensajeDeError } from '../../../../api/errores';
import { obraQuery } from '../../../../api/obras';
import { EstadoError } from '../../../../componentes/EstadoError';
import { EstadoVacio } from '../../../../componentes/EstadoVacio';
import { SelectorPartida } from '../../../../componentes/SelectorPartida';
import { useFotoAvance } from '../../../../formularios/useFotoAvance';
import { formatearFechaHora } from '../../../../nucleo/formato';
import { useSesion } from '../../../../sesion/sesion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../../../../tema';

// Foto de avance de una obra (005, maestro): partida, cámara o galería, vista previa y «Enviar».
// Con `key`, el formulario empieza de cero en cada obra.
export default function PantallaFotoDeAvance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FotoDeAvanceDeObra key={id} id={id} />;
}

function FotoDeAvanceDeObra({ id }: { id: string }) {
  const { obtenerToken } = useSesion();
  const { colors } = useTema();
  const obra = useQuery(obraQuery(id, obtenerToken));
  const formulario = useFotoAvance();
  const ocupado = formulario.preparando;

  if (obra.isPending) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando obra" />
      </View>
    );
  }
  if (obra.isError) {
    return (
      <View style={estilos.centro}>
        <EstadoError mensaje={mensajeDeError(obra.error)} onReintentar={() => void obra.refetch()} />
      </View>
    );
  }

  const { foto } = formulario;
  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <View style={estilos.encabezado}>
        <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
          {obra.data.nombre}
        </Text>
      </View>

      <Text variant="titleMedium" style={{ color: colors.onSurface }}>
        Partida
      </Text>
      {obra.data.partidas.length === 0 ? (
        <EstadoVacio icono="format-list-bulleted" mensaje="Esta obra no tiene partidas." />
      ) : (
        <Surface mode="flat" style={[estilos.tarjeta, { backgroundColor: colors.surface }]}>
          <SelectorPartida
            partidas={obra.data.partidas}
            valor={formulario.partidaId}
            onCambiar={formulario.setPartidaId}
            deshabilitado={ocupado}
          />
        </Surface>
      )}

      <Text variant="titleMedium" style={{ color: colors.onSurface }}>
        Foto
      </Text>
      <View style={estilos.botones}>
        <Button
          mode="outlined"
          icon="camera"
          onPress={() => void formulario.elegirFoto('camara')}
          disabled={ocupado}
          style={estilos.boton}
          contentStyle={estilos.contenidoBoton}
        >
          Tomar foto
        </Button>
        <Button
          mode="outlined"
          icon="image"
          onPress={() => void formulario.elegirFoto('galeria')}
          disabled={ocupado}
          style={estilos.boton}
          contentStyle={estilos.contenidoBoton}
        >
          Galería
        </Button>
      </View>
      {formulario.preparando ? <ActivityIndicator accessibilityLabel="Preparando la foto" /> : null}
      {foto ? (
        <View style={estilos.vistaPrevia}>
          <Image
            source={{ uri: foto.foto.uri }}
            accessibilityLabel="Vista previa de la foto"
            testID="vista-previa"
            resizeMode="cover"
            style={[
              estilos.imagen,
              { aspectRatio: foto.foto.ancho > 0 && foto.foto.alto > 0 ? foto.foto.ancho / foto.foto.alto : 4 / 3 },
            ]}
          />
          <Text variant="bodySmall" style={{ color: colors.textoSecundario }}>
            Tomada el {formatearFechaHora(foto.tomadaEn)}
          </Text>
        </View>
      ) : null}
      {formulario.aviso ? (
        <HelperText type="error" visible>
          {formulario.aviso}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        icon="send"
        disabled={ocupado || formulario.falta !== null}
        contentStyle={estilos.contenidoBoton}
      >
        Enviar
      </Button>
      {formulario.falta && !ocupado ? (
        <HelperText type="info" visible>
          {formulario.falta}
        </HelperText>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  contenido: { padding: 16, gap: 12 },
  encabezado: { gap: 4, alignItems: 'flex-start' },
  titulo: { fontWeight: '600' },
  tarjeta: { borderRadius: radios.tarjeta, overflow: 'hidden' },
  botones: { flexDirection: 'row', gap: 12 },
  boton: { flex: 1 },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
  vistaPrevia: { gap: 4 },
  imagen: { width: '100%', borderRadius: radios.tarjeta },
});
