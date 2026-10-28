# App de obra: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (realm `supervision`, cliente público `app-obra` con PKCE, mediante `expo-auth-session`) | Base |
| Obras (REST) | Mis obras y partidas; registrar foto de avance | Base |
| Materiales (REST) | Catálogo, stock de la obra; registrar ingreso y salida | Base |
| Sincronización (REST) | Enviar la cola de registros; reemplaza las llamadas directas | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
