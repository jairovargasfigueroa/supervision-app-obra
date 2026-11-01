import { Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Surface, Text } from 'react-native-paper';

import type { ResultadoEpp } from '../avance/epp/analisis';
import {
  ETIQUETA_RECUADRO,
  hayFaltaDeEpp,
  MENSAJE_ANALISIS_FALLIDO,
  MENSAJE_ANALIZANDO,
  MENSAJE_AVISO_EPP,
  MENSAJE_SIN_PERSONAS,
  resumenEpp,
} from '../avance/epp/mensajes';
import type { EstadoEpp } from '../avance/epp/useAnalisisEpp';
import { radios, useTema } from '../tema';

/**
 * Resultado del análisis de casco y chaleco (301, criterios 1, 2, 4 y 5): «Analizando…», el resumen
 * («Personas: 4 · Sin casco: 1 · Sin chaleco: 2») con el aviso si falta equipo, «No se detectaron
 * personas» o «No se pudo analizar la foto». El aviso no bloquea nada.
 */
export function ResumenEpp({ estado }: { estado: EstadoEpp | null }) {
  const { colors } = useTema();
  if (!estado) {
    return null;
  }
  if (estado.estado === 'analizando') {
    return (
      <View style={estilos.fila} testID="epp-analizando">
        <ActivityIndicator size="small" />
        <Text variant="bodyMedium" style={{ color: colors.textoSecundario }}>
          {MENSAJE_ANALIZANDO}
        </Text>
      </View>
    );
  }
  if (estado.estado === 'fallo') {
    return (
      <Text variant="bodyMedium" style={{ color: colors.textoSecundario }} testID="epp-fallo">
        {MENSAJE_ANALISIS_FALLIDO}
      </Text>
    );
  }
  const { resultado } = estado;
  if (resultado.personas === 0) {
    return (
      <Text variant="bodyMedium" style={{ color: colors.textoSecundario }} testID="epp-resumen">
        {MENSAJE_SIN_PERSONAS}
      </Text>
    );
  }
  return (
    <View style={estilos.resultado}>
      <Text variant="bodyMedium" style={{ color: colors.onSurface }} testID="epp-resumen">
        {resumenEpp(resultado)}
      </Text>
      {hayFaltaDeEpp(resultado) ? (
        <Surface
          mode="flat"
          style={[estilos.aviso, { backgroundColor: colors.atencionSuave }]}
          accessibilityRole="alert"
          testID="aviso-epp"
        >
          <Text variant="bodyMedium" style={{ color: colors.atencion }}>
            {MENSAJE_AVISO_EPP}
          </Text>
        </Surface>
      ) : null}
    </View>
  );
}

type PropsFoto = {
  uri: string;
  ancho: number;
  alto: number;
  /** Resultado del análisis, si terminó: recuadro sobre cada persona sin casco o sin chaleco. */
  resultado?: ResultadoEpp | null;
  testID?: string;
};

/** Vista previa de la foto con un recuadro sobre cada persona señalada (criterio 2). */
export function FotoConRecuadros({ uri, ancho, alto, resultado, testID }: PropsFoto) {
  const { colors } = useTema();
  const senaladas = resultado ? resultado.cajas.filter((c) => c.sinCasco || c.sinChaleco) : [];
  const porcentaje = (valor: number, total: number) => `${(valor / total) * 100}%` as const;
  return (
    <View style={[estilos.foto, { aspectRatio: proporcion(ancho, alto) }]}>
      <Image
        source={{ uri }}
        accessibilityLabel="Vista previa de la foto"
        testID={testID}
        resizeMode="cover"
        style={estilos.imagen}
      />
      {resultado
        ? senaladas.map((caja, i) => (
            <View
              key={i}
              pointerEvents="none"
              accessibilityLabel={ETIQUETA_RECUADRO}
              testID="recuadro-epp"
              style={[
                estilos.recuadro,
                {
                  borderColor: colors.error,
                  left: porcentaje(caja.x, resultado.ancho),
                  top: porcentaje(caja.y, resultado.alto),
                  width: porcentaje(caja.ancho, resultado.ancho),
                  height: porcentaje(caja.alto, resultado.alto),
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const proporcion = (ancho: number, alto: number) => (ancho > 0 && alto > 0 ? ancho / alto : 4 / 3);

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultado: { gap: 8 },
  aviso: { borderRadius: radios.tarjeta, padding: 12 },
  foto: { width: '100%', borderRadius: radios.tarjeta, overflow: 'hidden' },
  imagen: { width: '100%', height: '100%' },
  recuadro: { position: 'absolute', borderWidth: 3, borderRadius: 4 },
});
