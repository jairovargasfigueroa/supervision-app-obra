import { router } from 'expo-router';

import { ObrasAsignadas } from '../../../componentes/ObrasAsignadas';

// Foto de avance (maestro): primero se elige la obra; la foto se toma en `obras/[id]/foto` (005).
export default function FotoDeAvance() {
  return (
    <ObrasAsignadas
      icono="camera-outline"
      titulo="Elige la obra"
      onElegir={(obra) => router.push(`/obras/${obra.id}/foto`)}
    />
  );
}
