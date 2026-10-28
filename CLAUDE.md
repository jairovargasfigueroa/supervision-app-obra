# App de obra

Aplicación móvil para la obra: el maestro de obra registra fotos de avance; el almacenero registra ingresos y salidas de material. El menú cambia según el rol.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** proyecto generado con la plantilla `blank-typescript` de Expo, sin pantallas. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

Lee también `AGENTS.md`: es la guía oficial de Expo para agentes (consultar la documentación de la versión instalada, usar `npx expo install`, development builds).

## Stack

- Node 24 · Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6
- Previsto: Expo Router (navegación por rol), login OIDC con Keycloak mediante `expo-auth-session` (cliente `app-obra`, roles `maestro` y `almacenero`)
- Capa 1: base local y cola de envíos con `expo-sqlite` (módulo oficial de Expo) · Capa 3: TensorFlow Lite con `react-native-fast-tflite` (requiere *development build*, no funciona en Expo Go)

## Comandos

```sh
npm install
npx expo start             # abrir en el celular con Expo Go (escanear el QR)
npx expo install <paquete> # SIEMPRE así para agregar dependencias (elige la versión compatible con el SDK)
npx tsc --noEmit           # revisar tipos
npx expo-doctor            # revisar dependencias y configuración
```

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

- `docs/app.md`: pantallas y qué no hace.
- `docs/contratos.md`: qué consume.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(avance): agrega captura de foto`). Sin coautoría ni firmas de la IA.
