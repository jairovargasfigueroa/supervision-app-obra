import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Snackbar, Text } from 'react-native-paper';

import { mensajeDeError, MENSAJE_SIN_CONEXION } from '../api/errores';
import type { TonoEstado } from '../nucleo/estado-stock';
import { formatearFechaHora } from '../nucleo/formato';
import { descartar, type EstadoOperacion, type Operacion } from '../sync/cola';
import {
  ETIQUETA_ESTADO,
  MENSAJE_CONFIRMAR_DESCARTE,
  MENSAJE_SIN_PENDIENTES,
  mensajeRechazo,
} from '../sync/mensajes';
import { useOperaciones, useSincronizacion } from '../sync/sincronizacion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../tema';
import { EstadoChip } from './EstadoChip';
import { EstadoVacio } from './EstadoVacio';

/** Orden de los grupos de la lista (criterio 16). */
const ORDEN_ESTADOS: readonly EstadoOperacion[] = ['PENDIENTE', 'ENVIANDO', 'RECHAZADO', 'ENVIADO'];

const TONO: Record<EstadoOperacion, TonoEstado> = {
  PENDIENTE: 'atencion',
  ENVIANDO: 'atencion',
  ENVIADO: 'exito',
  RECHAZADO: 'error',
};

/** Las operaciones agrupadas por estado, en el orden en que se registraron dentro de cada grupo. */
export function agruparPorEstado(operaciones: readonly Operacion[]) {
  return ORDEN_ESTADOS.map((estado) => ({
    estado,
    titulo: ETIQUETA_ESTADO[estado],
    data: operaciones.filter((op) => op.estado === estado),
  })).filter((grupo) => grupo.data.length > 0);
}

/**
 * «Pendientes de envío» (101, criterios 16 y 17): cada registro del usuario con tipo y descripción,
 * fecha y hora de registro y estado (`Rechazado` con el motivo). «Enviar ahora» y «Actualizar datos»
 * solo con señal; «Descartar» en `Pendiente` y `Rechazado`, con confirmación.
 */
export function PendientesEnvio() {
  const { colors } = useTema();
  const { conectado, enviando, pendientes, enviarAhora, actualizarDatos } = useSincronizacion();
  const operaciones = useOperaciones();
  const [porDescartar, setPorDescartar] = useState<Operacion | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const grupos = useMemo(() => agruparPorEstado(operaciones.data ?? []), [operaciones.data]);

  const pulsarEnviar = () => {
    enviarAhora()
      .then((resumen) => {
        if (resumen.detenido === 'sin-red') {
          setAviso(MENSAJE_SIN_CONEXION);
        }
      })
      .catch((error: unknown) => setAviso(mensajeDeError(error)));
  };

  const pulsarActualizar = () => {
    setActualizando(true);
    actualizarDatos()
      .catch((error: unknown) => setAviso(mensajeDeError(error)))
      .finally(() => setActualizando(false));
  };

  const confirmarDescarte = async () => {
    const op = porDescartar;
    setPorDescartar(null);
    if (op) {
      await descartar(op.idOperacion).catch(() => false);
    }
  };

  const encabezado = (
    <View style={estilos.encabezado}>
      <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
        Pendientes de envío
      </Text>
      <View style={estilos.botones}>
        <Button
          mode="contained"
          icon="cloud-upload-outline"
          onPress={pulsarEnviar}
          disabled={!conectado || enviando || pendientes === 0}
          loading={enviando}
          contentStyle={estilos.boton}
        >
          Enviar ahora
        </Button>
        <Button
          mode="outlined"
          icon="refresh"
          onPress={pulsarActualizar}
          disabled={!conectado || actualizando}
          loading={actualizando}
          contentStyle={estilos.boton}
        >
          Actualizar datos
        </Button>
      </View>
    </View>
  );

  return (
    <View style={estilos.pantalla}>
      <SectionList
        sections={grupos}
        keyExtractor={(op) => op.idOperacion}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={encabezado}
        ListEmptyComponent={
          operaciones.isPending ? undefined : <EstadoVacio icono="cloud-check-outline" mensaje={MENSAJE_SIN_PENDIENTES} />
        }
        renderSectionHeader={({ section }) => (
          <Text variant="titleMedium" style={[estilos.grupo, { color: colors.onSurface }]}>
            {section.titulo} ({section.data.length})
          </Text>
        )}
        renderItem={({ item }) => <TarjetaOperacion op={item} onDescartar={() => setPorDescartar(item)} />}
        stickySectionHeadersEnabled={false}
      />
      <Portal>
        <Dialog
          visible={porDescartar !== null}
          onDismiss={() => setPorDescartar(null)}
          style={{ borderRadius: radios.tarjeta }}
        >
          <Dialog.Content>
            <Text variant="bodyMedium">{MENSAJE_CONFIRMAR_DESCARTE}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPorDescartar(null)}>Cancelar</Button>
            <Button onPress={() => void confirmarDescarte()} textColor={colors.error}>
              Descartar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={aviso !== null} onDismiss={() => setAviso(null)} duration={4000}>
        {aviso ?? ''}
      </Snackbar>
    </View>
  );
}

function TarjetaOperacion({ op, onDescartar }: { op: Operacion; onDescartar: () => void }) {
  const { colors } = useTema();
  const sePuedeDescartar = op.estado === 'PENDIENTE' || op.estado === 'RECHAZADO';
  return (
    <Card mode="outlined" style={estilos.tarjeta} accessibilityLabel={op.descripcion}>
      <Card.Content style={estilos.contenido}>
        <View style={estilos.fila}>
          <Text variant="titleMedium" style={[estilos.descripcion, { color: colors.onSurface }]}>
            {op.descripcion}
          </Text>
          <EstadoChip etiqueta={ETIQUETA_ESTADO[op.estado]} tono={TONO[op.estado]} />
        </View>
        <Text variant="bodySmall" style={{ color: colors.textoSecundario }}>
          Registrado el {formatearFechaHora(op.creadaEn)}
        </Text>
        {op.estado === 'RECHAZADO' ? (
          <Text variant="bodyMedium" style={{ color: colors.error }} testID="motivo-rechazo">
            {mensajeRechazo(op)}
          </Text>
        ) : null}
      </Card.Content>
      {sePuedeDescartar ? (
        <Card.Actions>
          <Button
            icon="delete-outline"
            onPress={onDescartar}
            textColor={colors.error}
            accessibilityLabel={`Descartar: ${op.descripcion}`}
            contentStyle={estilos.boton}
          >
            Descartar
          </Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  lista: { padding: 16, gap: 12 },
  encabezado: { gap: 12 },
  titulo: { fontWeight: '600' },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boton: { minHeight: TAMANO_TACTIL_MINIMO },
  grupo: { marginTop: 8 },
  tarjeta: { borderRadius: radios.tarjeta },
  contenido: { gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  descripcion: { flex: 1 },
});
