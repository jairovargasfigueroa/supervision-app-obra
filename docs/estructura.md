# App de obra: estructura y librerías

Obligatorio para todo el código de este proyecto. Instala todo con `npx expo install <paquete>`.

## Librerías

Expo SDK 58, `expo-router`, `react-native-paper` 5 + `react-native-safe-area-context` + `@expo/vector-icons` (MaterialCommunityIcons), `expo-font` + `expo-asset` (lo pide `expo-font`) + `@expo-google-fonts/inter`, `@tanstack/react-query` 5, `@tanstack/react-form` 1 + `zod` 4, `expo-auth-session`, `expo-secure-store`, `expo-crypto`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite` (capa 1), `expo-file-system` (102: la foto se guarda en `documentDirectory/pendientes/` hasta que se sube). Expo Router necesita además `expo-linking`, `expo-constants`, `react-native-screens`, `expo-web-browser` (lo usa `expo-auth-session`) y `react-dom` (dependencia de `@expo/metro-runtime`; fijada en `19.3.0`, la del SDK, porque si npm la elige sola toma una que pide otro React y `npm install` falla con `ERESOLVE`). Pruebas: `jest-expo` + `@testing-library/react-native` 14.

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
    (app)/_layout.tsx                # Stack con la barra superior (nombre, rol, «Volver»); pantallas de obra con Stack.Protected por rol;
                                     # SincronizacionProvider del usuario de la sesión (101)
    (app)/(pestanas)/_layout.tsx     # pestañas según rol (Tabs.Protected)
    (app)/(pestanas)/obras/index.tsx # pestaña Mis obras (maestro y almacenero)
    (app)/(pestanas)/foto.tsx        # pestaña Foto de avance (maestro): elige la obra
    (app)/(pestanas)/ingreso.tsx     # pestaña Ingreso (almacenero)
    (app)/(pestanas)/salida.tsx      # pestaña Salida (almacenero)
    (app)/(pestanas)/stock.tsx       # pestaña Stock (almacenero)
    (app)/(pestanas)/pendientes.tsx  # pestaña Pendientes con contador (maestro y almacenero, 101)
    (app)/obras/[id]/foto.tsx        # maestro (005)
    (app)/obras/[id]/diario.tsx      # maestro (103)
    (app)/obras/[id]/ingreso.tsx     # almacenero
    (app)/obras/[id]/salida.tsx      # almacenero
    (app)/obras/[id]/stock.tsx       # almacenero
  sesion/          sesion.tsx (contexto: SesionProvider, useSesion), keycloak.ts (expo-auth-session),
                   tokens.ts (secure-store), token.ts (lee el JWT), renovacion.ts (cuándo renovar),
                   roles.ts (roles efectivos, pestañas y pantallas de obra por rol, nombre del rol),
                   usuario-local.ts (101: último usuario { id, nombre, usuario, roles } en secure-store)
  api/             red.ts (única llamada a fetch), cliente.ts (token, tiempo máximo, X-Request-Id, errores por
                   codigo, URL de cada servicio, validación Zod de la respuesta; QueryClient con reintentos
                   1-2-4 s de las consultas), errores.ts (ErrorApi y textos de docs/mensajes.md),
                   materiales.ts (tipos y respuesta de POST /movimientos), subida.ts (PUT de la foto a S3),
                   sincronizacion.ts (101: GET /paquete-datos con X-Dispositivo-Id e If-None-Match, `null` con 304;
                   POST /lotes con tiempo máximo de 30 s, un resultado por operación; 102: POST /fotos/url-subida
                   con 10 s)
  formularios/     movimiento.esquema.ts (campos y cuerpo de POST /movimientos, Zod), movimiento.ts (avisos de
                   stock superado, con la respuesta o con el stock mostrado), useMovimiento.ts (TanStack Form
                   sobre el paquete local + registro en la cola, 101), foto.esquema.ts (Zod), foto.ts (cámara, galería y compresión),
                   useFotoAvance.ts (estado de la pantalla; desde la 102 guarda la foto y la pone en la cola)
  componentes/     BarraSuperior.tsx, EncabezadoApp.tsx (barra con sesión: «Cerrar sesión» con aviso de pendientes, 101), PantallaVacia.tsx, EstadoChip.tsx, EstadoVacio.tsx, EstadoError.tsx,
                   ObrasAsignadas.tsx (obras del paquete local, con «Sin señal · datos del …»), TituloObra.tsx,
                   AvisoSinSenal.tsx (101), PendientesEnvio.tsx (pantalla «Pendientes de envío», 101), DiarioObra.tsx (103), ConObraLocal.tsx (la obra del paquete guardado, 101), FormularioMovimiento.tsx
                   (ingreso y salida), StockObra.tsx,
                   SelectorMaterial.tsx (con búsqueda), SelectorPartida.tsx
  sync/            (capa 1, 101) dispositivo.ts (idDispositivo: UUID creado una vez y guardado en secure-store),
                   base-local.ts (expo-sqlite: tablas operacion_pendiente y paquete_datos, migraciones por
                   PRAGMA user_version en una transacción, una sola conexión; la 2, de la 102, agrega
                   archivo_local y estado_archivo), paquete.ts (descarga del
                   paquete de datos con la versión guardada, guardado por usuario y lectura), cola.ts
                   (operaciones con su UUID: agregar sin duplicar, listar y contar por usuario, descartar
                   PENDIENTE o RECHAZADO, tomar hasta 20 listas en orden y marcarlas ENVIANDO, marcar
                   ENVIADO / RECHAZADO / reintento; al abrir la app ENVIANDO → PENDIENTE y se borran los
                   ENVIADO de hace más de 24 h), archivos.ts (102: foto en documentDirectory/pendientes/,
                   abrir y borrar), subidor.ts (102: un archivo a la vez, URL nueva y PUT completo a S3),
                   espera.ts (espera creciente), diario-local.ts (103: entradas del paquete + cola, días
                   elegibles, una por día), enviador.ts (envío por lotes con candado, espera creciente),
                   red.ts (NetInfo: conexión = isConnected y internet no inalcanzable), disparadores.ts (al
                   volver la señal, al volver a primer plano, cada 60 s con pendientes), sincronizacion.tsx
                   (SincronizacionProvider y useSincronizacion: contador, red, «Enviar ahora», «Actualizar datos»,
                   registrar; usePaquete y useOperaciones), stock-local.ts (stock del paquete + movimientos sin
                   enviar, estado con la regla de reglas-negocio.md), mensajes.ts (textos de la 101)
  nucleo/          formato.ts, clima.ts (103), uuid.ts, configuracion.ts (lee extra de app.json, validado con Zod),
                   estado-stock.ts (estado del stock → etiqueta y tono del chip)
  pruebas/         ayudas de prueba: jwt.ts (tokens falsos), secure-store-simulado.ts, fetch-simulado.ts (red),
                   sqlite-simulado.ts (expo-sqlite sobre node:sqlite en memoria), archivos-simulados.ts
                   (expo-file-system en memoria), imagen-simulada.ts (cámara, galería y compresión)
  tema.ts
```

