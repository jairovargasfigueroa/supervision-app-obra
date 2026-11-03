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

/**
 * Resultado de pedir el permiso: `concedido` o `negado` si el usuario respondió (o no hacía falta
 * preguntar); `no-se-pudo` si el diálogo no llegó a mostrarse (p. ej. sin actividad en primer plano),
 * y entonces se vuelve a intentar más adelante.
 */
export type ResultadoPermiso = 'concedido' | 'negado' | 'no-se-pudo';

/** Muestra el diálogo del sistema (Android 13+) y dice qué respondió el usuario. */
export async function pedirPermiso(plataforma: Plataforma = plataformaActual()): Promise<ResultadoPermiso> {
  if (plataforma.os !== 'android') {
    return 'negado';
  }
  if (!pidePermiso(plataforma)) {
    return 'concedido';
  }
  try {
    const respuesta = await PermissionsAndroid.request(PERMISO);
    if (respuesta === PermissionsAndroid.RESULTS.GRANTED) {
      return 'concedido';
    }
    if (
      respuesta === PermissionsAndroid.RESULTS.DENIED ||
      respuesta === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) {
      return 'negado';
    }
    return 'no-se-pudo';
  } catch {
    return 'no-se-pudo';
  }
}
