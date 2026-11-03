// Configuración de Expo: toma `app.json` y, solo si hay `google-services.json` de Firebase (010),
// le agrega los avisos push. El archivo no se versiona: su ruta llega en la variable
// GOOGLE_SERVICES_JSON al compilar la development build (`npx expo prebuild`). Sin el archivo, la app
// compila y funciona igual, sin avisos.
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

/** @param {import('expo/config').ConfigContext} contexto @returns {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
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
