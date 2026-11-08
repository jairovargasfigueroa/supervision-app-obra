import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, Icon, Snackbar, Surface, Text, TextInput } from 'react-native-paper';

import type { ObraPaquete } from '../api/sincronizacion';
import { largoTexto, TEXTO_MAXIMO } from '../formularios/diario.esquema';
import { sePuedeCorregir, useDiario } from '../formularios/useDiario';
import { primerError } from '../formularios/useMovimiento';
import { CLIMAS, ETIQUETA_CLIMA, ICONO_CLIMA } from '../nucleo/clima';
import { formatearDiaMes, formatearFecha } from '../nucleo/formato';
import type { EntradaDiario } from '../sync/diario-local';
import { ETIQUETA_ENTRADA, mensajeRechazo } from '../sync/mensajes';
import { radios, TAMANO_TACTIL_MINIMO, useTema } from '../tema';
import { EstadoChip } from './EstadoChip';
import { EstadoVacio } from './EstadoVacio';
import { TituloObra } from './TituloObra';

export const MENSAJE_DIARIO_VACIO = 'Aún no hay entradas del diario en los últimos 30 días.';

type Props = { obra: ObraPaquete };

/** «Hoy», «Ayer» o «dd/mm». */
function etiquetaFecha(fecha: string, indice: number): string {
  return indice === 0 ? 'Hoy' : indice === 1 ? 'Ayer' : formatearDiaMes(fecha);
}

/**
 * Diario de obra (103, maestro): arriba la entrada del día (fecha, clima y texto) y debajo las entradas
 * de los últimos 30 días, las del servidor (del paquete) y las del celular que todavía no se enviaron
 * («Sin enviar») o que se rechazaron («Rechazada»).
 */
