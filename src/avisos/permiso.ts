// Permiso para mostrar notificaciones (010, criterio 7). En Android 13 (API 33) o posterior se pide
// `POST_NOTIFICATIONS` con PermissionsAndroid de React Native (lo que indica la documentación de React
// Native Firebase); antes de Android 13 no hace falta pedirlo. Los avisos son solo para Android.
import { PermissionsAndroid, Platform } from 'react-native';

export type Plataforma = { os: string; version: number | string };

const plataformaActual = (): Plataforma => ({ os: Platform.OS, version: Platform.Version });

const PERMISO = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

function pidePermiso(plataforma: Plataforma): boolean {
  return Number(plataforma.version) >= 33;
}

/** Si la app puede mostrar notificaciones (sin preguntar al usuario). */
export async function permisoConcedido(plataforma: Plataforma = plataformaActual()): Promise<boolean> {
  if (plataforma.os !== 'android') {
    return false;
  }
  if (!pidePermiso(plataforma)) {
    return true;
  }
  try {
    return await PermissionsAndroid.check(PERMISO);
  } catch {
    return false;
  }
}

/** Muestra el diálogo del sistema (Android 13+) y dice si lo concedió. */
export async function pedirPermiso(plataforma: Plataforma = plataformaActual()): Promise<boolean> {
  if (plataforma.os !== 'android') {
    return false;
  }
  if (!pidePermiso(plataforma)) {
    return true;
  }
  try {
    return (await PermissionsAndroid.request(PERMISO)) === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
