# App de obra: estructura y librerías

Obligatorio para todo el código de este proyecto. Instala todo con `npx expo install <paquete>`.

## Librerías

Expo SDK 58, `expo-router`, `react-native-paper` 5 + `react-native-safe-area-context` + `@expo/vector-icons` (MaterialCommunityIcons), `expo-font` + `expo-asset` (lo pide `expo-font`) + `@expo-google-fonts/inter`, `@tanstack/react-query` 5, `@tanstack/react-form` 1 + `zod` 4, `expo-auth-session`, `expo-secure-store`, `expo-crypto`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite` (capa 1). Expo Router necesita además `expo-linking`, `expo-constants`, `react-native-screens`, `expo-web-browser` (lo usa `expo-auth-session`) y `react-dom` (dependencia de `@expo/metro-runtime`; fijada en `19.3.0`, la del SDK, porque si npm la elige sola toma una que pide otro React y `npm install` falla con `ERESOLVE`). Pruebas: `jest-expo` + `@testing-library/react-native` 14.

`expo-image-picker` se configura con su *config plugin* en `app.json` → `plugins`: textos de permiso de cámara y fotos en español y `microphonePermission: false` (la app no graba video, así Android no pide el micrófono).

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
    (app)/_layout.tsx                # Stack con la barra superior (nombre, rol, «Volver»); pantallas de obra con Stack.Protected por rol
    (app)/(pestanas)/_layout.tsx     # pestañas según rol (Tabs.Protected)
    (app)/(pestanas)/obras/index.tsx # pestaña Mis obras (maestro y almacenero)
    (app)/(pestanas)/foto.tsx        # pestaña Foto de avance (maestro): elige la obra
    (app)/(pestanas)/ingreso.tsx     # pestaña Ingreso (almacenero)
    (app)/(pestanas)/salida.tsx      # pestaña Salida (almacenero)
    (app)/(pestanas)/stock.tsx       # pestaña Stock (almacenero)
    (app)/obras/[id]/foto.tsx        # maestro (005)
    (app)/obras/[id]/ingreso.tsx     # almacenero
    (app)/obras/[id]/salida.tsx      # almacenero
    (app)/obras/[id]/stock.tsx       # almacenero
  sesion/          sesion.tsx (contexto: SesionProvider, useSesion), keycloak.ts (expo-auth-session),
                   tokens.ts (secure-store), token.ts (lee el JWT), renovacion.ts (cuándo renovar),
                   roles.ts (roles efectivos, pestañas y pantallas de obra por rol, nombre del rol)
  api/             red.ts (única llamada a fetch), cliente.ts (token, tiempo máximo, X-Request-Id, errores por
                   codigo; QueryClient con reintentos 1-2-4 s), errores.ts (ErrorApi y textos de docs/mensajes.md),
                   obras.ts, materiales.ts (funciones + queryOptions), subida.ts (lee la foto y hace el PUT a S3)
  formularios/     movimiento.esquema.ts, foto.esquema.ts (Zod), foto.ts (cámara, galería y compresión),
                   foto.envio.ts (envío con reintento y qué hacer tras cada fallo), useFotoAvance.ts (estado de la pantalla)
  componentes/     BarraSuperior.tsx, PantallaVacia.tsx, EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx,
                   ObrasAsignadas.tsx (lista de GET /obras), SelectorMaterial.tsx, SelectorPartida.tsx
  sync/            (capa 1) cola.ts, base-local.ts
  nucleo/          formato.ts, uuid.ts, configuracion.ts (lee extra de app.json, validado con Zod)
  pruebas/         ayudas de prueba: jwt.ts (tokens falsos), secure-store-simulado.ts, fetch-simulado.ts (red),
                   imagen-simulada.ts (cámara, galería y compresión)
  tema.ts
```

## Sesión (001)

