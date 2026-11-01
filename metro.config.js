// Configuración de Metro: la de Expo más los modelos de TensorFlow Lite (301), que se empaquetan
// como archivos de la app (`assets/modelos/*.tflite`) y se cargan con `require(...)`.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');

module.exports = config;
