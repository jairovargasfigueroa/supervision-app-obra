import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { MENSAJES } from '../api/errores';
import type { ObraPaquete } from '../api/sincronizacion';
import { MENSAJE_PRIMERA_VEZ_SIN_SENAL } from '../sync/mensajes';
import type { PaqueteLocal } from '../sync/paquete';
import { usePaquete } from '../sync/sincronizacion';
import { EstadoError } from './EstadoError';

type Props = {
  id: string;
  children: (obra: ObraPaquete, paquete: PaqueteLocal) => ReactNode;
};

/**
 * La obra del paquete de datos guardado en el celular (101): funciona con y sin señal. Si nunca se
 * descargó, «Necesitas señal la primera vez para descargar tus obras» (criterio 4) con «Reintentar»;
 * si la obra no está en el paquete, «Obra no encontrada».
 */
export function ConObraLocal({ id, children }: Props) {
  const { paquete, descarga, actualizarDatos } = usePaquete();
  const reintentar = () => void actualizarDatos().catch(() => undefined);

  if (paquete.isPending || (!paquete.data && descarga === 'descargando')) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando obra" />
      </View>
    );
  }
  if (!paquete.data) {
    return (
      <View style={estilos.centro}>
        <EstadoError mensaje={MENSAJE_PRIMERA_VEZ_SIN_SENAL} onReintentar={reintentar} />
      </View>
    );
  }
  const obra = paquete.data.contenido.obras.find((o) => o.id === id);
  if (!obra) {
    return (
      <View style={estilos.centro}>
        <EstadoError mensaje={MENSAJES.OBRA_NO_ENCONTRADA} onReintentar={reintentar} />
      </View>
    );
  }
  return <>{children(obra, paquete.data)}</>;
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
});
