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

## APK para la nube (602)

Para usar la app contra la plataforma desplegada en la nube (Keycloak en Azure, Sincronización en AWS), sin Metro ni la computadora: un APK de *release* con las direcciones de la nube dentro, firmado con la misma clave de depuración de la plantilla de Expo que la *development build* (se instala encima, sin desinstalar).

```powershell
./scripts/apk-nube.ps1 -Instalar                                    # compila y lo instala en el celular conectado
./scripts/apk-nube.ps1 -Limpiar -GoogleServices C:/ruta/google-services.json -Instalar   # con avisos push (010)
```

- Las direcciones por defecto son `https://keycloak.supervision.workflow-tramites.site` y `https://sincronizacion.supervision.workflow-tramites.site` (`-Keycloak` y `-Sincronizacion` para otras). Se escriben en la app al compilar (`EXPO_PUBLIC_KEYCLOAK_URL` y `EXPO_PUBLIC_SINCRONIZACION_URL`, 601).
- `-Limpiar` regenera `android/` (hace falta la primera vez con Firebase o si cambia una dependencia nativa) y el *script* vuelve a crear `android/local.properties` con CMake 3.31.6.
- Queda en `dist/app-obra-nube.apk` (fuera del repo). Para otro celular, se pasa el archivo y se instala permitiendo «orígenes desconocidos». Con los requisitos de compilación de la sección anterior.
- Para volver a desarrollo (Metro y `localhost`), se instala otra vez la *development build* (`npx expo run:android --port 8090`).

## Avisos push (010: stock bajo y diario pendiente)

Los avisos llegan por Firebase Cloud Messaging y solo funcionan en la *development build* compilada con el `google-services.json` del proyecto de Firebase. Ese archivo **no va en el repo** (está en `.gitignore`): se guarda fuera de la carpeta y se indica su ruta en la variable `GOOGLE_SERVICES_JSON` al generar `android/`. Sin la variable, la app compila y funciona igual, sin avisos.

1. En la consola de Firebase, en el proyecto de la plataforma, agregar una app Android con el paquete `com.supervision.appobra` y descargar `google-services.json` (por ejemplo a `C:/Users/<usuario>/firebase/google-services.json`).
2. Regenerar `android/` con el archivo (desinstalar antes del celular la *development build* anterior, que no tiene Firebase):

   ```powershell
   $env:GOOGLE_SERVICES_JSON = "C:/Users/<usuario>/firebase/google-services.json"
   npx expo prebuild --platform android --clean
   ```

   (`--clean` borra `android/`: volver a crear `android/local.properties` del paso 2 de arriba.) Se comprueba antes con `npx expo config --type prebuild`: debe mostrar `googleServicesFile` y los *plugins* `@react-native-firebase/app` y `@react-native-firebase/messaging`.
3. Compilar e instalar: `npx expo run:android --port 8090` (como arriba).
4. Al entrar con señal la app pide permiso para las notificaciones (Android 13 o posterior) y se suscribe a los temas de sus obras (`obra-{obraId}-almacenero` u `obra-{obraId}-maestro`). Los avisos los envía n8n (`infra`); la prueba manual está en la última tarea de `docs/specs/010-notificaciones/tareas.md`.
