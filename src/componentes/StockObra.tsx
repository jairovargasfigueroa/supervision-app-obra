import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { ObraPaquete, PaqueteDatos } from '../api/sincronizacion';
import { AYUDA_ESTADOS_STOCK, MENSAJE_STOCK_VACIO, presentacionEstadoStock } from '../nucleo/estado-stock';
import { formatearCantidadMaterial } from '../nucleo/formato';
import { mensajeIncluyeSinEnviar } from '../sync/mensajes';
import type { PaqueteLocal } from '../sync/paquete';
import { useOperaciones, usePaquete } from '../sync/sincronizacion';
import { stockConPendientes, type StockLocal } from '../sync/stock-local';
import { radios, useTema } from '../tema';
import { AvisoSinSenal } from './AvisoSinSenal';
import { EstadoChip } from './EstadoChip';
import { EstadoVacio } from './EstadoVacio';
import { TituloObra } from './TituloObra';

type FilaVista = StockLocal & { codigo: string; nombre: string; unidad: string; unidadPlural: string };

/** Las filas con los datos del material del paquete, por código (como las devuelve Materiales). */
function filasConMaterial(filas: readonly StockLocal[], materiales: PaqueteDatos['materiales']): FilaVista[] {
  const porId = new Map(materiales.map((m) => [m.id, m]));
  return filas
    .map((fila) => {
      const material = porId.get(fila.materialId);
      return {
        ...fila,
        codigo: material?.codigo ?? '',
        nombre: material?.nombre ?? fila.materialId,
        unidad: material?.unidad ?? '',
        unidadPlural: material?.unidadPlural ?? '',
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

type Props = { obra: ObraPaquete; paquete: PaqueteLocal };

/**
 * Stock de la obra (004, criterio 9): cantidad, mínimo y estado de cada material, como en el ERP. Desde
 * la 101 sale del paquete guardado más los movimientos sin enviar (criterio 9 de la 101), con «Incluye
 * N movimientos sin enviar» y, sin conexión, «Sin señal · datos del dd/mm hh:mm».
 */
export function StockObra({ obra, paquete }: Props) {
  const { colors } = useTema();
  const { actualizarDatos, conectado } = usePaquete();
  const operaciones = useOperaciones();
  const [actualizando, setActualizando] = useState(false);

  const { filas, sinEnviar } = useMemo(() => {
    const stock = stockConPendientes(obra, operaciones.data ?? []);
    return { filas: filasConMaterial(stock.filas, paquete.contenido.materiales), sinEnviar: stock.sinEnviar };
  }, [obra, operaciones.data, paquete.contenido.materiales]);

  const actualizar = () => {
    setActualizando(true);
    actualizarDatos()
      .catch(() => undefined)
      .finally(() => setActualizando(false));
  };

  const encabezado = (
    <View style={estilos.encabezado}>
      <TituloObra obra={obra} />
      <AvisoSinSenal conectado={conectado} descargadoEn={paquete.descargadoEn} />
      <Text variant="bodySmall" style={{ color: colors.textoSecundario }}>
        {AYUDA_ESTADOS_STOCK}
      </Text>
      {sinEnviar > 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.atencion }} testID="stock-sin-enviar">
          {mensajeIncluyeSinEnviar(sinEnviar)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={filas}
      keyExtractor={(fila) => fila.materialId}
      contentContainerStyle={estilos.lista}
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={actualizar} />}
      ListHeaderComponent={encabezado}
      ListEmptyComponent={<EstadoVacio icono="package-variant-closed" mensaje={MENSAJE_STOCK_VACIO} />}
      renderItem={({ item }) => <FilaDeStock fila={item} />}
    />
  );
}

function FilaDeStock({ fila }: { fila: FilaVista }) {
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
  lista: { padding: 16, gap: 12 },
  encabezado: { gap: 8 },
  tarjeta: { borderRadius: radios.tarjeta },
  contenido: { gap: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { flex: 1 },
});
