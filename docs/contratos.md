# App de obra: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (realm `supervision`, cliente público `app-obra` con PKCE `S256`, mediante `expo-auth-session`): descubrimiento (`/.well-known/openid-configuration`), `authorization_endpoint` (redirect `appobra://iniciar-sesion` o, en Expo Go, `exp://…/--/iniciar-sesion`), `token_endpoint` (código y refresh token) y `end_session_endpoint` (`POST` con `client_id` y `refresh_token` al cerrar sesión) | Base |
| Obras (REST) | `GET /obras` (obras asignadas: «Mis obras» y pestaña Foto de avance) · `GET /obras/{id}` (partidas) · `POST /obras/{obraId}/fotos/url-subida` y `POST /obras/{obraId}/fotos` (foto de avance, 005). Con `Authorization: Bearer` del token de la sesión y un `X-Request-Id` por pedido; errores en Problem Details con `codigo` (textos de `docs/mensajes.md`, en `src/api/errores.ts`) | Base |
| Almacenamiento (S3) | `PUT` del archivo de la foto a la URL firmada que devuelve `url-subida` (`Content-Type: image/jpeg`, sin token; vence a los 10 min). Si responde `403` (URL vencida), la app pide otra URL con el mismo `fotoId` | Base |
| Materiales (REST) | Catálogo, stock de la obra; registrar ingreso y salida | Base |
| Sincronización (REST) | Enviar la cola de registros; reemplaza las llamadas directas | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
