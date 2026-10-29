import { Appbar } from 'react-native-paper';

import { useTema } from '../tema';

type Props = {
  titulo: string;
};

/** Barra superior de la app (color primario, docs/diseno-visual.md). */
export function BarraSuperior({ titulo }: Props) {
  const { colors } = useTema();
  return (
    <Appbar.Header style={{ backgroundColor: colors.primary }}>
      <Appbar.Content title={titulo} color={colors.onPrimary} />
    </Appbar.Header>
  );
}
