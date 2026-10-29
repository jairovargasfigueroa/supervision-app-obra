import { Redirect } from 'expo-router';

// Entrada de la app (también la dirección a la que vuelve el inicio de sesión).
export default function Inicio() {
  return <Redirect href="/iniciar-sesion" />;
}
