# App de obra: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (realm `supervision`, cliente público `app-obra` con PKCE `S256`, mediante `expo-auth-session`): descubrimiento (`/.well-known/openid-configuration`), `authorization_endpoint` (redirect `appobra://iniciar-sesion` o, en Expo Go, `exp://…/--/iniciar-sesion`), `token_endpoint` (código y refresh token) y `end_session_endpoint` (`POST` con `client_id` y `refresh_token` al cerrar sesión) | Base |
| Obras (REST) | Mis obras y partidas; registrar foto de avance | Base |
| Materiales (REST) | Catálogo, stock de la obra; registrar ingreso y salida | Base |
| Sincronización (REST) | Enviar la cola de registros; reemplaza las llamadas directas | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
