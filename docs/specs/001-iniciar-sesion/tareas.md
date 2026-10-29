# 001 · Iniciar sesión y paso entre aplicaciones · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/001-iniciar-sesion/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar con `npx expo install`: `expo-router`, `expo-auth-session`, `expo-secure-store`, `expo-crypto`; configurar `scheme: appobra`
- [x] Migrar la entrada a Expo Router (`src/app/`) con grupos `(auth)` y `(app)`
- [ ] Inicio de sesión con PKCE, guardado seguro de tokens y renovación
- [ ] Pestañas según rol (maestro / almacenero) y pantalla «No tienes acceso»
- [ ] Cerrar sesión (borra tokens y llama al end_session_endpoint)