## Sesión (001)

- `keycloak.ts`: descubrimiento del realm (`emisor` de `configuracion.ts`), `AuthRequest` con PKCE `S256` y alcances `openid profile offline_access` (101: sesión larga, refresh token «offline» que vale mientras la sesión offline no pase 30 días sin usarse), canje del código (`exchangeCodeAsync` con `code_verifier`) y renovación (`refreshAsync`). El `redirectUri` es `makeRedirectUri({ scheme: 'appobra', path: 'iniciar-sesion' })`: `exp://localhost:8090/--/iniciar-sesion` en Expo Go y `appobra://iniciar-sesion` en un *development build*. Lleva ruta porque Keycloak rechaza `appobra://` sola (URI sin autoridad, `400`).
- `tokens.ts`: token de acceso, refresh token y vencimiento en `expo-secure-store`, cada uno en su clave.
- `sesion.tsx`: al abrir la app lee los tokens guardados y los renueva si vencieron; renueva solo un minuto antes de que venza el token de acceso (dura 5 minutos) y `obtenerToken()` lo renueva si hace falta (una sola renovación a la vez); `obtenerToken({ renovar: true })` lo renueva aunque no venza (101, `TOKEN_VENCIDO` de Sincronización). Si Keycloak rechaza la renovación (error OAuth, p. ej. `invalid_grant`), borra los tokens y vuelve al inicio de sesión con «Tu sesión terminó. Vuelve a iniciar sesión.»; si falla la red, conserva la sesión y reintenta a los 30 s.
- Cerrar sesión (barra superior y «No tienes acceso»): borra los tokens de `expo-secure-store`, revoca el refresh token offline en el `revocation_endpoint` (`token`, `token_type_hint=refresh_token`, `client_id`; 101) y hace `POST` al `end_session_endpoint` del realm con `client_id` y `refresh_token` (cierre por canal trasero, `204`). Así termina la sesión SSO de Keycloak y la próxima vez se pide la contraseña. Sin conexión, los tokens igual se borran del celular.
- Al abrir la app sin sesión, el inicio de sesión de Keycloak se abre solo una vez (criterio 1); después de cerrar sesión o de una sesión vencida se espera a que el usuario pulse «Iniciar sesión».
- Roles (`roles.ts`): en la app solo cuentan `maestro` y `almacenero` del token (`realm_access.roles`, `azp = app-obra`); los demás se ignoran. Pestañas: `maestro` → Mis obras, Foto de avance; `almacenero` → Mis obras, Ingreso, Salida, Stock; con los dos, la unión sin repetir Mis obras. La barra superior muestra el `name` del token y «Maestro de obra», «Almacenero» o los dos.
- Las pestañas Foto de avance, Ingreso, Salida y Stock listan las obras asignadas («Elige la obra») y llevan a la pantalla de la obra (`obras/[id]/…`); sin obras, el estado vacío («Aún no hay obras asignadas.»).
- Las pantallas de una obra (`obras/[id]/…`) no van dentro de las pestañas sino en el Stack de `(app)/_layout.tsx`, encima de `(pestanas)`: en Expo Router 58 una pestaña oculta (`href: null`) ya no se puede abrir (redirige a la primera pestaña). Se protegen con `Stack.Protected` según `PANTALLAS_OBRA` de `roles.ts`, y `unstable_settings.initialRouteName = '(pestanas)'` deja las pestañas debajo si se abren desde un enlace. La barra superior la pone ese Stack, con «Volver» cuando hay pantalla anterior.
- `src/app/_layout.tsx` usa `Stack.Protected`: sin sesión solo existe `(auth)/iniciar-sesion`; con sesión y rol de la app, `(app)`; con sesión sin rol de la app, `(auth)/sin-acceso`. `(app)/(pestanas)/_layout.tsx` usa `Tabs.Protected` para que un rol no llegue a las pestañas de otro. Al terminar la sesión se vacía la caché de TanStack Query (`queryClient.clear()`), para que no quede nada del usuario anterior.

