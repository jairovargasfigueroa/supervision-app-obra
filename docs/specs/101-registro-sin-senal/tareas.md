# 101 · Registrar material sin señal · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/101-registro-sin-senal/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar con `npx expo install`: `expo-sqlite`, `@react-native-community/netinfo`; agregar `sincronizacionUrl` en `app.json` → `extra`
- [x] `idDispositivo` generado una sola vez y guardado en `expo-secure-store`
- [x] Base local: tablas `operacion_pendiente` y `paquete_datos` con migraciones por `PRAGMA user_version`
- [ ] `src/sync/paquete.ts`: descarga de `GET /paquete-datos` con `If-None-Match`, guardado y lectura del paquete local
- [ ] `src/sync/cola.ts`: agregar, listar, contar, descartar; `ENVIANDO` → `PENDIENTE` al iniciar; limpieza de enviados a las 24 h
- [ ] `src/sync/enviador.ts`: lotes de 20, `POST /lotes` con tiempo máximo de 30 s, manejo de `PROCESADO` / `ERROR` / `REINTENTAR`, espera creciente con factor aleatorio, renovación del token
- [ ] Disparadores del envío: al agregar, NetInfo conectado, `AppState` activo, cada 60 s con pendientes, «Enviar ahora»
- [ ] Sesión sin señal con `usuarioLocal`; cierre de sesión con aviso de pendientes y borrado del paquete
- [ ] Formularios de ingreso y salida (004) pasan por la cola; mensajes «Registrado» / «Guardado en el celular» / rechazo
- [ ] Lista de obras y stock desde el paquete local, con pendientes sumados y aviso «Sin señal · datos del …»
- [ ] Pantalla «Pendientes de envío» con contador en el menú, estados, «Enviar ahora», «Descartar» y «Actualizar datos»
- [ ] Pruebas de la spec (cola, espera creciente, enviador con `fetch` simulado, stock local)
- [ ] Puntos de la evaluación (30/10/2026): sesión larga con `scope=openid offline_access` y revocación al cerrar sesión; «Registrar con fecha de hoy» en un movimiento rechazado por `PERIODO_CERRADO` (UUID nuevo, fecha actual, descarta el rechazado); aviso de pendientes de otro usuario con su nombre (`usuario_nombre`)
