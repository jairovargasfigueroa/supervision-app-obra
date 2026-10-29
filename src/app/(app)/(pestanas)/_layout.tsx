import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { PESTANAS, pestanasPorRol, type Pestana } from '../../../sesion/roles';
import { useSesion } from '../../../sesion/sesion';
import { useTema } from '../../../tema';

const iconoPestana =
  (nombre: Pestana['icono']) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons
      name={nombre}
      color={typeof color === 'string' ? color : undefined}
      size={size}
    />
  );

// Pestañas según el rol (criterio 5). La barra superior la pone el Stack de `(app)/_layout.tsx`.
export default function PestanasLayout() {
  const { colors } = useTema();
  const { sesion } = useSesion();
  const roles = sesion.estado === 'activa' ? sesion.usuario.roles : [];
  const visibles = new Set(pestanasPorRol(roles).map((pestana) => pestana.ruta));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textoSecundario,
      }}
    >
      {PESTANAS.map((pestana) => (
        <Tabs.Protected key={pestana.ruta} guard={visibles.has(pestana.ruta)}>
          <Tabs.Screen
            name={pestana.ruta}
            options={{ title: pestana.titulo, tabBarIcon: iconoPestana(pestana.icono) }}
          />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
