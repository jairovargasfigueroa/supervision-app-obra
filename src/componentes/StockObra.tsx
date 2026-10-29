import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';

import { mensajeDeError } from '../api/errores';
import { stockQuery, type FilaStock } from '../api/materiales';
import type { DetalleObra } from '../api/obras';
import { AYUDA_ESTADOS_STOCK, MENSAJE_STOCK_VACIO, presentacionEstadoStock } from '../nucleo/estado-stock';
import { formatearCantidadMaterial } from '../nucleo/formato';
import { useSesion } from '../sesion/sesion';
import { radios, useTema } from '../tema';
import { TituloObra } from './ConObra';
import { EstadoChip } from './EstadoChip';
import { EstadoError } from './EstadoError';
import { EstadoVacio } from './EstadoVacio';

/** Stock de la obra (004, criterio 9): cantidad, mínimo y estado de cada material, como en el ERP. */
export function StockObra({ obra }: { obra: DetalleObra }) {
  const { obtenerToken } = useSesion();
  const { colors } = useTema();
  const stock = useQuery(stockQuery(obra.id, obtenerToken));

  const encabezado = (
    <View style={estilos.encabezado}>
      <TituloObra obra={obra} />
      <Text variant="bodySmall" style={{ color: colors.textoSecundario }}>
        {AYUDA_ESTADOS_STOCK}
      </Text>
    </View>
  );

  if (stock.isPending) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando stock" />
      </View>
    );
  }
  if (stock.isError) {
    return (
      <View style={estilos.centro}>
        <EstadoError mensaje={mensajeDeError(stock.error)} onReintentar={() => void stock.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={stock.data}
      keyExtractor={(fila) => fila.materialId}
      contentContainerStyle={estilos.lista}
      refreshControl={
        <RefreshControl refreshing={stock.isRefetching} onRefresh={() => void stock.refetch()} />
      }
      ListHeaderComponent={encabezado}
      ListEmptyComponent={<EstadoVacio icono="package-variant-closed" mensaje={MENSAJE_STOCK_VACIO} />}
      renderItem={({ item }) => <FilaDeStock fila={item} />}
    />
  );
}

function FilaDeStock({ fila }: { fila: FilaStock }) {
  const { colors } = useTema();
  const cantidad = (valor: number) => formatearCantidadMaterial(valor, fila.unidad, fila.unidadPlural);
  return (
    <Card mode="outlined" style={estilos.tarjeta} accessibilityLabel={`${fila.codigo} · ${fila.nombre}`}>
      <Card.Content style={estilos.contenido}>
        <View style={estilos.fila}>
          <Text variant="titleMedium" style={[estilos.nombre, { color: colors.onSurface }]}>
            {fila.codigo} · {fila.nombre}
          </Text>
          <EstadoChip {...presentacionEstadoStock(fila.estado)} />
        </View>
        <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
          Cantidad: {cantidad(fila.cantidad)}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.textoSecundario }}>
          Mínimo: {cantidad(fila.minimo)}
        </Text>
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  lista: { padding: 16, gap: 12 },
  encabezado: { gap: 4 },
  tarjeta: { borderRadius: radios.tarjeta },
  contenido: { gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { flex: 1 },
});
