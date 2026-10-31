import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { EncabezadoApp } from '../../componentes/EncabezadoApp';
import { PANTALLAS_OBRA, tieneAlgunRol } from '../../sesion/roles';
import { useSesion } from '../../sesion/sesion';
import { SincronizacionProvider } from '../../sync/sincronizacion';

// Al abrir una pantalla de obra desde un enlace, debajo quedan las pestañas para volver.
export const unstable_settings = { initialRouteName: '(pestanas)' };

// Barra superior con el nombre y el rol (001, criterio 11) sobre las pestañas `(pestanas)` y sobre
// las pantallas de una obra (`obras/[id]/…`), que se apilan encima de las pestañas con «atrás».
// Cada pantalla de obra solo existe para su rol (Stack.Protected). Con la sesión abierta corre la
// sincronización de la cola (101) del usuario.
export default function AppLayout() {
  const { sesion, obtenerToken } = useSesion();
  const usuario = sesion.estado === 'activa' ? sesion.usuario : null;
  const roles = usuario?.roles ?? [];
  const usuarioSync = useMemo(
    () => (usuario ? { id: usuario.id, nombre: usuario.nombre } : null),
    [usuario?.id, usuario?.nombre], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pila = (
    <Stack
      screenOptions={{
        header: ({ back, navigation }) => (
          <EncabezadoApp onVolver={back ? () => navigation.goBack() : undefined} />
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

  if (!usuarioSync) {
    return pila;
  }
  return (
    <SincronizacionProvider key={usuarioSync.id} usuario={usuarioSync} obtenerToken={obtenerToken}>
      {pila}
    </SincronizacionProvider>
  );
}