## Foto de avance (005)

- Se llega a `obras/[id]/foto` de dos formas (criterio 1): desde «Mis obras», con el botón «Foto de avance» de cada obra (solo `maestro`), o desde la pestaña «Foto de avance», que lista las mismas obras («Elige la obra») y lleva a la pantalla de la que se pulse. Las dos usan `ObrasAsignadas`: desde la 101, las obras del paquete de datos guardado (obras asignadas en ejecución que Sincronización pide a Obras); con «tirar para actualizar» se vuelve a pedir el paquete y, sin conexión, arriba va «Sin señal · datos del dd/mm hh:mm». Si nunca se descargó: «Necesitas señal la primera vez para descargar tus obras» con «Reintentar».
- La pantalla carga la obra del paquete guardado con `ConObraLocal` (102; partidas en `SelectorPartida`), toma la foto con la cámara (pide el permiso) o la elige de la galería (`expo-image-picker`, `mediaTypes: ['images']`, `quality: 1` para comprimir una sola vez) y la reduce con `expo-image-manipulator` (`ImageManipulator.manipulate` → `resize` del lado más largo a 1280 px si lo pasa → `saveAsync({ compress: 0.7, format: JPEG })`). Las medidas se leen de la imagen cargada por el manipulador, que ya tiene aplicada la orientación.
- `tomadaEn`: con la cámara, el momento en que vuelve la foto; de la galería, `DateTimeOriginal` del EXIF (con `OffsetTimeOriginal` si lo trae; si no, en la hora del celular), o el momento actual si no hay fecha válida o es futura.
- No usa TanStack Form: no hay campos de texto (solo partida y foto). `foto.esquema.ts` (Zod) dice qué falta para enviar y la pantalla lo muestra bajo «Enviar».
- El `fotoId` (UUID de `expo-crypto`) se crea al tener la foto; una foto nueva es un registro nuevo. La pantalla lleva `key={id}` para empezar de cero en cada obra.
- «Enviar» (102): mueve la foto comprimida a `documentDirectory/pendientes/{fotoId}.jpg` (`sync/archivos.ts`, `expo-file-system`) y la agrega a la cola como `FOTO_AVANCE` (`idOperacion` = `fotoId`; `datos` `{ id, obraId, partidaId, tomadaEn }`; `archivo_local` con la ruta y `estado_archivo` `PENDIENTE`; descripción «Foto de avance · P-01 · Losa de hormigón armado»), dispara el envío y espera hasta 5 s: «Foto enviada.» si quedó `ENVIADO`, el motivo si quedó `RECHAZADO`, si no «Guardado en el celular · se enviará cuando haya señal». La foto se quita (la siguiente es un registro nuevo) y la partida queda elegida. Con más de 100 fotos del usuario sin enviar, arriba de «Enviar»: «Tienes N fotos sin enviar; busca señal para enviarlas» (no impide tomar más).

