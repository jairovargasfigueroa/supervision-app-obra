import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../componentes/ObrasAsignadas';
import { rutaDeObra } from '../../../sesion/roles';

// Stock de la obra (almacenero): primero se elige la obra; el stock se ve en `obras/[id]/stock`
// (004, criterio 9).
export default function Stock() {
  return (
    <ObrasAsignadas
      icono="package-variant-closed"
      titulo="Elige la obra"
      onElegir={(obra) => router.push(rutaDeObra('obras/[id]/stock', obra.id))}
    />
  );
}
