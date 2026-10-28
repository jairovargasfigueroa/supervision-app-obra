# App de obra: contratos

**Estado: pendiente.**

## Consume

| Desde | Qué | Etapa |
|---|---|---|
| Keycloak | Inicio de sesión OIDC (cliente `app-obra` **[por confirmar]**) | Base |
| Obras (REST) | Mis obras y partidas; registrar foto de avance | Base |
| Materiales (REST) | Catálogo, stock de la obra; registrar ingreso y salida | Base |
| Sincronización (REST) | Enviar la cola de registros; reemplaza las llamadas directas | Capa 1 |

Todo registro se envía con un id (UUID) generado en el celular.