## Movimientos de material (004)

- Se llega a `obras/[id]/ingreso`, `obras/[id]/salida` y `obras/[id]/stock` (solo `almacenero`, `Stack.Protected` con `PANTALLAS_OBRA`) de dos formas (criterio 1): desde «Mis obras», con los botones «Ingreso», «Salida» y «Stock» de cada obra (`pantallasObraPorRol`: con los dos roles salen también «Foto de avance»; los botones bajan de renglón a 360 px), o desde la pestaña del mismo nombre, que pide elegir la obra.
- Ingreso, Salida y Stock cargan la obra del paquete guardado en el celular con `ConObraLocal` (101: nombre y partidas; sin paquete, «Necesitas señal la primera vez para descargar tus obras» con «Reintentar»; si la obra no está en el paquete, «Obra no encontrada»). Llevan `key={id}`.
- Ingreso y Salida comparten `FormularioMovimiento` (TanStack Form con el esquema Zod de `movimiento.esquema.ts` en `onChange` y `onSubmit`; los errores se muestran junto al campo cuando se tocó o tras pulsar el botón). Material: los del paquete de datos (activos del catálogo, por código) con búsqueda por código o nombre si son más de 8, y bajo la lista su stock en la obra: el del paquete más los movimientos sin enviar (`stockConPendientes`; sin fila, 0). Cantidad: texto con coma o punto, > 0 y hasta 3 decimales (`leerCantidad`). Ingreso: nota de remisión opcional (`notaRemision` solo si se escribió). Salida: partida de destino obligatoria (`SelectorPartida`).
- `id` del registro (criterio 6): UUID de `expo-crypto` creado al abrir el formulario. Desde la 101, «Registrar» guarda el movimiento en la cola del celular (operación `MOVIMIENTO_MATERIAL` con `idOperacion` = `id` y la descripción «Salida · 12,5 bolsas de Cemento IP-30 · P-01») y dispara el envío a Sincronización; espera hasta 5 s: `ENVIADO` → «Registrado» (con el aviso de `superaStock` de la respuesta); `RECHAZADO` → el motivo según su `codigo` (`mensajeRechazo`) y los datos quedan en el formulario; si no llegó la respuesta → «Guardado en el celular · se enviará cuando haya señal» (y, en una salida mayor al stock mostrado, el mismo aviso del criterio 5 con ese stock, criterio 10). Con «Registrado» o «Guardado» se vacía el formulario; en todos los casos el siguiente registro lleva otro `id`. La cola reemplaza los reintentos 1-2-4 s de la 004 (`conReintentos` y `registroParaEnviar` ya no existen).
- Stock (criterio 9): desde la 101, el stock del paquete más los movimientos `PENDIENTE` y `ENVIANDO` de la obra (`stockConPendientes`: ingresos suman, salidas restan, estado recalculado con la regla de `reglas-negocio.md`), con «Incluye N movimientos sin enviar» si hay y «Sin señal · datos del dd/mm hh:mm» sin conexión; en tarjetas (código · nombre, cantidad y mínimo con su unidad en singular o plural, y el estado), por código, con «tirar para actualizar» (vuelve a pedir el paquete). El estado va en `EstadoChip` con las etiquetas y tonos del ERP (`estado-stock.ts`: `BAJO` «Bajo» error, `JUSTO` «Justo» atención, `OK` «OK» éxito; fondo suave y texto del color fuerte) y arriba la regla de los estados, el mismo texto que el ERP. Sin filas: «Esta obra todavía no tiene materiales con movimientos ni mínimo definido.» (texto del ERP, 003). El mismo chip acompaña al stock del material en Ingreso y Salida.
- Tras registrar (criterio 4), el enviador reemplaza en el paquete local el stock del material con el `stock` de la respuesta y vuelve a pedir el paquete; el formulario se actualiza solo (las consultas del paquete y de la cola se invalidan con cada cambio).
- Avisos: con `superaStock` (criterio 5), «La salida supera el stock registrado (stock: X). Queda como alerta para revisión», donde X es el stock que había antes de la salida (el `stock.cantidad` de la respuesta más la cantidad que salió) con su unidad. `409 PERIODO_CERRADO` (criterio 7): «El periodo AAAA-MM ya está cerrado», con el mes de `registradoEn` en La Paz (`periodoLaPaz`, la misma regla que Materiales). Los demás errores, con su texto de `errores.ts` (`MATERIAL_INACTIVO`, `OBRA_NO_ENCONTRADA`, genéricos).

