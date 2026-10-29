import { useLocalSearchParams } from 'expo-router';

import { ConObra } from '../../../../componentes/ConObra';
import { FormularioMovimiento } from '../../../../componentes/FormularioMovimiento';

// Ingreso de material (004, criterio 2): material, cantidad y nota de remisión opcional.
// Con `key`, el formulario (y su UUID) empieza de cero en cada obra.
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObra key={id} id={id}>
      {(obra) => <FormularioMovimiento tipo="INGRESO" obra={obra} />}
    </ConObra>
  );
}
