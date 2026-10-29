import { Stack } from 'expo-router';

import { BarraSuperior } from '../../componentes/BarraSuperior';
import { nombreRoles, PANTALLAS_OBRA, tieneAlgunRol } from '../../sesion/roles';
import { useSesion } from '../../sesion/sesion';

// Al abrir una pantalla de obra desde un enlace, debajo quedan las pestañas para volver.
export const unstable_settings = { initialRouteName: '(pestanas)' };

// Barra superior con el nombre y el rol (001, criterio 11) sobre las pestañas `(pestanas)` y sobre
// las pantallas de una obra (`obras/[id]/…`), que se apilan encima de las pestañas con «atrás».
// Cada pantalla de obra solo existe para su rol (Stack.Protected).
export default function AppLayout() {
  const { sesion, cerrarSesion } = useSesion();
  const usuario = sesion.estado === 'activa' ? sesion.usuario : null;
  const roles = usuario?.roles ?? [];

  return (
    <Stack
      screenOptions={{
        header: ({ back, navigation }) => (
          <BarraSuperior
            nombre={usuario?.nombre ?? ''}
            rol={nombreRoles(roles)}
            onCerrarSesion={() => void cerrarSesion()}
            onVolver={back ? () => navigation.goBack() : undefined}
          />
        ),
      }}
    >
      <Stack.Screen name="(pestanas)" />
      {PANTALLAS_OBRA.map((pantalla) => (
        <Stack.Protected key={pantalla.ruta} guard={tieneAlgunRol(roles, pantalla.roles)}>
          <Stack.Screen name={pantalla.ruta} options={{ title: pantalla.titulo }} />
        </Stack.Protected>
      ))}
    </Stack>
  );
}
