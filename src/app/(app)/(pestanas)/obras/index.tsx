import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../../componentes/ObrasAsignadas';
import { pantallasObraPorRol, rutaDeObra } from '../../../../sesion/roles';
import { useSesion } from '../../../../sesion/sesion';

// Mis obras (maestro y almacenero): las obras asignadas, con un botón por cada pantalla de obra del
// rol: «Foto de avance» para el maestro (005, criterio 1); «Ingreso», «Salida» y «Stock» para el
// almacenero (004, criterio 1).
export default function MisObras() {
  const { sesion } = useSesion();
  const roles = sesion.estado === 'activa' ? sesion.usuario.roles : [];
  return (
    <ObrasAsignadas
      icono="office-building-outline"
      acciones={pantallasObraPorRol(roles).map((pantalla) => ({
        texto: pantalla.accion,
        icono: pantalla.icono,
        onPress: (obra) => router.push(rutaDeObra(pantalla.ruta, obra.id)),
      }))}
    />
  );
}
