# App de obra

Aplicación móvil para la obra: el maestro de obra registra fotos de avance; el almacenero registra ingresos y salidas de material. El menú cambia según el rol.

Expo SDK 58 · React Native 0.88.

Documentación en [`docs/`](docs/) e instrucciones para el agente en [`CLAUDE.md`](CLAUDE.md).

## Development build de Android (301: casco y chaleco)

El análisis de casco y chaleco usa TensorFlow Lite (`react-native-fast-tflite`), que tiene código nativo y **no funciona en Expo Go**. Para probarlo hace falta instalar en el celular una *development build* (un APK de depuración de esta app que carga el código JavaScript desde Metro, igual que Expo Go). Se compila una vez y se vuelve a compilar solo si cambian las dependencias nativas o `app.json`.

Requisitos en la computadora: Node 24, JDK 17 o 21, Android SDK con la plataforma 37, el NDK 27.1.12297006 y **CMake 3.31.6** (Android Studio → SDK Manager → SDK Tools → CMake). En el celular: depuración USB activada.

1. Generar la carpeta `android/` (no se versiona; se regenera desde `app.json`):

   ```sh
   npx expo prebuild --platform android
   ```

2. **Solo en Windows:** las rutas de compilación de C++ de `react-native-nitro-modules` pasan los 260 caracteres y el `ninja` del CMake 3.22 que usa Android por defecto falla con `ninja: error: mkdir(...): No such file or directory`. Se usa el CMake 3.31.6 (su `ninja` 1.12 acepta rutas largas) creando `android/local.properties` con:

   ```properties
   sdk.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk
   cmake.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk/cmake/3.31.6
   ```

   (Hay que repetirlo si se borra `android/`, por ejemplo con `npx expo prebuild --clean`.) Con poca memoria libre, en `android/gradle.properties` se puede bajar `org.gradle.jvmargs` a `-Xmx1536m` y agregar `org.gradle.workers.max=2`.

3. Con el celular conectado por USB (`adb devices` lo muestra), compilar, instalar y abrir:

   ```sh
   npx expo run:android --port 8090
   ```

   Compila solo para la arquitectura del celular conectado. La primera vez tarda entre 15 y 30 minutos; las siguientes, un par de minutos.

   Sin celular conectado, el APK se compila con `cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` y queda en `android/app/build/outputs/apk/debug/app-debug.apk`; se instala después con `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

4. Para usarla día a día: levantar `infra` y los servicios, ejecutar `infra/scripts/celular.ps1` (hace `adb reverse` de 8080, 8081, 8082 y 8090), `npm start` y abrir la app **app-obra** instalada (no Expo Go); si no se conecta sola, elegir el servidor `http://localhost:8090` en su pantalla de inicio. La vuelta del inicio de sesión llega por `appobra://iniciar-sesion`.

Los modelos (`assets/modelos/*.tflite` y `epp.json`) van dentro del JavaScript que sirve Metro: si cambian, basta con recargar la app, no hace falta recompilar.
