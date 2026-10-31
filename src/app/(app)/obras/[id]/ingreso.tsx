import { useLocalSearchParams } from 'expo-router';

import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { FormularioMovimiento } from '../../../../componentes/FormularioMovimiento';

// Ingreso de material (004, criterio 2): material, cantidad y nota de remisión opcional.
// Con `key`, el formulario (y su UUID) empieza de cero en cada obra. Los datos salen del paquete
// guardado en el celular y el registro pasa por la cola (101).
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra, paquete) => <FormularioMovimiento tipo="INGRESO" obra={obra} datos={paquete.contenido} />}
    </ConObraLocal>
  );
}