## Reglas

- Componentes de Paper (`Button`, `TextInput`, `Card`, `List`, `Chip`, `Snackbar`, `Dialog`); nada de estilos sueltos si Paper lo resuelve.
- Formularios con TanStack Form + Zod; el UUID del registro se crea al abrir el formulario.
- Datos del servidor con TanStack Query; las escrituras con `useMutation` y reintentos del cliente.
- Pantallas en `src/app/` sin lógica pesada: la lógica va en `api/`, `formularios/` o `sync/`.

## Pruebas

`jest-expo` + Testing Library: cliente REST (reintentos de las consultas), cola, enviador y sincronización (101), esquemas Zod, componentes principales. En `rutas.test.tsx`, Sincronización se simula pasando cada operación de `POST /lotes` al `POST /movimientos` simulado.
- Pruebas de la 101 («Pruebas» del diseño): `sync/cola.test.ts` (orden, filtro por usuario, sin duplicar, descartar, `ENVIANDO` → `PENDIENTE` al iniciar, limpieza a las 24 h), `sync/enviador.test.ts` (espera creciente; con la red simulada: `PROCESADO`, `ERROR`, `REINTENTAR`, fallo del lote, `TOKEN_VENCIDO`, `401` y `400` del lote, lotes de 20, candado), `sync/stock-local.test.ts` (stock con pendientes y estado), `sync/paquete.test.ts` (`If-None-Match`, `304`, fallo), `sync/base-local.test.ts` (migraciones), `sync/sincronizacion.test.tsx`, `sync/subidor.test.ts` (102: URL nueva en cada intento, rechazo por `404`, reintento por red, `401`, archivo perdido, `SUBIENDO` → `PENDIENTE`), `formularios/foto.test.ts` (102: 1280 px y 0,7) y, de punta a punta en la app, `rutas.test.tsx` (formularios por la cola, sin señal, stock local, «Pendientes de envío», cerrar sesión con pendientes; 102: foto a la cola, subida y registro, aviso de más de 100 fotos, miniatura y «Subiendo foto…»). En `sync/enviador.test.ts`, el orden livianos antes que archivos y el borrado del archivo solo al confirmar. `npm test`, `npx tsc --noEmit` y `npx expo-doctor` antes de cada commit.

