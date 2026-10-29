import { PantallaVacia } from '../../componentes/PantallaVacia';

// Salida de material (almacenero): la pantalla real llega con la 004 (`obras/[id]/salida`); sin obras, el estado vacío.
export default function Salida() {
  return <PantallaVacia icono="tray-arrow-up" />;
}