export function DiarioObra({ obra }: Props) {
  const { colors } = useTema();
  const diario = useDiario(obra);
  const { formulario, enviando } = diario;

  const encabezado = (
    <View style={estilos.encabezado}>
      <TituloObra obra={obra} />
      {diario.editando ? (
        <Surface
          mode="flat"
          style={[estilos.aviso, estilos.fila, { backgroundColor: colors.atencionSuave }]}
          testID="corrigiendo-diario"
        >
          <Text variant="bodyMedium" style={[estilos.titulo, { color: colors.atencion }]}>
            Corrigiendo la entrada del {formatearDiaMes(diario.editando.fecha)}
          </Text>
          <Button onPress={diario.cancelarCorreccion} disabled={enviando}>
            Cancelar
          </Button>
        </Surface>
      ) : null}
      <formulario.Subscribe selector={(estado) => estado.submissionAttempts > 0}>
        {(intento) => (
          <>
            <formulario.Field name="fecha">
              {(campo) => (
                <View style={estilos.campo}>
                  <Text variant="titleMedium" style={{ color: colors.onSurface }}>
                    Fecha
                  </Text>
                  <View style={estilos.opciones}>
                    {diario.fechas.map((fecha, i) => (
                      <Chip
                        key={fecha}
                        selected={campo.state.value === fecha}
                        showSelectedCheck={false}
                        mode={campo.state.value === fecha ? 'flat' : 'outlined'}
                        onPress={() => campo.handleChange(fecha)}
                        disabled={enviando}
                        accessibilityLabel={`Fecha: ${etiquetaFecha(fecha, i)}`}
                        accessibilityState={{ selected: campo.state.value === fecha }}
                      >
                        {etiquetaFecha(fecha, i)}
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
            </formulario.Field>
            <formulario.Field name="clima">
              {(campo) => {
                const error = campo.state.meta.isTouched || intento ? primerError(campo.state.meta.errors) : null;
                return (
                  <View style={estilos.campo}>
                    <Text variant="titleMedium" style={{ color: colors.onSurface }}>
                      Clima
                    </Text>
                    <View style={estilos.opciones}>
                      {CLIMAS.map((clima) => (
                        <Chip
                          key={clima}
                          icon={ICONO_CLIMA[clima]}
                          selected={campo.state.value === clima}
                          showSelectedCheck={false}
                          mode={campo.state.value === clima ? 'flat' : 'outlined'}
                          onPress={() => campo.handleChange(clima)}
                          disabled={enviando}
                          accessibilityLabel={`Clima: ${ETIQUETA_CLIMA[clima]}`}
                          accessibilityState={{ selected: campo.state.value === clima }}
                        >
                          {ETIQUETA_CLIMA[clima]}
                        </Chip>
                      ))}
                    </View>
                    {error ? (
                      <HelperText type="error" visible>
                        {error}
                      </HelperText>
                    ) : null}
                  </View>
                );
              }}
            </formulario.Field>
            <formulario.Field name="texto">
              {(campo) => {
                const error = campo.state.meta.isTouched || intento ? primerError(campo.state.meta.errors) : null;
                return (
                  <View>
                    <TextInput
                      mode="outlined"
                      label="Qué pasó hoy en la obra"
                      accessibilityLabel="Texto del diario"
                      multiline
                      numberOfLines={4}
                      value={campo.state.value}
                      onChangeText={campo.handleChange}
                      onBlur={campo.handleBlur}
                      error={error !== null}
                      disabled={enviando}
                      outlineStyle={{ borderRadius: radios.control }}
                    />
                    <View style={estilos.pie}>
                      <View style={estilos.errorTexto}>
                        {error ? (
                          <HelperText type="error" visible>
                            {error}
                          </HelperText>
                        ) : null}
                      </View>
                      <Text variant="bodySmall" style={{ color: colors.textoSecundario }} testID="contador-texto">
                        {`${largoTexto(campo.state.value)}/${TEXTO_MAXIMO}`}
                      </Text>
                    </View>
                  </View>
                );
              }}
            </formulario.Field>
          </>
        )}
      </formulario.Subscribe>
      {diario.fallo ? (
        <Surface
          mode="flat"
          style={[estilos.aviso, { backgroundColor: colors.errorSuave }]}
          accessibilityRole="alert"
          testID="diario-fallido"
        >
          <Text variant="bodyMedium" style={{ color: colors.error }}>
            {diario.fallo}
          </Text>
        </Surface>
      ) : null}
      <Button
        mode="contained"
        icon="content-save-outline"
        onPress={() => void formulario.handleSubmit()}
        loading={enviando}
        disabled={enviando}
        contentStyle={estilos.boton}
      >
        {diario.editando ? 'Guardar corrección' : 'Guardar entrada'}
      </Button>
      <Text variant="titleMedium" style={[estilos.subtitulo, { color: colors.onSurface }]}>
        Últimos 30 días
      </Text>
    </View>
  );

  return (
    <View style={estilos.pantalla}>
      <FlatList
        data={diario.entradas}
        keyExtractor={(e) => e.id}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={encabezado}
        ListEmptyComponent={<EstadoVacio icono="notebook-outline" mensaje={MENSAJE_DIARIO_VACIO} />}
        renderItem={({ item }) => (
          <TarjetaEntrada
            entrada={item}
            onCorregir={sePuedeCorregir(item) && !enviando ? () => diario.corregir(item) : undefined}
          />
        )}
      />
      <Snackbar visible={diario.resultado !== null} onDismiss={diario.cerrarResultado} duration={4000}>
        {diario.resultado ?? ''}
      </Snackbar>
    </View>
  );
}

function TarjetaEntrada({ entrada, onCorregir }: { entrada: EntradaDiario; onCorregir?: () => void }) {
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
      {onCorregir ? (
        <Card.Actions>
          <Button
            icon="pencil-outline"
            onPress={onCorregir}
            accessibilityLabel={`Corregir: diario del ${formatearFecha(entrada.fecha)}`}
            contentStyle={estilos.boton}
          >
            Corregir
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
  campo: { gap: 8 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorTexto: { flex: 1 },
  aviso: { borderRadius: radios.tarjeta, padding: 12 },
  boton: { minHeight: TAMANO_TACTIL_MINIMO },
  subtitulo: { marginTop: 8 },
  tarjeta: { borderRadius: radios.tarjeta },
  contenido: { gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
});
