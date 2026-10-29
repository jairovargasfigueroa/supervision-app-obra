import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import { mensajeDeError } from '../api/errores';
import { obrasAsignadasQuery, type Obra } from '../api/obras';
import { useSesion } from '../sesion/sesion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../tema';
import { EstadoError } from './EstadoError';
import { PantallaVacia } from './PantallaVacia';

type Props = {
  /** Ícono del estado vacío. */
  icono: string;
  /** Texto sobre la lista, p. ej. «Elige la obra». */
  titulo?: string;
  /** Al pulsar la tarjeta de una obra. */
  onElegir?: (obra: Obra) => void;
  /** Botones de cada tarjeta, p. ej. «Foto de avance» o «Ingreso», «Salida» y «Stock». */
  acciones?: readonly Accion[];
};

type Accion = { texto: string; icono: string; onPress: (obra: Obra) => void };

/** Obras asignadas al usuario (`GET /obras`), con sus estados de carga, vacío y error. */
export function ObrasAsignadas({ icono, titulo, onElegir, acciones = [] }: Props) {
  const { obtenerToken } = useSesion();
  const { colors } = useTema();
  const consulta = useQuery(obrasAsignadasQuery(obtenerToken));

  if (consulta.isPending) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando obras" />
      </View>
    );
  }
  if (consulta.isError) {
    return (
      <View style={estilos.centro}>
        <EstadoError
          mensaje={mensajeDeError(consulta.error)}
          onReintentar={() => void consulta.refetch()}
        />
      </View>
    );
  }
  if (consulta.data.length === 0) {
    return <PantallaVacia icono={icono} />;
  }

  return (
    <FlatList
      data={consulta.data}
      keyExtractor={(obra) => obra.id}
      contentContainerStyle={estilos.lista}
      refreshControl={
        <RefreshControl
          refreshing={consulta.isRefetching}
          onRefresh={() => void consulta.refetch()}
        />
      }
      ListHeaderComponent={
        titulo ? (
          <Text variant="titleMedium" style={{ color: colors.onSurface }}>
            {titulo}
          </Text>
        ) : undefined
      }
      renderItem={({ item: obra }) => (
        <Card
          mode="outlined"
          style={estilos.tarjeta}
          onPress={onElegir ? () => onElegir(obra) : undefined}
          accessibilityLabel={obra.nombre}
        >
          <Card.Title
            title={obra.nombre}
            subtitle={obra.ubicacion ?? undefined}
            titleVariant="titleMedium"
            subtitleNumberOfLines={2}
          />
          {acciones.length > 0 ? (
            <Card.Actions style={estilos.acciones}>
              {acciones.map((accion) => (
                <Button
                  key={accion.texto}
                  mode={acciones.length === 1 ? 'contained' : 'outlined'}
                  icon={accion.icono}
                  onPress={() => accion.onPress(obra)}
                  accessibilityLabel={`${accion.texto}: ${obra.nombre}`}
                  contentStyle={estilos.boton}
                >
                  {accion.texto}
                </Button>
              ))}
            </Card.Actions>
          ) : null}
        </Card>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderRadius: radios.tarjeta },
  // Con varios botones (almacenero, o los dos roles) bajan de renglón en pantallas de 360 px.
  acciones: { flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 8 },
  boton: { minHeight: TAMANO_TACTIL_MINIMO },
});
