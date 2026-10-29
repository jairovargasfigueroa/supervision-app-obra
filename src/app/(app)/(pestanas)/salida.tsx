import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../componentes/ObrasAsignadas';
import { rutaDeObra } from '../../../sesion/roles';

// Salida de material (almacenero): primero se elige la obra; la salida se registra en
// `obras/[id]/salida` (004, criterios 1 y 3).
export default function Salida() {
  return (
    <ObrasAsignadas
      icono="tray-arrow-up"
      titulo="Elige la obra"
      onElegir={(obra) => router.push(rutaDeObra('obras/[id]/salida', obra.id))}
    />
  );
}
