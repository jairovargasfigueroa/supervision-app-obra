import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../../componentes/ObrasAsignadas';
import { tieneAlgunRol } from '../../../../sesion/roles';
import { useSesion } from '../../../../sesion/sesion';

// Mis obras (maestro y almacenero): las obras asignadas. El maestro tiene en cada una «Foto de
// avance» (005, criterio 1); las acciones del almacenero llegan con la 004.
export default function MisObras() {
  const { sesion } = useSesion();
  const esMaestro = sesion.estado === 'activa' && tieneAlgunRol(sesion.usuario.roles, ['maestro']);
  return (
    <ObrasAsignadas
      icono="office-building-outline"
      accion={
        esMaestro
          ? {
              texto: 'Foto de avance',
              icono: 'camera-outline',
              onPress: (obra) => router.push(`/obras/${obra.id}/foto`),
            }
          : undefined
      }
    />
  );
}
