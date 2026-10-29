# App de obra: estructura y librerías

Obligatorio para todo el código de este proyecto. Instala todo con `npx expo install <paquete>`.

## Librerías

Expo SDK 58, `expo-router`, `react-native-paper` 5 + `react-native-safe-area-context` + `@expo/vector-icons` (MaterialCommunityIcons), `expo-font` + `expo-asset` (lo pide `expo-font`) + `@expo-google-fonts/inter`, `@tanstack/react-query` 5, `@tanstack/react-form` 1 + `zod` 4, `expo-auth-session`, `expo-secure-store`, `expo-crypto`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite` (capa 1). Expo Router necesita además `expo-linking`, `expo-constants`, `react-native-screens`, `expo-web-browser` (lo usa `expo-auth-session`) y `react-dom` (dependencia de `@expo/metro-runtime`; fijada en `19.3.0`, la del SDK, porque si npm la elige sola toma una que pide otro React y `npm install` falla con `ERESOLVE`). Pruebas: `jest-expo` + `@testing-library/react-native` 14.

## Tema

`src/tema.ts`: `MD3LightTheme` de Paper extendido con los colores de `docs/diseno-visual.md` (primario `#0E4D5C`, secundario `#F08A24`, éxito `#1B7343`, atención `#9A4A00`, error `#B42318`, fondo `#F2F5F6`), `roundness` de 1,2 (botones de 6 px) y las constantes `radios.tarjeta` (10) y `radios.control` (6) para tarjetas, diálogos y campos, porque Paper deriva todos los radios de un solo valor. Inter con `expo-font`.

- Inter se carga en `src/app/_layout.tsx` con `useFonts(fuentesInter)`: una sola familia `Inter` con las caras 400, 500 y 600, que se eligen con `fontWeight` (se importan por subruta, `@expo-google-fonts/inter/400Regular`, para no empaquetar las 18 caras). Títulos (`headline*`, `titleLarge`) en 600.
- Si Inter no carga se usa `temaSistema` (mismos colores, fuente del sistema).
- Los tokens sin equivalente en MD3 (`exito`, `atencion`, `errorSuave`, `borde`, `textoSecundario`…) van en `colors` y se leen con `useTema()`.
- `nucleo/formato.ts` no usa `Intl`: arma los separadores de es-BO a mano y calcula la hora de La Paz con su desfase fijo (UTC−4, sin horario de verano), porque Hermes toma separadores y zonas del sistema del celular y no daría siempre lo mismo que las pruebas en Node.

## Árbol

```
src/
  app/                               # pantallas (Expo Router)
    _layout.tsx                      # PaperProvider + QueryClientProvider + SesionProvider; Stack.Protected por sesión
    index.tsx                        # entrada: redirige según la sesión
    (auth)/iniciar-sesion.tsx
    (auth)/sin-acceso.tsx            # sin maestro ni almacenero (criterio 3)
    (app)/_layout.tsx                # pestañas según rol (Tabs.Protected) y barra con nombre y rol
    (app)/obras/index.tsx            # pestaña Mis obras (maestro y almacenero)
    (app)/foto.tsx                   # pestaña Foto de avance (maestro)
    (app)/ingreso.tsx                # pestaña Ingreso (almacenero)
    (app)/salida.tsx                 # pestaña Salida (almacenero)
    (app)/stock.tsx                  # pestaña Stock (almacenero)
    (app)/obras/[id]/foto.tsx        # maestro
    (app)/obras/[id]/ingreso.tsx     # almacenero
    (app)/obras/[id]/salida.tsx      # almacenero
    (app)/obras/[id]/stock.tsx       # almacenero
  sesion/          sesion.tsx (contexto: SesionProvider, useSesion), keycloak.ts (expo-auth-session),
                   tokens.ts (secure-store), token.ts (lee el JWT), renovacion.ts (cuándo renovar),
                   roles.ts (roles efectivos, pestañas por rol, nombre del rol)
  api/             cliente.ts (fetch con token, reintentos 1-2-4 s), obras.ts, materiales.ts (funciones + queryOptions)
  formularios/     movimiento.esquema.ts, foto.esquema.ts (Zod)
  componentes/     BarraSuperior.tsx, PantallaVacia.tsx, EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx,
                   SelectorMaterial.tsx, SelectorPartida.tsx
  sync/            (capa 1) cola.ts, base-local.ts
  nucleo/          formato.ts, uuid.ts, configuracion.ts (lee extra de app.json, validado con Zod)
  pruebas/         ayudas de prueba: jwt.ts (tokens falsos), secure-store-simulado.ts
  tema.ts
```

