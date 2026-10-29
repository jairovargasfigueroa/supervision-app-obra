import { Redirect } from 'expo-router';

import { tieneAccesoApp } from '../sesion/roles';
import { useSesion } from '../sesion/sesion';

// Entrada de la app: sin sesión, al inicio de sesión; con sesión, a «Mis obras» o, sin un rol de
// la app, a «No tienes acceso».
export default function Inicio() {
  const { sesion } = useSesion();
  if (sesion.estado !== 'activa') {
    return <Redirect href="/iniciar-sesion" />;
  }
  return <Redirect href={tieneAccesoApp(sesion.usuario.roles) ? '/obras' : '/sin-acceso'} />;
}