- Las pruebas van junto al archivo que prueban (`formato.test.ts`, `estados.test.tsx`).
- Las rutas (`src/app/`) se prueban desde fuera de esa carpeta, en `src/rutas.test.tsx`, con `renderRouter('src/app')` de `expo-router/testing-library`: todo archivo dentro de `src/app/` es una pantalla, así que ahí no van pruebas.
- `testTimeout` de Jest en 60 s (`package.json`): la primera prueba que monta Expo Router tarda en cargar los módulos.
- `jest.setup.ts` (en `setupFilesAfterEnv`) simula `expo-secure-store` en memoria (`src/pruebas/secure-store-simulado.ts`, se vacía antes de cada prueba) y `expo-font` (fuentes e íconos dados por cargados), porque en Jest no hay archivos de fuentes reales. También simula `expo-image-picker` y `expo-image-manipulator` (`src/pruebas/imagen-simulada.ts`), `randomUUID` de `expo-crypto` (con el `crypto` de Node), `configuracion()` (lee `app.json`, porque en Jest `expo-constants` no lo trae) y `src/api/red.ts`.
- `@react-native-community/netinfo` se simula con su simulado oficial (`jest/netinfo-mock.js`: con conexión); las pruebas de los disparadores capturan el oyente para avisar cambios.
- `expo-sqlite` se simula con `src/pruebas/sqlite-simulado.ts`: cada base es un SQLite real en memoria de Node (`node:sqlite`), así las pruebas ejecutan el mismo SQL que el celular; las bases se guardan por nombre (volver a abrir conserva los datos) y se vacían antes de cada prueba, junto con la conexión de `base-local.ts` y el `idDispositivo` en memoria.
- La red se simula en `src/api/red.ts` (`jest.mock`) y no en el `fetch` global, porque Expo vuelve a instalar su `fetch` (`expo/fetch`) al cargar sus módulos dentro de `renderRouter` y pisaría el simulado. Cada prueba le da sus respuestas con `simularFetch()` y `jsonRespuesta()` (`src/pruebas/fetch-simulado.ts`).
- Compilación sin celular: `npx expo export --platform android`.

## Registro sin señal (101)

