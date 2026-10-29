# App de obra: estructura y librerías

Obligatorio para todo el código de este proyecto. Instala todo con `npx expo install <paquete>`.

## Librerías

Expo SDK 58, `expo-router`, `react-native-paper` 5 + `react-native-safe-area-context` + `@expo/vector-icons` (MaterialCommunityIcons), `expo-font` + `expo-asset` (lo pide `expo-font`) + `@expo-google-fonts/inter`, `@tanstack/react-query` 5, `@tanstack/react-form` 1 + `zod` 4, `expo-auth-session`, `expo-secure-store`, `expo-crypto`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite` (capa 1). Pruebas: `jest-expo` + `@testing-library/react-native` 14.

## Tema

`src/tema.ts`: `MD3LightTheme` de Paper extendido con los colores de `docs/diseno-visual.md` (primario `#0E4D5C`, secundario `#F08A24`, éxito `#1B7343`, atención `#9A4A00`, error `#B42318`, fondo `#F2F5F6`), `roundness: 2`. Inter con `expo-font`.

- Inter se carga en `App.tsx` (en la 001, en `src/app/_layout.tsx`) con `useFonts(fuentesInter)`: una sola familia `Inter` con las caras 400, 500 y 600, que se eligen con `fontWeight` (se importan por subruta, `@expo-google-fonts/inter/400Regular`, para no empaquetar las 18 caras). Títulos (`headline*`, `titleLarge`) en 600.
- Si Inter no carga se usa `temaSistema` (mismos colores, fuente del sistema).
- Los tokens sin equivalente en MD3 (`exito`, `atencion`, `errorSuave`, `borde`, `textoSecundario`…) van en `colors` y se leen con `useTema()`.
- `nucleo/formato.ts` no usa `Intl`: arma los separadores de es-BO a mano y calcula la hora de La Paz con su desfase fijo (UTC−4, sin horario de verano), porque Hermes toma separadores y zonas del sistema del celular y no daría siempre lo mismo que las pruebas en Node.

## Árbol (al migrar a Expo Router en la 001)

```
src/
  app/                               # pantallas (Expo Router)
    _layout.tsx                      # PaperProvider + QueryClientProvider + SesionProvider
    (auth)/iniciar-sesion.tsx
    (auth)/sin-acceso.tsx
    (app)/_layout.tsx                # pestañas según rol
    (app)/obras/index.tsx            # Mis obras
    (app)/obras/[id]/foto.tsx        # maestro
    (app)/obras/[id]/ingreso.tsx     # almacenero
    (app)/obras/[id]/salida.tsx      # almacenero
    (app)/obras/[id]/stock.tsx       # almacenero
  sesion/          sesion.tsx (contexto), keycloak.ts (expo-auth-session), tokens.ts (secure-store)
  api/             cliente.ts (fetch con token, reintentos 1-2-4 s), obras.ts, materiales.ts (funciones + queryOptions)
  formularios/     movimiento.esquema.ts, foto.esquema.ts (Zod)
  componentes/     EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx, SelectorMaterial.tsx, SelectorPartida.tsx
  sync/            (capa 1) cola.ts, base-local.ts
  nucleo/          formato.ts, uuid.ts, configuracion.ts (lee extra de app.json, validado con Zod)
  tema.ts
```

## Reglas

- Componentes de Paper (`Button`, `TextInput`, `Card`, `List`, `Chip`, `Snackbar`, `Dialog`); nada de estilos sueltos si Paper lo resuelve.
- Formularios con TanStack Form + Zod; el UUID del registro se crea al abrir el formulario.
- Datos del servidor con TanStack Query; las escrituras con `useMutation` y reintentos del cliente.
- Pantallas en `src/app/` sin lógica pesada: la lógica va en `api/`, `formularios/` o `sync/`.

## Pruebas

`jest-expo` + Testing Library: cliente REST (reintentos), esquemas Zod, componentes principales. `npm test`, `npx tsc --noEmit` y `npx expo-doctor` antes de cada commit.

- Las pruebas van junto al archivo que prueban (`formato.test.ts`, `estados.test.tsx`).
- `jest.setup.ts` simula `expo-font` (fuentes e íconos dados por cargados), porque en Jest no hay archivos de fuentes reales.
- Compilación sin celular: `npx expo export --platform android`.
