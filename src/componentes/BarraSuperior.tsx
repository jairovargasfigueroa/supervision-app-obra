import { StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

import { useTema } from '../tema';

type Props = {
  /** Nombre del usuario. */
  nombre: string;
  /** Rol que se muestra debajo del nombre (criterio 11). */
  rol: string;
  onCerrarSesion: () => void;
  /** Si hay pantalla anterior, muestra «Volver». */
  onVolver?: () => void;
};

/** Barra superior de la app (color primario, docs/diseno-visual.md): «Volver», nombre, rol y «Cerrar sesión». */
export function BarraSuperior({ nombre, rol, onCerrarSesion, onVolver }: Props) {
  const { colors } = useTema();
  return (
    <Appbar.Header style={{ backgroundColor: colors.primary }}>
      {onVolver ? (
        <Appbar.BackAction color={colors.onPrimary} accessibilityLabel="Volver" onPress={onVolver} />
      ) : null}
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
      <Appbar.Action
        icon="logout"
        color={colors.onPrimary}
        accessibilityLabel="Cerrar sesión"
        onPress={onCerrarSesion}
      />
    </Appbar.Header>
  );
}

const estilos = StyleSheet.create({
  rol: { marginTop: 2 },
});