- `sync/enviador.ts` (`enviarPendientes`): un solo envío a la vez (candado en memoria; si llega otro pedido durante el envío, se hace otra vuelta al terminar). Por cada vuelta: token vigente (si no se puede renovar por falta de red se detiene sin tocar la cola, `sin-red`; si la sesión terminó, `sin-sesion`) → hasta 20 operaciones `PENDIENTE` listas del usuario, en orden, marcadas `ENVIANDO` → `POST /lotes` (30 s) → por resultado: `PROCESADO` → `ENVIADO` con la respuesta (en un movimiento, el `stock` de la respuesta reemplaza el del paquete local); `ERROR` → `RECHAZADO` con `codigo` (el `detail` o `title` va a `error_mensaje`, solo para soporte); `REINTENTAR` → `PENDIENTE` con un intento más y espera creciente (con `TOKEN_VENCIDO`, el token se renueva antes del siguiente lote con `obtenerToken({ renovar: true })`). Se repite mientras queden listas; si envió alguna, vuelve a pedir el paquete con `If-None-Match`.
- Orden de envío (102, criterio 4): el enviador primero manda en lotes las operaciones «livianas listas» (sin archivo, o con el archivo ya `SUBIDO`); cuando no queda ninguna, el subidor sube un solo archivo y el enviador vuelve a las livianas (el registro de esa foto sale en el lote siguiente), hasta que no quede nada listo o el subidor falle (se detiene hasta el próximo envío; con un `401`, renueva el token una vez y sigue). El archivo se borra del celular cuando el registro queda `ENVIADO` o al descartar la operación (`descartar`); una foto `RECHAZADO` lo conserva hasta descartarla.
- Espera creciente (`sync/espera.ts`): `min(2^(intentos−1), 300)` s por un factor aleatorio entre 0,8 y 1,2.
- Subidor (102, `sync/subidor.ts`, `subirSiguiente`): toma la operación `PENDIENTE` más antigua del usuario con `estado_archivo` `PENDIENTE` y su próximo intento vencido, la marca `SUBIENDO`, pide a Sincronización `POST /fotos/url-subida { obraId, fotoId }` (10 s; una URL nueva en cada intento) y hace `PUT` del archivo de `pendientes/` (el `File` de expo-file-system como cuerpo, `image/jpeg`, sin token, 30 s). `PUT` correcto → `claveArchivo` en `datos` y `estado_archivo` `SUBIDO`. `4xx` al pedir la URL (salvo `401`, `408` y `429`) → `RECHAZADO` con su `codigo`. Red, tiempo agotado, `5xx`, `401` (pide renovar el token) o fallo del `PUT` → `estado_archivo` `PENDIENTE` con la espera creciente. Si el archivo ya no está en el celular → `RECHAZADO` con el código propio `FOTO_NO_DISPONIBLE` («La foto no se pudo preparar para el envío.»). Al abrir la app, un `SUBIENDO` vuelve a `PENDIENTE`.
- Sesión sin señal: al entrar (inicio de sesión, apertura o renovación) se guarda el `usuarioLocal` en `expo-secure-store` (`sesion/usuario-local.ts`). Si al abrir la app la renovación falla por la red, se entra con los tokens guardados y el `usuarioLocal` aunque el token haya vencido; los envíos esperan a que se renueve (el enviador se detiene con `sin-red`). Si Keycloak rechaza la renovación, se borran los tokens y el `usuarioLocal` y vuelve el inicio de sesión; la cola no se toca.
- Cerrar sesión (`EncabezadoApp`): con pendientes del usuario (`PENDIENTE` + `ENVIANDO`), primero el diálogo «¿Cerrar sesión?» con «Tienes N registros sin enviar; se enviarán cuando vuelvas a iniciar sesión con este usuario», «Cancelar» y «Cerrar sesión». Al cerrar se borra el `paquete_datos` del usuario y después tokens y `usuarioLocal` (como en la 001); las operaciones quedan en la cola con su `usuario_id`. Textos de la 101 en `sync/mensajes.ts`.
- «Registrar con fecha de hoy» (criterio 14b): en un movimiento `RECHAZADO` con `PERIODO_CERRADO` (en «Pendientes de envío» y en el formulario tras el rechazo), `registrarConFechaDeHoy` agrega una operación nueva (UUID nuevo, mismos `datos` con ese `id` y `registradoEn` = ahora, misma descripción), descarta la rechazada y envía; el resultado se muestra como al registrar.
- Pendientes de otro usuario (criterio 15): `pendientesDeOtros` cuenta por usuario los `PENDIENTE` y `ENVIANDO` de otros `usuario_id` del celular; «Pendientes de envío» muestra «Hay N registros de {usuario_nombre} sin enviar; se enviarán cuando esa persona vuelva a iniciar sesión». No se envían ni se listan.
- `sync/sincronizacion.tsx` (`SincronizacionProvider`, montado en `(app)/_layout.tsx` con `key` del usuario): la primera vez prepara la cola (`ENVIANDO` → `PENDIENTE`, borra los `ENVIADO` de más de 24 h) y envía (al abrir la app o iniciar sesión); `registrar` agrega a la cola con el `id` y el `nombre` del usuario y dispara el envío sin esperarlo; el contador (`PENDIENTE` + `ENVIANDO`) se recalcula con cada cambio de la cola (`alCambiarCola`). Los disparadores (`disparadores.ts`): NetInfo de sin señal a con señal (el primer aviso, el estado al abrir, no cuenta), `AppState` → `active`, y cada 60 s si hay pendientes y no se sabe que falte la señal; respetan la espera creciente. «Enviar ahora» (`enviarAhora`) deja listos ya todos los `PENDIENTE` del usuario (sin esperar su próximo intento; decisión de implementación: es un pedido explícito del usuario) y envía.
- Fallo del lote completo (red, tiempo agotado, `5xx`, `429`…): todas vuelven a `PENDIENTE` con espera creciente y el envío se detiene. Decisiones de implementación (el diseño no las detalla): un `401` del lote renueva el token y lo reenvía una sola vez de inmediato (otro `401` va con espera creciente); `400 LOTE_INVALIDO` y `413` dejan las operaciones del lote `RECHAZADO` con ese código, porque reenviar el mismo lote daría lo mismo.

