// Configuración de Expo: toma `app.json`, reemplaza las direcciones de Keycloak y de Sincronización si
// llegan por variable al compilar (601) y, solo si hay `google-services.json` de Firebase (010), le agrega
// los avisos push. El archivo no se versiona: su ruta llega en la variable GOOGLE_SERVICES_JSON al
// compilar la development build (`npx expo prebuild`). Sin el archivo, la app compila y funciona igual,
// sin avisos.
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const PERMISO_NOTIFICACIONES = 'android.permission.POST_NOTIFICATIONS';

/** Ruta absoluta del `google-services.json`, o `null` si no se dio o no existe. */
function archivoFirebase() {
  const variable = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (!variable) {
    return null;
  }
  const ruta = resolve(variable);
  if (!existsSync(ruta)) {
    console.warn(`[avisos] GOOGLE_SERVICES_JSON apunta a ${ruta}, que no existe: la app se arma sin avisos.`);
    return null;
  }
  return ruta;
}

/** Variable de `extra` → variable de entorno que la reemplaza al compilar (601). */
const DIRECCIONES = {
  keycloakUrl: 'EXPO_PUBLIC_KEYCLOAK_URL',
  sincronizacionUrl: 'EXPO_PUBLIC_SINCRONIZACION_URL',
};

/**
 * `extra` de `app.json` con las direcciones de las variables que vienen con valor (sin espacios ni `/`
 * final); las que faltan o están vacías quedan con el valor de desarrollo de `app.json`.
 * @param {Record<string, unknown> | undefined} extra
 * @param {Record<string, string | undefined>} entorno
 */
function extraConDirecciones(extra, entorno) {
  const resultado = { ...extra };
  for (const [campo, variable] of Object.entries(DIRECCIONES)) {
    const valor = entorno[variable]?.trim().replace(/\/+$/, '');
    if (valor) {
      resultado[campo] = valor;
    }
  }
  return resultado;
}

/** @param {import('expo/config').ConfigContext} contexto @returns {import('expo/config').ExpoConfig} */
module.exports = ({ config: base }) => {
  const config = { ...base, extra: extraConDirecciones(base.extra, process.env) };
  const googleServicesFile = archivoFirebase();
  if (!googleServicesFile) {
    return config;
  }
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile,
      // Android 13+ pide permiso para mostrar notificaciones.
      permissions: [...(config.android?.permissions ?? []), PERMISO_NOTIFICACIONES],
    },
    plugins: [...(config.plugins ?? []), '@react-native-firebase/app', '@react-native-firebase/messaging'],
  };
};

module.exports.extraConDirecciones = extraConDirecciones;
