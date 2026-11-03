// Avisos push en la app (010). Va dentro de la sincronización (101), en `(app)/_layout.tsx`: con cada
// cambio del paquete de datos guardado (al descargarlo, al actualizar los datos) suscribe el celular a
// los temas de las obras asignadas y deja los de las que ya no tiene (criterio 8).
import { useEffect } from 'react';

import { useSesion } from '../sesion/sesion';
import { usePaquete } from '../sync/sincronizacion';
import { actualizarAvisos } from './push';

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

export function AvisosPush() {
  useSuscripcionAvisos();
  return null;
}