## Diario de obra (103)

- Se llega a `obras/[id]/diario` (solo `maestro`, `PANTALLAS_OBRA`) con el botón «Diario de obra» de cada obra en «Mis obras». La obra sale del paquete con `ConObraLocal`.
- Lista (criterio 7, `sync/diario-local.ts`, `entradasDeObra`): las entradas de `diario` del paquete de esa obra (Sincronización lo trae solo para el `maestro`, últimos 30 días) más las operaciones `ENTRADA_DIARIO` de la cola de esa obra: `PENDIENTE` y `ENVIANDO` marcadas «Sin enviar», `RECHAZADO` «Rechazada» con el motivo, y una `ENVIADO` que el paquete todavía no trae, sin marca. Solo las de los últimos 30 días contando hoy en La Paz, de la más reciente a la más antigua.
- Formulario (criterios 1 a 4, `formularios/useDiario.ts` y `diario.esquema.ts`, TanStack Form + Zod): fecha con chips «Hoy», «Ayer» y los días hasta 7 atrás (`fechasElegibles`, en hora de La Paz; sin días futuros), clima con cuatro chips (`nucleo/clima.ts`: Soleado, Nublado, Lluvia leve, Lluvia fuerte), texto de 10 a 2000 caracteres sin contar los espacios de los costados, con contador «N/2000». El UUID se crea al abrir el formulario. «Guardar entrada»: si ya hay una entrada de esa obra y fecha en el paquete o en la cola (sin contar las rechazadas), «Ya registraste el diario del dd/mm» y no se guarda; si no, `ENTRADA_DIARIO` a la cola con `datos` `{ id, obraId, fecha, clima, texto }` (texto sin espacios a los costados) y descripción «Diario · 15/11 · Lluvia leve»; espera hasta 5 s como los movimientos: «Registrado», el motivo del rechazo o «Guardado en el celular · se enviará cuando haya señal».
- Corregir (criterio 5): las entradas «Sin enviar» cuya operación está `PENDIENTE` tienen «Corregir»: cargan fecha, clima y texto en el formulario («Corrigiendo la entrada del dd/mm» con «Cancelar»); «Guardar corrección» comprueba otra vez la entrada única del día (sin contar la que se corrige) y `cola.corregir` reemplaza `datos` y `descripcion` en la misma fila, con el mismo `id`, solo si sigue `PENDIENTE`; si ya se está enviando: «Esta entrada ya se está enviando y no se puede corregir.». Una enviada o rechazada no se corrige.
- Rechazos por `codigo` (`errores.ts`): `DIARIO_DIA_YA_REGISTRADO` «Ya existe una entrada del diario para ese día», `FECHA_DIARIO_INVALIDA` «La fecha no es válida para esta obra», `OBRA_NO_EN_EJECUCION` «La obra no está en ejecución»; se muestran en la entrada «Rechazada» y en «Pendientes de envío».
