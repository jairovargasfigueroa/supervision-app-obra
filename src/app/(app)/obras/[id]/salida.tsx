import { useLocalSearchParams } from 'expo-router';

import { ConObra } from '../../../../componentes/ConObra';
import { FormularioMovimiento } from '../../../../componentes/FormularioMovimiento';

// Salida de material (004, criterio 3): material, cantidad y partida de destino.
// Con `key`, el formulario (y su UUID) empieza de cero en cada obra.
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObra key={id} id={id}>
      {(obra) => <FormularioMovimiento tipo="SALIDA" obra={obra} />}
    </ConObra>
  );
}
