import { useLocalSearchParams } from 'expo-router';

import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { DiarioObra } from '../../../../componentes/DiarioObra';

// Diario de obra (103, maestro): las entradas de los últimos 30 días y la del día, con los datos del
// paquete guardado en el celular y el registro por la cola (funciona sin señal).
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra) => <DiarioObra obra={obra} />}
    </ConObraLocal>
  );
}
