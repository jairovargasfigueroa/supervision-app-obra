# 602 · Despliegue en tres nubes · tareas de `app-obra`

Requisitos y diseño: `docs/specs/602-despliegue-tres-nubes/` de la carpeta que agrupa los proyectos («App (APK) y Firebase»).

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] `scripts/apk-nube.ps1`: compila el APK de la nube con `EXPO_PUBLIC_KEYCLOAK_URL`, `EXPO_PUBLIC_SINCRONIZACION_URL` y, si se da, `GOOGLE_SERVICES_JSON` (`npx expo prebuild --clean` y `gradlew assembleRelease`); con `-Instalar`, lo instala por cable (`adb install -r`). Comprobar que el APK queda firmado con la clave de depuración de la plantilla y que se instala sobre la *development build*
  - 09/11/2026: compilado con Firebase (`-Limpiar -GoogleServices`), 47 MB, `BUILD SUCCESSFUL` en 13 min; firmado con la clave de depuración de la plantilla (SHA-1 `5E:8F:16:06…F6:25`, la de la *development build*), `keycloakUrl` y `sincronizacionUrl` de la nube en `assets/app.config` y los recursos de Firebase (`google_app_id`). Corregido: los avisos de `npx`, `gradlew` y `adb` en stderr ya no cortan el *script* cuando su salida va a un archivo (PowerShell 5.1), y el archivo va con BOM como los demás `.ps1` (tildes).
- [x] README: sección «APK para la nube» (qué hace el *script*, dónde queda el archivo y cómo pasarlo a otro celular)
- [ ] Con las tres nubes: iniciar sesión en el APK y registrar sin señal una salida y una foto que llegan una sola vez (paso 6 del «Orden» de la 602)
