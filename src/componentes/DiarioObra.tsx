import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';

import type { ObraPaquete } from '../api/sincronizacion';
import { ETIQUETA_CLIMA, ICONO_CLIMA } from '../nucleo/clima';
import { formatearFecha } from '../nucleo/formato';
import { entradasDeObra, type EntradaDiario } from '../sync/diario-local';
import { ETIQUETA_ENTRADA, mensajeRechazo } from '../sync/mensajes';
import { useOperaciones } from '../sync/sincronizacion';
import { radios, useTema } from '../tema';
import { EstadoChip } from './EstadoChip';
import { EstadoVacio } from './EstadoVacio';
import { TituloObra } from './TituloObra';

export const MENSAJE_DIARIO_VACIO = 'Aún no hay entradas del diario en los últimos 30 días.';

type Props = { obra: ObraPaquete };

/**
 * Diario de obra (103, maestro): las entradas de los últimos 30 días, las del servidor (del paquete) y
 * las del celular que todavía no se enviaron («Sin enviar») o que se rechazaron («Rechazada»).
 */
export function DiarioObra({ obra }: Props) {
  const operaciones = useOperaciones();
  const entradas = useMemo(() => entradasDeObra(obra, operaciones.data ?? []), [obra, operaciones.data]);

  return (
    <FlatList
      data={entradas}
      keyExtractor={(e) => e.id}
      contentContainerStyle={estilos.lista}
      ListHeaderComponent={<TituloObra obra={obra} />}
      ListEmptyComponent={<EstadoVacio icono="notebook-outline" mensaje={MENSAJE_DIARIO_VACIO} />}
      renderItem={({ item }) => <TarjetaEntrada entrada={item} />}
    />
  );
}

function TarjetaEntrada({ entrada }: { entrada: EntradaDiario }) {
  const { colors } = useTema();
  const etiqueta = ETIQUETA_ENTRADA[entrada.estado];
  return (
    <Card mode="outlined" style={estilos.tarjeta} accessibilityLabel={`Diario del ${formatearFecha(entrada.fecha)}`}>
      <Card.Content style={estilos.contenido}>
        <View style={estilos.fila}>
          <Icon source={ICONO_CLIMA[entrada.clima]} size={24} color={colors.primary} />
          <Text variant="titleMedium" style={[estilos.titulo, { color: colors.onSurface }]}>
            {formatearFecha(entrada.fecha)} · {ETIQUETA_CLIMA[entrada.clima]}
          </Text>
          {etiqueta ? (
            <EstadoChip etiqueta={etiqueta} tono={entrada.estado === 'RECHAZADA' ? 'error' : 'atencion'} />
          ) : null}
        </View>
        <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
          {entrada.texto}
        </Text>
        {entrada.estado === 'RECHAZADA' && entrada.operacion ? (
          <Text variant="bodyMedium" style={{ color: colors.error }} testID="motivo-rechazo-diario">
            {mensajeRechazo(entrada.operacion)}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderRadius: radios.tarjeta },
  contenido: { gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
});
