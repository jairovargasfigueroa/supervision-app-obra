import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

import type { TonoEstado } from '../nucleo/estado-stock';
import { radios, useTema, type Tema } from '../tema';

type Props = { etiqueta: string; tono: TonoEstado };

const COLORES: Record<TonoEstado, (colores: Tema['colors']) => { fondo: string; texto: string }> = {
  exito: (c) => ({ fondo: c.exitoSuave, texto: c.exito }),
  atencion: (c) => ({ fondo: c.atencionSuave, texto: c.atencion }),
  error: (c) => ({ fondo: c.errorSuave, texto: c.error }),
};

/** Estado como chip: fondo suave y texto del color fuerte (docs/diseno-visual.md). */
export function EstadoChip({ etiqueta, tono }: Props) {
  const { colors } = useTema();
  const { fondo, texto } = COLORES[tono](colors);
  return (
    <Chip
      compact
      style={[estilos.chip, { backgroundColor: fondo }]}
      textStyle={[estilos.texto, { color: texto }]}
      accessibilityLabel={`Estado: ${etiqueta}`}
      testID={`chip-${tono}`}
    >
      {etiqueta}
    </Chip>
  );
}

const estilos = StyleSheet.create({
  chip: { borderRadius: radios.chip, alignSelf: 'flex-start' },
  texto: { fontWeight: '500' },
});
