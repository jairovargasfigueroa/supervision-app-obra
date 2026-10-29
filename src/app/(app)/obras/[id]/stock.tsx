import { useLocalSearchParams } from 'expo-router';

import { ConObra } from '../../../../componentes/ConObra';
import { StockObra } from '../../../../componentes/StockObra';

// Stock de la obra (004, criterio 9): cada material con su estado y los colores del ERP.
export default function Pantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConObra key={id} id={id}>
      {(obra) => <StockObra obra={obra} />}
    </ConObra>
  );
}
