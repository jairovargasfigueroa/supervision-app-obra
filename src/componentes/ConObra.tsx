import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { mensajeDeError } from '../api/errores';
import { obraQuery, type DetalleObra } from '../api/obras';
import { useSesion } from '../sesion/sesion';
import { useTema } from '../tema';
import { EstadoError } from './EstadoError';

type Props = {
  id: string;
  children: (obra: DetalleObra) => ReactNode;
};

/**
 * Carga la obra (`GET /obras/{id}`, con sus partidas) para una pantalla de obra: mientras carga,
 * el indicador; si falla, el error con «Reintentar»; si no, `children` con la obra.
 */
export function ConObra({ id, children }: Props) {
  const { obtenerToken } = useSesion();
  const obra = useQuery(obraQuery(id, obtenerToken));

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
  return <>{children(obra.data)}</>;
}

/** Nombre de la obra como título de la pantalla. */
export function TituloObra({ obra }: { obra: Pick<DetalleObra, 'nombre'> }) {
  const { colors } = useTema();
  return (
    <Text variant="titleLarge" style={[estilos.titulo, { color: colors.onSurface }]}>
      {obra.nombre}
    </Text>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  titulo: { fontWeight: '600' },
});
