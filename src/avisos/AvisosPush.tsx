// Avisos push en la app (010). Va dentro de la sincronización (101), en `(app)/_layout.tsx`:
// - con cada cambio del paquete de datos guardado (al descargarlo, al actualizar los datos) suscribe el
//   celular a los temas de las obras asignadas y deja los de las que ya no tiene (criterio 8);
// - al tocar la notificación abre el stock o el diario de la obra (criterios 3 y 5);
// - con la app abierta muestra el aviso en un Snackbar con «Ver» (criterio 9).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Portal, Snackbar } from 'react-native-paper';

import { useSesion } from '../sesion/sesion';
import { usePaquete } from '../sync/sincronizacion';
import { actualizarAvisos, escucharAvisos, type Aviso } from './push';
import { rutaDeAviso } from './rutaDeAviso';

/** Cuánto queda a la vista el aviso con la app abierta. */
export const DURACION_AVISO_MS = 8_000;

function useSuscripcionAvisos(): void {
  const { sesion } = useSesion();
  const { paquete, conectado } = usePaquete();
  const roles = sesion.estado === 'activa' ? sesion.usuario.roles : [];
  const obras = paquete.data?.contenido.obras;
  // Claves de texto: el efecto corre solo si cambian las obras, los roles o la señal.
  const claveObras = obras ? obras.map((obra) => obra.id).sort().join('\n') : null;
  const claveRoles = [...roles].sort().join('\n');

  useEffect(() => {
    if (claveObras === null) {
      // Todavía no hay paquete guardado (o se está leyendo): no se toca nada.
      return;
    }
    actualizarAvisos({
      obras: claveObras === '' ? [] : claveObras.split('\n').map((id) => ({ id })),
      roles: claveRoles === '' ? [] : claveRoles.split('\n'),
      conectado,
    }).catch((error: unknown) => console.warn('[avisos] no se pudieron actualizar los temas', error));
  }, [claveObras, claveRoles, conectado]);
}

function abrir(aviso: Aviso): void {
  const ruta = rutaDeAviso(aviso.datos);
  if (ruta) {
    router.push(ruta);
  }
}

export function AvisosPush() {
  useSuscripcionAvisos();
  const [abierto, setAbierto] = useState<Aviso | null>(null);

  useEffect(
    () =>
      escucharAvisos({
        alTocar: (aviso) => {
          setAbierto(null);
          abrir(aviso);
        },
        conLaAppAbierta: setAbierto,
      }),
    [],
  );

  const ruta = abierto ? rutaDeAviso(abierto.datos) : null;
  const texto = abierto ? [abierto.titulo, abierto.cuerpo].filter(Boolean).join('\n') : '';
  return (
    <Portal>
      <Snackbar
        visible={abierto !== null}
        onDismiss={() => setAbierto(null)}
        duration={DURACION_AVISO_MS}
        action={
          ruta
            ? {
                label: 'Ver',
                onPress: () => {
                  setAbierto(null);
                  router.push(ruta);
                },
              }
            : undefined
        }
      >
        {texto}
      </Snackbar>
    </Portal>
  );
}
