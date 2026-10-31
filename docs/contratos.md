# App de obra: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (realm `supervision`, cliente público `app-obra` con PKCE `S256`, mediante `expo-auth-session`): descubrimiento (`/.well-known/openid-configuration`), `authorization_endpoint` (redirect `appobra://iniciar-sesion` o, en Expo Go, `exp://…/--/iniciar-sesion`), `token_endpoint` (código y refresh token) y `end_session_endpoint` (`POST` con `client_id` y `refresh_token` al cerrar sesión) | Base |
| Obras (REST) | `GET /obras` (obras asignadas: «Mis obras» y pestañas Foto de avance, Ingreso, Salida y Stock) · `GET /obras/{id}` (nombre y partidas: foto de avance y salida de material) · `POST /obras/{obraId}/fotos/url-subida` y `POST /obras/{obraId}/fotos` (foto de avance, 005). Con `Authorization: Bearer` del token de la sesión y un `X-Request-Id` por pedido; errores en Problem Details con `codigo` (textos de `docs/mensajes.md`, en `src/api/errores.ts`) | Base |
| Almacenamiento (S3) | `PUT` del archivo de la foto a la URL firmada que devuelve `url-subida` (`Content-Type: image/jpeg`, sin token; vence a los 10 min). Si responde `403` (URL vencida), la app pide otra URL con el mismo `fotoId` | Base |
| Materiales (REST) | `GET /materiales?soloActivos=true&pagina=N&tamano=100` (materiales activos, todas las páginas) · `GET /obras/{obraId}/stock` (stock de la obra con `estado` `BAJO`, `JUSTO` u `OK`) · `POST /movimientos`: desde la 101 la app ya no lo llama directo; el ingreso y la salida van como operación `MOVIMIENTO_MATERIAL` de `POST /lotes` de Sincronización, con el mismo cuerpo (`id` UUID del celular) y la misma respuesta (`superaStock` y el `stock` del material; rechazos `400`, `403`, `404 OBRA_NO_ENCONTRADA`, `422 MATERIAL_INACTIVO`, `409 PERIODO_CERRADO`). Mismo token, `X-Request-Id` y Problem Details que Obras | Base |
| Sincronización (REST, 101; contrato en `services/sincronizacion/docs/contratos.md`) | `GET /paquete-datos?obraActivaId=` (datos para trabajar sin señal: obras asignadas en ejecución con partidas y stock, y materiales activos; con `If-None-Match: "<versionDatos>"` del paquete guardado, `304` si no cambió; se guarda en la base local por usuario) · `POST /lotes` (la cola de registros; reemplaza las llamadas directas). Con el mismo token y `X-Request-Id` que Obras, y `X-Dispositivo-Id` (UUID del celular, `src/sync/dispositivo.ts`) | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
