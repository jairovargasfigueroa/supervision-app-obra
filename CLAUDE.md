# App de obra

Aplicación móvil para la obra: el maestro de obra registra fotos de avance; el almacenero registra ingresos y salidas de material. El menú cambia según el rol.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** solo documentación. El proyecto del framework todavía no se generó (tarea de la fase 1 del plan general). No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- React Native
- Inicio de sesión con Keycloak (OIDC), roles `maestro` y `almacenero`
- Capa 1: base local y cola de envíos · Capa 3: TensorFlow Lite (casco y chaleco)

## Comandos

Se completan al generar el proyecto.

## Estructura prevista

```
src/
  avance/         fotos de avance por partida
  materiales/     ingresos y salidas, stock de la obra
  auth/           sesión con Keycloak
  sync/           cola local y envío (capa 1)
```

## Reglas del proyecto

- Usa REST (no GraphQL).
- Cada registro lleva un id (UUID) generado en el celular antes de enviarlo.
- Sistema base: llama directo a Obras y Materiales. Capa 1: todo pasa por el servicio de Sincronización.
- Las fotos se comprimen antes de enviarse.

## Documentación

- `docs/app.md`: qué hace, pantallas o responsabilidades, y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(alcance): descripción`). Sin coautoría ni firmas de la IA.
