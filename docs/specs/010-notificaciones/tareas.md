# 010 · Notificaciones · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/010-notificaciones/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Los avisos *push* solo se prueban en una *development build* de Android (no en Expo Go). La bandeja se prueba en cualquiera.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] `npx expo install expo-notifications expo-constants`; pasar `app.json` a `app.config.ts` con `android.package` (`bo.supervision.appobra` salvo que la 301 haya fijado otro), `googleServicesFile` solo si existe el archivo o `GOOGLE_SERVICES_JSON`, plugin `expo-notifications` (color y canal `avisos`) y `extra.notificacionesUrl`; `google-services.json` en `.gitignore`
- [ ] `src/notificaciones/api.ts` (contador, lista paginada, marcar una y todas) y `rutas-notificacion.ts`; pruebas
- [ ] Pestaña «Avisos» con `Badge` («9+»), lista, «Ver más», *pull to refresh*, «Marcar todas como leídas», sin señal, vacío y error
- [ ] `src/notificaciones/push.ts`: canal `avisos`, `setNotificationHandler` sin aviso en primer plano (*snackbar* y contador), Expo Go → sin *push*, permiso una sola vez, `getDevicePushTokenAsync` → `POST /dispositivos`, `addPushTokenListener`, fallo sin `google-services.json` registrado en el log; pruebas con `expo-notifications` simulado
- [ ] Toque en la notificación (con la app abierta y cerrada): marcar leída y navegar con `rutaDeNotificacion` o a «Avisos»; baja del dispositivo al cerrar sesión con 2 s máximo
- [ ] Pruebas de la spec; README con cómo crear la *development build* con `google-services.json`
