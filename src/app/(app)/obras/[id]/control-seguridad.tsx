import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Text } from 'react-native-paper';

import type { ObraPaquete } from '../../../../api/sincronizacion';
import { FotoConRecuadros, ResumenEpp } from '../../../../componentes/AnalisisEpp';
import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { MENSAJE_CONTROL_SIN_ENVIO } from '../../../../avance/epp/mensajes';
import { useControlSeguridad } from '../../../../formularios/useControlSeguridad';
import { TAMANO_TACTIL_MINIMO, useTema } from '../../../../tema';

// Control de seguridad de una obra (301, maestro): foto de la cuadrilla analizada en el celular, sin
// conexión, con el mismo resumen, aviso y recuadros que la foto de avance. No se envía ni se guarda;
// «Otro control» la descarta para tomar otra. Con `key`, empieza de cero en cada obra.
export default function PantallaControlSeguridad() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra) => <ControlSeguridadDeObra obra={obra} />}
    </ConObraLocal>
  );
}

function ControlSeguridadDeObra({ obra }: { obra: ObraPaquete }) {
  const { colors } = useTema();
  const control = useControlSeguridad();
  const { foto, analisisEpp, preparando } = control;
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.encabezado}>
        <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
          {obra.nombre}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.textoSecundario }}>
          {MENSAJE_CONTROL_SIN_ENVIO}
        </Text>
      </View>

      {foto ? (
        <View style={estilos.vistaPrevia}>
          <FotoConRecuadros
            uri={foto.uri}
            ancho={foto.ancho}
            alto={foto.alto}
            resultado={analisisEpp?.estado === 'listo' ? analisisEpp.resultado : null}
            testID="vista-previa-control"
          />
          <ResumenEpp estado={analisisEpp} />
          <Button
            mode="contained"
            icon="refresh"
            onPress={control.otroControl}
            disabled={preparando}
            contentStyle={estilos.contenidoBoton}
          >
            Otro control
          </Button>
        </View>
      ) : (
        <View style={estilos.botones}>
          <Button
            mode="outlined"
            icon="camera"
            onPress={() => void control.elegirFoto('camara')}
            disabled={preparando}
            style={estilos.boton}
            contentStyle={estilos.contenidoBoton}
          >
            Tomar foto
          </Button>
          <Button
            mode="outlined"
            icon="image"
            onPress={() => void control.elegirFoto('galeria')}
            disabled={preparando}
            style={estilos.boton}
            contentStyle={estilos.contenidoBoton}
          >
            Galería
          </Button>
        </View>
      )}
      {preparando ? <ActivityIndicator accessibilityLabel="Preparando la foto" /> : null}
      {control.aviso ? (
        <HelperText type="error" visible>
          {control.aviso}
        </HelperText>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: 16, gap: 12 },
  encabezado: { gap: 4, alignItems: 'flex-start' },
  titulo: { fontWeight: '600' },
  botones: { flexDirection: 'row', gap: 12 },
  boton: { flex: 1 },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
  vistaPrevia: { gap: 12 },
});
