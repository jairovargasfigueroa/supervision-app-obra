import { PendientesEnvio } from '../../../componentes/PendientesEnvio';

// Pendientes de envío (101, criterios 16 y 17; maestro y almacenero): los registros guardados en el
// celular con su estado, «Enviar ahora», «Descartar» y «Actualizar datos».
export default function Pendientes() {
  return <PendientesEnvio />;
}
