import { StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

import { useTema } from '../tema';

type Props = {
  /** Nombre del usuario. */
  nombre: string;
  /** Rol que se muestra debajo del nombre (criterio 11). */
  rol: string;
};

/** Barra superior de la app (color primario, docs/diseno-visual.md): nombre y rol del usuario. */
export function BarraSuperior({ nombre, rol }: Props) {
  const { colors } = useTema();
  return (
    <Appbar.Header style={{ backgroundColor: colors.primary }}>
      <Appbar.Content
        title={
          <View>
            <Text variant="titleMedium" numberOfLines={1} style={{ color: colors.onPrimary }}>
              {nombre}
            </Text>
            {rol ? (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={[estilos.rol, { color: colors.primarioSuave }]}
              >
                {rol}
              </Text>
            ) : null}
          </View>
        }
      />
    </Appbar.Header>
  );
}

const estilos = StyleSheet.create({
  rol: { marginTop: 2 },
});
