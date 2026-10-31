# App de obra: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (realm `supervision`, cliente público `app-obra` con PKCE `S256`, mediante `expo-auth-session`): descubrimiento (`/.well-known/openid-configuration`), `authorization_endpoint` (redirect `appobra://iniciar-sesion` o, en Expo Go, `exp://…/--/iniciar-sesion`), `token_endpoint` (código y refresh token) y `end_session_endpoint` (`POST` con `client_id` y `refresh_token` al cerrar sesión) | Base |
| Obras (REST) | `GET /obras/{id}` (nombre y partidas: foto de avance) · `POST /obras/{obraId}/fotos/url-subida` y `POST /obras/{obraId}/fotos` (foto de avance, 005). Con `Authorization: Bearer` del token de la sesión y un `X-Request-Id` por pedido; errores en Problem Details con `codigo` (textos de `docs/mensajes.md`, en `src/api/errores.ts`) | Base |
| Almacenamiento (S3) | `PUT` del archivo de la foto a la URL firmada que devuelve `url-subida` (`Content-Type: image/jpeg`, sin token; vence a los 10 min). Si responde `403` (URL vencida), la app pide otra URL con el mismo `fotoId` | Base |
| Materiales (REST) | Desde la 101 la app no llama directo a Materiales: los materiales activos y el stock de cada obra (con `estado` `BAJO`, `JUSTO` u `OK`) llegan en `GET /paquete-datos` de Sincronización, que los pide a `GET /materiales` y `GET /obras/{obraId}/stock`; las obras asignadas en ejecución y sus partidas también («Mis obras», pestañas, ingreso, salida y stock), pedidas a `GET /obras` y `GET /obras/{id}` de Obras. `POST /movimientos`: el ingreso y la salida van como operación `MOVIMIENTO_MATERIAL` de `POST /lotes` de Sincronización, con el mismo cuerpo (`id` UUID del celular) y la misma respuesta (`superaStock` y el `stock` del material; rechazos `400`, `403`, `404 OBRA_NO_ENCONTRADA`, `422 MATERIAL_INACTIVO`, `409 PERIODO_CERRADO`). | Base · Capa 1 |
| Sincronización (REST, 101; contrato en `services/sincronizacion/docs/contratos.md`) | `GET /paquete-datos?obraActivaId=` (datos para trabajar sin señal: obras asignadas en ejecución con partidas y stock, y materiales activos; con `If-None-Match: "<versionDatos>"` del paquete guardado, `304` si no cambió; se guarda en la base local por usuario) · `POST /lotes` (la cola de registros; reemplaza las llamadas directas). Con el mismo token y `X-Request-Id` que Obras, y `X-Dispositivo-Id` (UUID del celular, `src/sync/dispositivo.ts`) | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
