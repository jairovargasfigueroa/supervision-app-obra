import { PantallaVacia } from '../../componentes/PantallaVacia';

// Foto de avance (maestro): la pantalla real llega con la 005 (`obras/[id]/foto`); sin obras, el estado vacío.
export default function FotoDeAvance() {
  return <PantallaVacia icono="camera-outline" />;
}
