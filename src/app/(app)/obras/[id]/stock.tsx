import { useLocalSearchParams } from 'expo-router';

import { ConObraLocal } from '../../../../componentes/ConObraLocal';
import { StockObra } from '../../../../componentes/StockObra';

// Stock de la obra (004, criterio 9): cada material con su estado y los colores del ERP. Desde la 101,
// del paquete guardado en el celular más los movimientos sin enviar.
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObraLocal key={id} id={id}>
      {(obra, paquete) => <StockObra obra={obra} paquete={paquete} />}
    </ConObraLocal>
  );
}
