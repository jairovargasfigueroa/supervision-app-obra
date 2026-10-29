# App de obra

Aplicación móvil para la obra: el maestro de obra registra fotos de avance; el almacenero registra ingresos y salidas de material. El menú cambia según el rol.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** fase 1. Tema de Paper con Inter (`src/tema.ts`), formatos (`src/nucleo/formato.ts`), estados vacío y error (`src/componentes/`) y una pantalla base en `App.tsx`; sin pantallas de negocio. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

Lee también `AGENTS.md`: es la guía oficial de Expo para agentes (consultar la documentación de la versión instalada, usar `npx expo install`, development builds).

## Stack

- Node 24 · Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6
- Previsto: Expo Router (navegación por rol), login OIDC con Keycloak mediante `expo-auth-session` (cliente `app-obra`, roles `maestro` y `almacenero`)
- Capa 1: base local y cola de envíos con `expo-sqlite` (módulo oficial de Expo) · Capa 3: TensorFlow Lite con `react-native-fast-tflite` (requiere *development build*, no funciona en Expo Go)

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

### Celular en desarrollo (Android)

- `app.json` → `extra` apunta a `localhost`: `keycloakUrl` `http://localhost:8080` (realm `supervision`, cliente `app-obra`), `obrasUrl` `http://localhost:8081`, `materialesUrl` `http://localhost:8082`. **No se cambia por la IP de la computadora:** el emisor (`iss`) del token tiene que ser `http://localhost:8080/realms/supervision`, el mismo que validan los servicios; si el celular entrara por la IP, el token saldría con otro emisor y los servicios lo rechazarían.
- El celular llega a esos puertos de la computadora con `adb reverse` (cable USB o depuración inalámbrica), con el script de `adb reverse` de `infra`. Metro usa el **8090** (el 8081 es de Obras) y arranca con `--localhost`, así Expo Go también carga el código por `adb reverse`.
- Orden: levantar `infra` y los servicios, ejecutar el script de `adb reverse`, `npm start` y abrir en Expo Go la dirección `exp://` que muestra Metro (puerto 8090).
- El esquema propio es `appobra` (`app.json` → `scheme`). En Expo Go la vuelta del inicio de sesión llega por `exp://…`; en un *development build*, por `appobra://…`. El realm acepta los dos (`exp://*` y `appobra://*`).

## Estructura prevista

```
App.tsx / index.ts    entrada actual de la plantilla (se reemplaza al agregar Expo Router)
src/
  app/                pantallas (Expo Router)
  avance/             fotos de avance por partida
  materiales/         ingresos y salidas, stock de la obra
  auth/               sesión con Keycloak
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
