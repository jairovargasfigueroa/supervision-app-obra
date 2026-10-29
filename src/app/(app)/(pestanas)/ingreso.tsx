import { PantallaVacia } from '../../../componentes/PantallaVacia';

// Ingreso de material (almacenero): la pantalla real llega con la 004 (`obras/[id]/ingreso`); sin obras, el estado vacío.
export default function Ingreso() {
  return <PantallaVacia icono="tray-arrow-down" />;
}