## Sesión (001)

- `keycloak.ts`: descubrimiento del realm (`emisor` de `configuracion.ts`), `AuthRequest` con PKCE `S256` y alcances `openid profile`, canje del código (`exchangeCodeAsync` con `code_verifier`) y renovación (`refreshAsync`). El `redirectUri` es `makeRedirectUri({ scheme: 'appobra', path: 'iniciar-sesion' })`: `exp://localhost:8090/--/iniciar-sesion` en Expo Go y `appobra://iniciar-sesion` en un *development build*. Lleva ruta porque Keycloak rechaza `appobra://` sola (URI sin autoridad, `400`).
- `tokens.ts`: token de acceso, refresh token y vencimiento en `expo-secure-store`, cada uno en su clave.
- `sesion.tsx`: al abrir la app lee los tokens guardados y los renueva si vencieron; renueva solo un minuto antes de que venza el token de acceso (dura 5 minutos) y `obtenerToken()` lo renueva si hace falta (una sola renovación a la vez). Si Keycloak rechaza la renovación (error OAuth, p. ej. `invalid_grant`), borra los tokens y vuelve al inicio de sesión con «Tu sesión terminó. Vuelve a iniciar sesión.»; si falla la red, conserva la sesión y reintenta a los 30 s.
- Al abrir la app sin sesión, el inicio de sesión de Keycloak se abre solo una vez (criterio 1); después de cerrar sesión o de una sesión vencida se espera a que el usuario pulse «Iniciar sesión».
- Roles (`roles.ts`): en la app solo cuentan `maestro` y `almacenero` del token (`realm_access.roles`, `azp = app-obra`); los demás se ignoran. Pestañas: `maestro` → Mis obras, Foto de avance; `almacenero` → Mis obras, Ingreso, Salida, Stock; con los dos, la unión sin repetir Mis obras. La barra superior muestra el `name` del token y «Maestro de obra», «Almacenero» o los dos.
- Las pestañas Foto de avance, Ingreso, Salida y Stock muestran por ahora el estado vacío («Aún no hay obras asignadas.»). Las pantallas reales son `obras/[id]/…` (004 y 005): cada una decide ahí cómo se elige la obra desde su pestaña.
- `src/app/_layout.tsx` usa `Stack.Protected`: sin sesión solo existe `(auth)/iniciar-sesion`; con sesión y rol de la app, `(app)`; con sesión sin rol de la app, `(auth)/sin-acceso`. `(app)/_layout.tsx` usa `Tabs.Protected` para que un rol no llegue a las pestañas de otro.

## Reglas

- Componentes de Paper (`Button`, `TextInput`, `Card`, `List`, `Chip`, `Snackbar`, `Dialog`); nada de estilos sueltos si Paper lo resuelve.
- Formularios con TanStack Form + Zod; el UUID del registro se crea al abrir el formulario.
- Datos del servidor con TanStack Query; las escrituras con `useMutation` y reintentos del cliente.
- Pantallas en `src/app/` sin lógica pesada: la lógica va en `api/`, `formularios/` o `sync/`.

## Pruebas

`jest-expo` + Testing Library: cliente REST (reintentos), esquemas Zod, componentes principales. `npm test`, `npx tsc --noEmit` y `npx expo-doctor` antes de cada commit.

- Las pruebas van junto al archivo que prueban (`formato.test.ts`, `estados.test.tsx`).
- Las rutas (`src/app/`) se prueban desde fuera de esa carpeta, en `src/rutas.test.tsx`, con `renderRouter('src/app')` de `expo-router/testing-library`: todo archivo dentro de `src/app/` es una pantalla, así que ahí no van pruebas.
- `testTimeout` de Jest en 60 s (`package.json`): la primera prueba que monta Expo Router tarda en cargar los módulos.
- `jest.setup.ts` (en `setupFilesAfterEnv`) simula `expo-secure-store` en memoria (`src/pruebas/secure-store-simulado.ts`, se vacía antes de cada prueba) y `expo-font` (fuentes e íconos dados por cargados), porque en Jest no hay archivos de fuentes reales.
- Compilación sin celular: `npx expo export --platform android`.
