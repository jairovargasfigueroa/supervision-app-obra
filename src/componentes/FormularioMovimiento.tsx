import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Snackbar, Surface, Text, TextInput } from 'react-native-paper';

import { mensajeDeError } from '../api/errores';
import { stockQuery, type TipoMovimiento } from '../api/materiales';
import type { DetalleObra } from '../api/obras';
import { MENSAJE_REGISTRADO } from '../formularios/movimiento';
import { primerError, useMovimiento } from '../formularios/useMovimiento';
import { formatearCantidadMaterial } from '../nucleo/formato';
import { useSesion } from '../sesion/sesion';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../tema';
import { TituloObra } from './ConObra';
import { EstadoError } from './EstadoError';
import { EstadoVacio } from './EstadoVacio';
import { SelectorMaterial } from './SelectorMaterial';
import { SelectorPartida } from './SelectorPartida';

export const MENSAJE_SIN_MATERIALES = 'Aún no hay materiales.';
export const MENSAJE_SIN_PARTIDAS = 'Esta obra no tiene partidas.';

const TEXTO_BOTON: Record<TipoMovimiento, string> = {
  INGRESO: 'Registrar ingreso',
  SALIDA: 'Registrar salida',
};

type Props = { tipo: TipoMovimiento; obra: DetalleObra };

/**
 * Ingreso (criterio 2: material, cantidad y nota de remisión opcional) o salida (criterio 3:
 * material, cantidad y partida de destino) de material en una obra.
 */
