import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Snackbar, Surface, Text } from 'react-native-paper';

import type { ObraPaquete } from '../../../../api/sincronizacion';
import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { EstadoVacio } from '../../../../componentes/EstadoVacio';
import { SelectorPartida } from '../../../../componentes/SelectorPartida';
import { useFotoAvance } from '../../../../formularios/useFotoAvance';
import { formatearFechaHora } from '../../../../nucleo/formato';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../../../../tema';

// Foto de avance de una obra (005, maestro): partida, cámara o galería, vista previa y «Enviar».
// Desde la 102 la obra sale del paquete guardado en el celular y la foto se guarda y entra a la cola:
// funciona sin señal. Con `key`, el formulario empieza de cero en cada obra.
export default function PantallaFotoDeAvance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra) => <FotoDeAvanceDeObra obra={obra} />}
    </ConObraLocal>
  );
}

function FotoDeAvanceDeObra({ obra }: { obra: ObraPaquete }) {
  const { colors } = useTema();
  const formulario = useFotoAvance(obra);
  const ocupado = formulario.preparando || formulario.enviando;
  const { fallo, foto } = formulario;
  return (
    <View style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <View style={estilos.encabezado}>
          <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
            {obra.nombre}
          </Text>
        </View>

        <Text variant="titleMedium" style={{ color: colors.onSurface }}>
          Partida
        </Text>
        {obra.partidas.length === 0 ? (
          <EstadoVacio icono="format-list-bulleted" mensaje="Esta obra no tiene partidas." />
        ) : (
          <Surface mode="flat" style={[estilos.tarjeta, { backgroundColor: colors.surface }]}>
            <SelectorPartida
              partidas={obra.partidas}
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

        {formulario.avisoFotosSinEnviar ? (
          <Surface
            mode="flat"
            style={[estilos.fallo, { backgroundColor: colors.atencionSuave }]}
            testID="aviso-fotos-sin-enviar"
          >
            <Text variant="bodyMedium" style={{ color: colors.atencion }}>
              {formulario.avisoFotosSinEnviar}
            </Text>
          </Surface>
        ) : null}

        {fallo ? (
          <Surface
            mode="flat"
            style={[estilos.fallo, { backgroundColor: colors.errorSuave }]}
            accessibilityRole="alert"
            testID="envio-fallido"
          >
            <Text variant="bodyMedium" style={{ color: colors.error }}>
              {fallo}
            </Text>
          </Surface>
        ) : null}

        <Button
          mode="contained"
          icon="send"
          onPress={() => void formulario.enviar()}
          loading={formulario.enviando}
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
      <Snackbar visible={formulario.resultado !== null} onDismiss={formulario.cerrarResultado} duration={4000}>
        {formulario.resultado ?? ''}
      </Snackbar>
    </View>
  );
}

const proporcion = (ancho: number, alto: number) => (ancho > 0 && alto > 0 ? ancho / alto : 4 / 3);

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
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
