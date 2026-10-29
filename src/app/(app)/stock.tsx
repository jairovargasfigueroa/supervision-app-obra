import { PantallaVacia } from '../../componentes/PantallaVacia';

// Stock de la obra (almacenero): la pantalla real llega con la 004 (`obras/[id]/stock`); sin obras, el estado vacío.
export default function Stock() {
  return <PantallaVacia icono="package-variant-closed" />;
}
