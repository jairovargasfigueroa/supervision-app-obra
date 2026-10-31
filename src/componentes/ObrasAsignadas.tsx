import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import type { ObraPaquete } from '../api/sincronizacion';
import { MENSAJE_PRIMERA_VEZ_SIN_SENAL } from '../sync/mensajes';
import { usePaquete } from '../sync/sincronizacion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../tema';
import { AvisoSinSenal } from './AvisoSinSenal';
import { EstadoError } from './EstadoError';
import { PantallaVacia } from './PantallaVacia';

type Obra = ObraPaquete;

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

/**
 * Obras asignadas al usuario (en ejecución), del paquete de datos guardado en el celular (101): con
 * señal se descarga al abrir la app y con «tirar para actualizar»; sin señal se muestra lo guardado con
 * «Sin señal · datos del dd/mm hh:mm».
 */
export function ObrasAsignadas({ icono, titulo, onElegir, acciones = [] }: Props) {
  const { colors } = useTema();
  const { paquete, descarga, actualizarDatos, conectado } = usePaquete();
  const [actualizando, setActualizando] = useState(false);

  const actualizar = () => {
    setActualizando(true);
    actualizarDatos()
      .catch(() => undefined)
      .finally(() => setActualizando(false));
  };

  if (paquete.isPending || (!paquete.data && descarga === 'descargando')) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando obras" />
      </View>
    );
  }
  if (!paquete.data) {
    // Primer uso sin señal (criterio 4), o Sincronización no respondió la primera vez.
    return (
      <View style={estilos.centro}>
        <EstadoError mensaje={MENSAJE_PRIMERA_VEZ_SIN_SENAL} onReintentar={actualizar} />
      </View>
    );
  }
  const { obras } = paquete.data.contenido;
  const aviso = <AvisoSinSenal conectado={conectado} descargadoEn={paquete.data.descargadoEn} />;
  if (obras.length === 0) {
    return (
      <View style={estilos.pantalla}>
        {conectado ? null : <View style={estilos.lista}>{aviso}</View>}
        <PantallaVacia icono={icono} />
      </View>
    );
  }

  return (
    <FlatList
      data={obras}
      keyExtractor={(obra) => obra.id}
      contentContainerStyle={estilos.lista}
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={actualizar} />}
      ListHeaderComponent={
        <View style={estilos.encabezado}>
          {aviso}
          {titulo ? (
            <Text variant="titleMedium" style={{ color: colors.onSurface }}>
              {titulo}
            </Text>
          ) : null}
        </View>
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
  pantalla: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  encabezado: { gap: 12 },
  lista: { padding: 16, gap: 12 },
  tarjeta: { borderRadius: radios.tarjeta },
  // Con varios botones (almacenero, o los dos roles) bajan de renglón en pantallas de 360 px.
  acciones: { flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 8 },
  boton: { minHeight: TAMANO_TACTIL_MINIMO },
});