- `keycloak.ts`: descubrimiento del realm (`emisor` de `configuracion.ts`), `AuthRequest` con PKCE `S256` y alcances `openid profile`, canje del código (`exchangeCodeAsync` con `code_verifier`) y renovación (`refreshAsync`). El `redirectUri` es `makeRedirectUri({ scheme: 'appobra', path: 'iniciar-sesion' })`: `exp://localhost:8090/--/iniciar-sesion` en Expo Go y `appobra://iniciar-sesion` en un *development build*. Lleva ruta porque Keycloak rechaza `appobra://` sola (URI sin autoridad, `400`).
- `tokens.ts`: token de acceso, refresh token y vencimiento en `expo-secure-store`, cada uno en su clave.
- `sesion.tsx`: al abrir la app lee los tokens guardados y los renueva si vencieron; renueva solo un minuto antes de que venza el token de acceso (dura 5 minutos) y `obtenerToken()` lo renueva si hace falta (una sola renovación a la vez). Si Keycloak rechaza la renovación (error OAuth, p. ej. `invalid_grant`), borra los tokens y vuelve al inicio de sesión con «Tu sesión terminó. Vuelve a iniciar sesión.»; si falla la red, conserva la sesión y reintenta a los 30 s.
- Cerrar sesión (barra superior y «No tienes acceso»): borra los tokens de `expo-secure-store` y hace `POST` al `end_session_endpoint` del realm con `client_id` y `refresh_token` (cierre por canal trasero, `204`). Así termina la sesión SSO de Keycloak y la próxima vez se pide la contraseña. Sin conexión, los tokens igual se borran del celular.
- Al abrir la app sin sesión, el inicio de sesión de Keycloak se abre solo una vez (criterio 1); después de cerrar sesión o de una sesión vencida se espera a que el usuario pulse «Iniciar sesión».
- Roles (`roles.ts`): en la app solo cuentan `maestro` y `almacenero` del token (`realm_access.roles`, `azp = app-obra`); los demás se ignoran. Pestañas: `maestro` → Mis obras, Foto de avance; `almacenero` → Mis obras, Ingreso, Salida, Stock; con los dos, la unión sin repetir Mis obras. La barra superior muestra el `name` del token y «Maestro de obra», «Almacenero» o los dos.
- Las pestañas Ingreso, Salida y Stock muestran por ahora el estado vacío («Aún no hay obras asignadas.»). Las pantallas reales son `obras/[id]/…` (004 y 005): cada una decide ahí cómo se elige la obra desde su pestaña.
- Las pantallas de una obra (`obras/[id]/…`) no van dentro de las pestañas sino en el Stack de `(app)/_layout.tsx`, encima de `(pestanas)`: en Expo Router 58 una pestaña oculta (`href: null`) ya no se puede abrir (redirige a la primera pestaña). Se protegen con `Stack.Protected` según `PANTALLAS_OBRA` de `roles.ts`, y `unstable_settings.initialRouteName = '(pestanas)'` deja las pestañas debajo si se abren desde un enlace. La barra superior la pone ese Stack, con «Volver» cuando hay pantalla anterior.
- `src/app/_layout.tsx` usa `Stack.Protected`: sin sesión solo existe `(auth)/iniciar-sesion`; con sesión y rol de la app, `(app)`; con sesión sin rol de la app, `(auth)/sin-acceso`. `(app)/(pestanas)/_layout.tsx` usa `Tabs.Protected` para que un rol no llegue a las pestañas de otro. Al terminar la sesión se vacía la caché de TanStack Query (`queryClient.clear()`), para que no quede nada del usuario anterior.

## Foto de avance (005)

