import { Redirect } from 'expo-router';

import { useSesion } from '../sesion/sesion';

// Entrada de la app: con sesión va a «Mis obras»; sin sesión, al inicio de sesión.
export default function Inicio() {
  const { sesion } = useSesion();
  return <Redirect href={sesion.estado === 'activa' ? '/obras' : '/iniciar-sesion'} />;
}
