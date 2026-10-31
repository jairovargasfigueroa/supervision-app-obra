import { useLocalSearchParams } from 'expo-router';

import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { FormularioMovimiento } from '../../../../componentes/FormularioMovimiento';

// Salida de material (004, criterio 3): material, cantidad y partida de destino.
// Con `key`, el formulario (y su UUID) empieza de cero en cada obra. Los datos salen del paquete
// guardado en el celular y el registro pasa por la cola (101).
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra, paquete) => <FormularioMovimiento tipo="SALIDA" obra={obra} datos={paquete.contenido} />}
    </ConObraLocal>
  );
}