export function FormularioMovimiento({ tipo, obra }: Props) {
  const { colors } = useTema();
  const { obtenerToken } = useSesion();
  const stock = useQuery(stockQuery(obra.id, obtenerToken));
  const movimiento = useMovimiento(tipo, obra.id);
  const { formulario, materiales, enviando } = movimiento;

  if (materiales.isPending) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator accessibilityLabel="Cargando materiales" />
      </View>
    );
  }
  if (materiales.isError) {
    return (
      <View style={estilos.centro}>
        <EstadoError
          mensaje={mensajeDeError(materiales.error)}
          onReintentar={() => void materiales.refetch()}
        />
      </View>
    );
  }

  const unidadesDe = (materialId: string) => materiales.data.find((material) => material.id === materialId);

  return (
    <View style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <TituloObra obra={obra} />

        <formulario.Subscribe selector={(estado) => estado.submissionAttempts > 0}>
          {(intentoEnviar) => (
            <>
              <formulario.Field name="materialId">
                {(campo) => {
                  const error = campo.state.meta.isTouched || intentoEnviar ? primerError(campo.state.meta.errors) : null;
                  const fila = stock.data?.find((item) => item.materialId === campo.state.value);
                  const material = unidadesDe(campo.state.value);
                  return (
                    <View style={estilos.campo}>
                      <Text variant="titleMedium" style={{ color: colors.onSurface }}>
                        Material
                      </Text>
                      {materiales.data.length === 0 ? (
                        <EstadoVacio icono="package-variant" mensaje={MENSAJE_SIN_MATERIALES} />
                      ) : (
                        <Surface mode="flat" style={[estilos.tarjeta, { backgroundColor: colors.surface }]}>
                          <SelectorMaterial
                            materiales={materiales.data}
                            valor={campo.state.value}
                            onCambiar={campo.handleChange}
                            deshabilitado={enviando}
                          />
                        </Surface>
                      )}
                      {material && stock.isSuccess ? (
                        <Text variant="bodyMedium" style={{ color: colors.textoSecundario }} testID="stock-material">
                          Stock: {formatearCantidadMaterial(fila?.cantidad ?? 0, material.unidad, material.unidadPlural)}
                        </Text>
                      ) : null}
                      {error ? (
                        <HelperText type="error" visible>
                          {error}
                        </HelperText>
                      ) : null}
                    </View>
                  );
                }}
              </formulario.Field>

              <formulario.Subscribe selector={(estado) => estado.values.materialId}>
                {(materialId) => (
                  <formulario.Field name="cantidad">
                    {(campo) => {
                      const error =
                        campo.state.meta.isTouched || intentoEnviar ? primerError(campo.state.meta.errors) : null;
                      const material = unidadesDe(materialId);
                      return (
                        <View>
                          <TextInput
                            mode="outlined"
                            label={material ? `Cantidad (${material.unidadPlural})` : 'Cantidad'}
                            accessibilityLabel="Cantidad"
                            keyboardType="decimal-pad"
                            value={campo.state.value}
                            onChangeText={campo.handleChange}
                            onBlur={campo.handleBlur}
                            error={error !== null}
                            disabled={enviando}
                            outlineStyle={{ borderRadius: radios.control }}
                          />
                          {error ? (
                            <HelperText type="error" visible>
                              {error}
                            </HelperText>
                          ) : null}
                        </View>
                      );
                    }}
                  </formulario.Field>
                )}
              </formulario.Subscribe>

              {tipo === 'INGRESO' ? (
                <formulario.Field name="notaRemision">
                  {(campo) => (
                    <TextInput
                      mode="outlined"
                      label="N.º de nota de remisión (opcional)"
                      accessibilityLabel="Nota de remisión"
                      autoCapitalize="characters"
                      value={campo.state.value}
                      onChangeText={campo.handleChange}
                      onBlur={campo.handleBlur}
                      disabled={enviando}
                      outlineStyle={{ borderRadius: radios.control }}
                    />
                  )}
                </formulario.Field>
              ) : (
                <formulario.Field name="partidaId">
                  {(campo) => {
                    const error =
                      campo.state.meta.isTouched || intentoEnviar ? primerError(campo.state.meta.errors) : null;
                    return (
                      <View style={estilos.campo}>
                        <Text variant="titleMedium" style={{ color: colors.onSurface }}>
                          Partida de destino
                        </Text>
                        {obra.partidas.length === 0 ? (
                          <EstadoVacio icono="format-list-bulleted" mensaje={MENSAJE_SIN_PARTIDAS} />
                        ) : (
                          <Surface mode="flat" style={[estilos.tarjeta, { backgroundColor: colors.surface }]}>
                            <SelectorPartida
                              partidas={obra.partidas}
                              valor={campo.state.value || null}
                              onCambiar={campo.handleChange}
                              deshabilitado={enviando}
                            />
                          </Surface>
                        )}
                        {error ? (
                          <HelperText type="error" visible>
                            {error}
                          </HelperText>
                        ) : null}
                      </View>
                    );
                  }}
                </formulario.Field>
              )}
            </>
          )}
        </formulario.Subscribe>

        {movimiento.fallo ? (
          <Surface
            mode="flat"
            style={[estilos.aviso, { backgroundColor: colors.errorSuave }]}
            accessibilityRole="alert"
            testID="registro-fallido"
          >
            <Text variant="bodyMedium" style={{ color: colors.error }}>
              {movimiento.fallo}
            </Text>
          </Surface>
        ) : null}
        {movimiento.avisoStock ? (
          <Surface
            mode="flat"
            style={[estilos.aviso, { backgroundColor: colors.atencionSuave }]}
            accessibilityRole="alert"
            testID="aviso-stock"
          >
            <Text variant="bodyMedium" style={{ color: colors.atencion }}>
              {movimiento.avisoStock}
            </Text>
          </Surface>
        ) : null}

        <Button
          mode="contained"
          icon={tipo === 'INGRESO' ? 'tray-arrow-down' : 'tray-arrow-up'}
          onPress={() => void formulario.handleSubmit()}
          loading={enviando}
          disabled={enviando}
          contentStyle={estilos.contenidoBoton}
        >
          {TEXTO_BOTON[tipo]}
        </Button>
      </ScrollView>
      <Snackbar visible={movimiento.registrado} onDismiss={movimiento.cerrarAvisoRegistrado} duration={4000}>
        {MENSAJE_REGISTRADO}
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', padding: 16 },
  contenido: { padding: 16, gap: 12 },
  campo: { gap: 8 },
  tarjeta: { borderRadius: radios.tarjeta, overflow: 'hidden' },
  aviso: { borderRadius: radios.tarjeta, padding: 12 },
  contenidoBoton: { minHeight: TAMANO_TACTIL_MINIMO },
});
