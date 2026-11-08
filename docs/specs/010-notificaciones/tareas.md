# 010 · Avisos al celular y al cliente · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/010-notificaciones/` de la carpeta que agrupa los proyectos (repo `supervision-docs`). Estas tareas reemplazan a las de la versión anterior (bandeja, `expo-notifications` y `services/notificaciones`). Contratos: `docs/contratos.md` de este proyecto.

Los avisos *push* solo funcionan en una *development build* de Android (no en Expo Go), como la 301.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Verificar `@react-native-firebase/app` y `messaging` con Expo SDK 58 (versiones, *config plugins*, temas); si no son compatibles, detenerse y proponer la alternativa del diseño
- [x] Aplicar «Cambios a contratos y datos» que tocan este proyecto (`docs/app.md`, `docs/contratos.md`); `google-services.json` fuera del repo y tomado de `GOOGLE_SERVICES_JSON`
- [x] `src/avisos/temas.ts` y `rutaDeAviso.ts` (funciones puras) con sus pruebas
- [x] `src/avisos/push.ts`: permiso, suscripción a los temas al cargar el paquete de datos, desuscripción al cerrar sesión; pruebas con `messaging` simulado
- [x] Abrir la pantalla al tocar el aviso y `Snackbar` con la app abierta; pruebas
- [ ] Prueba manual en un Android con la *development build* (Jairo)

## Verificación de compatibilidad (02/11/2026)

- **Versiones:** `@react-native-firebase/app` y `@react-native-firebase/messaging` **26.4.0** (publicadas el 05/09/2026), fijas y sin `^` (las dos tienen que ir en la misma versión: `messaging` declara `@react-native-firebase/app` `26.4.0` como dependencia par). Instaladas con `npx expo install …@26.4.0 -- --save-exact`. No se usó la 27: la 27.1.0 y la 26.4.1 tienen menos de dos semanas (23/10/2026) y la 27.0.0 (19/10/2026) usa el BoM 35 de Firebase para Android, que pide el *plugin* de Kotlin ≥ 2.4.0 (`docs/platforms.mdx` y `docs/migrating-to-v27.mdx` del repo de React Native Firebase), mientras que Expo SDK 58 y React Native 0.88 compilan con Kotlin 2.2.0 (`expo-modules-autolinking`, `KotlinVersions.kt`; `@react-native/gradle-plugin`, `libs.versions.toml`).
- **Requisitos de la 26.4.0** (`docs/platforms.mdx` en la etiqueta `v26.4.0`, `packages/app/package.json` → `sdkVersions`): Android 6.0 (API 23) o posterior (la app ya pide 24), JDK 17 o posterior, BoM de Firebase Android 34.18.0. Desde la 26 todos los módulos con código nativo son TurboModules y **exigen la nueva arquitectura** (`docs/migrating-to-v26.mdx`), que es la única de React Native 0.88. Dependencias pares: `expo >= 47`, `react-native *`.
- **Expo:** «Integration with Expo is possible when using a development build» y no funciona en Expo Go (https://rnfirebase.io, sección «Installation for Expo projects»; https://docs.expo.dev/guides/using-firebase/). Se configura con los *config plugins* de cada paquete (`app.plugin.js` en `@react-native-firebase/app` y en `@react-native-firebase/messaging`) y `expo.android.googleServicesFile`. El de `app` agrega el *plugin* `google-services` de Gradle y copia el `google-services.json`; el de `messaging`, la configuración de la notificación de Android.
- **Temas:** `subscribeToTopic(messaging, tema)` y `unsubscribeFromTopic(messaging, tema)` de la API modular (https://rnfirebase.io/messaging/usage, «Topics»; `dist/typescript/lib/index.d.ts` de la 26.4.0). El nombre del tema no lleva `/`; hasta 2000 temas por instalación.
- **Permiso en Android 13+:** `requestPermission` de `messaging` está en desuso y no pide nada en Android; la documentación indica pedir `POST_NOTIFICATIONS` con `PermissionsAndroid` de React Native.
- **Abrir la pantalla:** `getInitialNotification` (app cerrada) y `onNotificationOpenedApp` (en segundo plano); con la app abierta, `onMessage` (Android no muestra la notificación).
