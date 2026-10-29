import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { BarraSuperior } from '../../componentes/BarraSuperior';
import { useTema } from '../../tema';

type NombreIcono = ComponentProps<typeof MaterialCommunityIcons>['name'];

const iconoPestana =
  (nombre: NombreIcono) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons
      name={nombre}
      color={typeof color === 'string' ? color : undefined}
      size={size}
    />
  );

export default function AppLayout() {
  const { colors } = useTema();
  return (
    <Tabs
      screenOptions={{
        header: () => <BarraSuperior titulo="Supervisión de obras" />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textoSecundario,
      }}
    >
      <Tabs.Screen
        name="obras/index"
        options={{ title: 'Mis obras', tabBarIcon: iconoPestana('office-building-outline') }}
      />
    </Tabs>
  );
}
