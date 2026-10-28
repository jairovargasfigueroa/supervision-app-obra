# 601 · Contenedores y CI/CD · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/601-contenedores-ci/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Leer las URL de Keycloak y de Sincronización de `EXPO_PUBLIC_KEYCLOAK_URL` y `EXPO_PUBLIC_SINCRONIZACION_URL` (propuestos; desde la 101 y la 102 la app no llama directo a Obras ni a Materiales), con valores de desarrollo por defecto
- [ ] `.github/workflows/ci-cd.yml`: `npx tsc --noEmit`, pruebas y `npx expo-doctor` en cada PR y *push* (sin imagen ni despliegue)
- [ ] `eas.json` con el perfil `preview` (APK de distribución interna; *development build* por `react-native-fast-tflite` de la 301) y workflow manual `version-instalable.yml` con `eas build` y el secreto `EXPO_TOKEN`
