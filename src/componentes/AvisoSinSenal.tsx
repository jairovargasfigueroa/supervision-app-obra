import { StyleSheet } from 'react-native';
import { Icon, Surface, Text } from 'react-native-paper';

import { mensajeSinSenal } from '../sync/mensajes';
import { radios, useTema } from '../tema';

/**
 * «Sin señal · datos del dd/mm hh:mm» (101, criterio 3): solo cuando NetInfo dice que no hay
 * conexión y se trabaja con el paquete guardado.
 */
export function AvisoSinSenal({ conectado, descargadoEn }: { conectado: boolean; descargadoEn: string }) {
  const { colors } = useTema();
  if (conectado) {
    return null;
  }
  return (
    <Surface
      mode="flat"
      style={[estilos.aviso, { backgroundColor: colors.atencionSuave }]}
      testID="aviso-sin-senal"
    >
      <Icon source="wifi-off" size={20} color={colors.atencion} />
      <Text variant="bodyMedium" style={[estilos.texto, { color: colors.atencion }]}>
        {mensajeSinSenal(descargadoEn)}
      </Text>
    </Surface>
  );
}

const estilos = StyleSheet.create({
  aviso: { borderRadius: radios.tarjeta, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  texto: { flex: 1 },
});
