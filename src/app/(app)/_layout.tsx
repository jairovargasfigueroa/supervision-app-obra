import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { BarraSuperior } from '../../componentes/BarraSuperior';
import { nombreRoles, PESTANAS, pestanasPorRol, type Pestana } from '../../sesion/roles';
import { useSesion } from '../../sesion/sesion';
import { useTema } from '../../tema';

const iconoPestana =
  (nombre: Pestana['icono']) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons
      name={nombre}
      color={typeof color === 'string' ? color : undefined}
      size={size}
    />
  );

// Pestañas según el rol (criterio 5) y barra superior con el nombre y el rol (criterio 11).
export default function AppLayout() {
  const { colors } = useTema();
  const { sesion, cerrarSesion } = useSesion();
  const usuario = sesion.estado === 'activa' ? sesion.usuario : null;
  const roles = usuario?.roles ?? [];
  const visibles = new Set(pestanasPorRol(roles).map((pestana) => pestana.ruta));
  const nombre = usuario?.nombre ?? '';
  const rol = nombreRoles(roles);

  return (
    <Tabs
      screenOptions={{
        header: () => (
          <BarraSuperior nombre={nombre} rol={rol} onCerrarSesion={() => void cerrarSesion()} />
        ),
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
