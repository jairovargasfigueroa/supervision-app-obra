# 004 · Registrar ingreso y salida de material · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/004-movimientos-material/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Cliente REST con token, URLs desde `extra` y reintentos 1 s / 2 s / 4 s (casi todo venía de la 001 y la 005 en `src/api/cliente.ts`: token, tiempo máximo, `X-Request-Id`, errores por `codigo` y reintentos de las consultas; se agregan `urlServicio` con `obrasUrl` y `materialesUrl`, `validar` compartido y `conReintentos` + `reintentarEnvio` para repetir un registro con el mismo `id` ante error de red, tiempo agotado o `503`)
- [x] Pantalla de obras asignadas (almacenero)
- [x] Pantallas Ingreso y Salida (UUID por formulario reutilizado en reintentos, avisos de stock superado y periodo cerrado)
- [x] Pantalla Stock con estados coloreados
- [ ] Pruebas del cliente REST