- Se llega a `obras/[id]/foto` de dos formas (criterio 1): desde «Mis obras», con el botón «Foto de avance» de cada obra (solo `maestro`), o desde la pestaña «Foto de avance», que lista las mismas obras («Elige la obra») y lleva a la pantalla de la que se pulse. Las dos usan `ObrasAsignadas` (`GET /obras`, que Obras ya filtra por asignación).
- La pantalla carga la obra con `GET /obras/{id}` (partidas en `SelectorPartida`), toma la foto con la cámara (pide el permiso) o la elige de la galería (`expo-image-picker`, `mediaTypes: ['images']`, `quality: 1` para comprimir una sola vez) y la reduce con `expo-image-manipulator` (`ImageManipulator.manipulate` → `resize` del lado más largo a 1600 px si lo pasa → `saveAsync({ compress: 0.8, format: JPEG })`). Las medidas se leen de la imagen cargada por el manipulador, que ya tiene aplicada la orientación.
- `tomadaEn`: con la cámara, el momento en que vuelve la foto; de la galería, `DateTimeOriginal` del EXIF (con `OffsetTimeOriginal` si lo trae; si no, en la hora del celular), o el momento actual si no hay fecha válida o es futura.
- No usa TanStack Form: no hay campos de texto (solo partida y foto). `foto.esquema.ts` (Zod) dice qué falta para enviar y la pantalla lo muestra bajo «Enviar».
- El `fotoId` (UUID de `expo-crypto`) se crea al tener la foto; una foto nueva es un registro nuevo. La pantalla lleva `key={id}` para empezar de cero en cada obra.
- «Enviar» (`foto.envio.ts`, con `useMutation` sin reintentos automáticos): `POST /obras/{obraId}/fotos/url-subida` con el `fotoId` → lee el archivo comprimido (`file://`) y lo sube con `PUT` a la URL firmada (`Content-Type: image/jpeg`, sin token, 60 s como máximo) → `POST /obras/{obraId}/fotos` con `{ id: fotoId, partidaId, claveArchivo, tomadaEn }`. `201` y `200` (ya existía, criterio 4) son éxito: «Foto enviada.» y se quita la foto (la siguiente es un registro nuevo); la partida queda elegida.
- Reintento (criterio 5): lo hecho queda en memoria (`EnvioFoto`: `fotoId`, archivo comprimido, última URL y si ya se subió) hasta que se registra. «Reintentar» sigue desde el paso que falló, con el mismo `fotoId` y el mismo archivo, sin volver a tomar ni comprimir la foto: si ya se subió, solo registra; si la URL vence en menos de 30 s, o S3 rechaza el `PUT` con `403` (URL vencida), pide otra con el mismo `fotoId`.
- Tras un fallo se muestra «No se pudo enviar.» con el texto de `docs/mensajes.md`, y `decidirTrasFallo` (función pura) elige qué ofrecer: sin señal, tiempo agotado, `429`, `5xx` (también `503 SERVICIO_NO_DISPONIBLE` mientras no exista el bucket) o un rechazo de S3 → «Reintentar»; `422 PARTIDA_NO_ES_DE_LA_OBRA` → «Actualizar datos» y elegir otra partida (mismo `fotoId`); `422 CLAVE_ARCHIVO_INVALIDA`, `413`, `400` o la foto perdida → se descarta la foto para tomar otra; `403` y `404 OBRA_NO_ENCONTRADA` → sin reintento; `401` o sesión terminada → «Iniciar sesión».

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
- `jest.setup.ts` (en `setupFilesAfterEnv`) simula `expo-secure-store` en memoria (`src/pruebas/secure-store-simulado.ts`, se vacía antes de cada prueba) y `expo-font` (fuentes e íconos dados por cargados), porque en Jest no hay archivos de fuentes reales. También simula `expo-image-picker` y `expo-image-manipulator` (`src/pruebas/imagen-simulada.ts`), `randomUUID` de `expo-crypto` (con el `crypto` de Node), `configuracion()` (lee `app.json`, porque en Jest `expo-constants` no lo trae) y `src/api/red.ts`.
- La red se simula en `src/api/red.ts` (`jest.mock`) y no en el `fetch` global, porque Expo vuelve a instalar su `fetch` (`expo/fetch`) al cargar sus módulos dentro de `renderRouter` y pisaría el simulado. Cada prueba le da sus respuestas con `simularFetch()` y `jsonRespuesta()` (`src/pruebas/fetch-simulado.ts`).
- Compilación sin celular: `npx expo export --platform android`.
