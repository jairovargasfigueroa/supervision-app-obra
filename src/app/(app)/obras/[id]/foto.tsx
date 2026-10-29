import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Snackbar, Surface, Text } from 'react-native-paper';

import { mensajeDeError } from '../../../../api/errores';
import { obraQuery } from '../../../../api/obras';
import { EstadoError } from '../../../../componentes/EstadoError';
import { EstadoVacio } from '../../../../componentes/EstadoVacio';
import { SelectorPartida } from '../../../../componentes/SelectorPartida';
import { TITULO_ENVIO_FALLIDO } from '../../../../formularios/foto.envio';
import { MENSAJE_FOTO_ENVIADA, useFotoAvance } from '../../../../formularios/useFotoAvance';
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
  const { obtenerToken, cerrarSesion } = useSesion();
  const { colors } = useTema();
  const obra = useQuery(obraQuery(id, obtenerToken));
  const formulario = useFotoAvance(id);
  const ocupado = formulario.preparando || formulario.enviando;
  const { fallo } = formulario;

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
    <View style={estilos.pantalla}>
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
                { aspectRatio: proporcion(foto.foto.ancho, foto.foto.alto) },
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

        {fallo ? (
          <Surface
            mode="flat"
            style={[estilos.fallo, { backgroundColor: colors.errorSuave }]}
            accessibilityRole="alert"
            testID="envio-fallido"
          >
            <Text variant="titleSmall" style={{ color: colors.error }}>
              {TITULO_ENVIO_FALLIDO}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
              {fallo.mensaje}
            </Text>
            {fallo.accion === 'elegir-partida' ? (
              <Button mode="text" icon="refresh" onPress={() => void obra.refetch()}>
                Actualizar datos
              </Button>
            ) : null}
            {fallo.accion === 'iniciar-sesion' ? (
              <Button mode="text" icon="login" onPress={() => void cerrarSesion()}>
                Iniciar sesión
              </Button>
            ) : null}
          </Surface>
        ) : null}

        <Button
          mode="contained"
          icon={fallo?.accion === 'reintentar' ? 'refresh' : 'send'}
          onPress={formulario.enviar}
          loading={formulario.enviando}
          disabled={
            ocupado ||
            formulario.falta !== null ||
            fallo?.accion === 'ninguna' ||
            fallo?.accion === 'iniciar-sesion'
          }
          contentStyle={estilos.contenidoBoton}
        >
          {fallo?.accion === 'reintentar' ? 'Reintentar' : 'Enviar'}
        </Button>
        {formulario.falta && !ocupado ? (
          <HelperText type="info" visible>
            {formulario.falta}
          </HelperText>
        ) : null}
      </ScrollView>
      <Snackbar
        visible={formulario.enviada}
        onDismiss={formulario.cerrarAvisoEnviada}
        duration={4000}
      >
        {MENSAJE_FOTO_ENVIADA}
      </Snackbar>
    </View>
  );
}

const proporcion = (ancho: number, alto: number) => (ancho > 0 && alto > 0 ? ancho / alto : 4 / 3);

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
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
  fallo: { borderRadius: radios.tarjeta, padding: 12, gap: 4, alignItems: 'flex-start' },
});
