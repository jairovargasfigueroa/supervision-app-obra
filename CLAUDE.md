# App de obra

Aplicación móvil para la obra: el maestro de obra registra fotos de avance; el almacenero registra ingresos y salidas de material. El menú cambia según el rol.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** 001 hecha en la app: Expo Router (`src/app/`), inicio de sesión con Keycloak, renovación y cierre de sesión (`src/sesion/`), pestañas según el rol con su estado vacío y «No tienes acceso». Tema de Paper con Inter (`src/tema.ts`), formatos (`src/nucleo/formato.ts`) y estados vacío y error (`src/componentes/`). 005 hecha en la app: «Mis obras» (obras asignadas), pantalla Foto de avance (`obras/[id]/foto`: partida, cámara o galería, compresión, envío con URL firmada y reintento) y cliente REST hacia Obras (`src/api/`). 004 hecha en la app: botones Ingreso, Salida y Stock en «Mis obras» y pestañas que piden elegir la obra; pantallas `obras/[id]/ingreso` y `obras/[id]/salida` (TanStack Form + Zod, UUID por registro, avisos de stock superado y periodo cerrado; desde la 101 con los datos del paquete local y el registro por la cola) y `obras/[id]/stock` (estados con los colores del ERP); cliente REST hacia Materiales (`src/api/materiales.ts`). 301 hecha en la app (salvo la prueba manual en el celular): análisis de casco y chaleco en el celular con dos modelos TensorFlow Lite (`src/avance/epp/`, modelos en `assets/modelos/`), resumen, aviso y recuadros en la foto de avance, pantalla `obras/[id]/control-seguridad` y `deteccion` en `datos` de `FOTO_AVANCE`; necesita la *development build*. 010 hecha en la app (salvo la prueba manual en el celular): avisos *push* de Firebase Cloud Messaging (`src/avisos/`, `@react-native-firebase/app` y `messaging` 26.4.0): suscripción a los temas `obra-{id}-maestro` y `obra-{id}-almacenero` de las obras del paquete, baja al cerrar sesión, el aviso abre el stock o el diario y, con la app abierta, `Snackbar` con «Ver»; `google-services.json` fuera del repo (`GOOGLE_SERVICES_JSON` en `app.config.js`); solo en la *development build*. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

Lee también `AGENTS.md`: es la guía oficial de Expo para agentes (consultar la documentación de la versión instalada, usar `npx expo install`, development builds).

## Stack

- Node 24 · Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6
- Expo Router (`main: expo-router/entry`, rutas en `src/app/`, grupos `(auth)` y `(app)`); login OIDC con Keycloak mediante `expo-auth-session` (cliente `app-obra`, roles `maestro` y `almacenero`)
- Capa 1: base local y cola de envíos con `expo-sqlite` (módulo oficial de Expo) · Capa 3: TensorFlow Lite con `react-native-fast-tflite` (requiere *development build*, no funciona en Expo Go) · 010: avisos *push* con `@react-native-firebase/messaging` (*development build* con `google-services.json`)

## Comandos

```sh
npm install
npm start                  # Metro en el puerto 8090 (expo start --localhost --port 8090); abrir con Expo Go
npx expo install <paquete> # SIEMPRE así para agregar dependencias (elige la versión compatible con el SDK)
npm test                   # pruebas (jest-expo + Testing Library)
npx tsc --noEmit           # revisar tipos
npx expo-doctor            # revisar dependencias y configuración
npx expo export --platform android --output-dir <carpeta temporal fuera del repo>  # compilar sin celular
```

*Development build* de Android (necesaria desde la 301 por TensorFlow Lite; no funciona en Expo Go): `npx expo prebuild --platform android` y `npx expo run:android --port 8090` con el celular conectado. En Windows hace falta CMake 3.31.6 en `android/local.properties` (rutas largas). Pasos en el `README.md`.

### Celular en desarrollo (Android)

- `app.json` → `extra` apunta a `localhost`: `keycloakUrl` `http://localhost:8080` (realm `supervision`, cliente `app-obra`), `obrasUrl` `http://localhost:8081`, `materialesUrl` `http://localhost:8082`. **No se cambia por la IP de la computadora:** el emisor (`iss`) del token tiene que ser `http://localhost:8080/realms/supervision`, el mismo que validan los servicios; si el celular entrara por la IP, el token saldría con otro emisor y los servicios lo rechazarían.
- El celular llega a esos puertos de la computadora con `adb reverse` (cable USB o depuración inalámbrica), con `infra/scripts/celular.ps1` (o `.sh`), que hace `adb reverse` de 8080, 8081, 8082 y 8090. Metro usa el **8090** (el 8081 es de Obras) y arranca con `--localhost`, así Expo Go también carga el código por `adb reverse`.
- Orden: levantar `infra` y los servicios, ejecutar `infra/scripts/celular.ps1`, `npm start` y abrir en Expo Go la dirección `exp://` que muestra Metro (puerto 8090).
- El esquema propio es `appobra` (`app.json` → `scheme`). En Expo Go la vuelta del inicio de sesión llega por `exp://…`; en un *development build*, por `appobra://…`. El realm acepta los dos (`exp://*` y `appobra://*`).

### Direcciones al compilar (601)

- `EXPO_PUBLIC_KEYCLOAK_URL` y `EXPO_PUBLIC_SINCRONIZACION_URL` (en la terminal o en `.env`, copia de `.env.example`) reemplazan en `app.config.js` las de `app.json` → `extra`; sin ellas, las de desarrollo (`localhost`). CI en `.github/workflows/ci.yml` (tipos y pruebas). 602: `scripts/apk-nube.ps1` compila el APK de release con las direcciones de la nube (y `-Instalar` lo instala por cable); README, «APK para la nube».

## Estructura

La exacta está en `docs/estructura.md`. En resumen:

```
src/
  app/                pantallas (Expo Router): solo rutas; nada de pruebas ni lógica aquí
  sesion/             sesión con Keycloak
  api/, formularios/  cliente REST y formularios (004, 005)
  componentes/, nucleo/, tema.ts
  sync/               cola local y envío (capa 1)
```

## Reglas del proyecto

- Usa REST (no GraphQL).
- Cada registro lleva un id (UUID) generado en el celular antes de enviarlo.
- Sistema base: llama directo a Obras y Materiales. Capa 1: todo pasa por el servicio de Sincronización.
- Las fotos se comprimen antes de enviarse.
- No se crean ni editan a mano las carpetas `android/` e `ios/` (las genera Expo).

## Documentación

- `docs/estructura.md`: **librerías permitidas y estructura exacta de carpetas y archivos. Obligatorio leerlo antes de escribir código.**
- `docs/app.md`: pantallas y qué no hace.
- `docs/contratos.md`: qué consume.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(avance): agrega captura de foto`). Sin coautoría ni firmas de la IA.

Git Flow: ramas `feat/`, `fix/`, `docs/`… desde `develop`, que entran por *pull request*; nunca hagas *push* a `main` ni a `develop` (están protegidas). El agente crea y fusiona los PR (merge normal, sin squash) hacia `develop` cuando todas las pruebas pasan. Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
