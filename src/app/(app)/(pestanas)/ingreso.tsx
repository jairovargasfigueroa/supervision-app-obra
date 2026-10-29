import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../componentes/ObrasAsignadas';
import { rutaDeObra } from '../../../sesion/roles';

// Ingreso de material (almacenero): primero se elige la obra; el ingreso se registra en
// `obras/[id]/ingreso` (004, criterios 1 y 2).
export default function Ingreso() {
  return (
    <ObrasAsignadas
      icono="tray-arrow-down"
      titulo="Elige la obra"
      onElegir={(obra) => router.push(rutaDeObra('obras/[id]/ingreso', obra.id))}
    />
  );
}
