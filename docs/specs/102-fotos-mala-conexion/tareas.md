# 102 · Fotos sin señal y mala conexión · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/102-fotos-mala-conexion/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Requiere la 101 hecha.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar `expo-file-system` con `npx expo install`; migración de la base local (`archivo_local`, `estado_archivo`)
- [ ] Foto de avance a la cola: compresión a 1280 px y calidad 0,7, copia a `pendientes/`, aviso con más de 100 fotos sin enviar
- [ ] `src/sync/subidor.ts`: URL de Sincronización (10 s), `PUT` a S3 (30 s), rechazos, reintentos con la espera creciente, `SUBIENDO` → `PENDIENTE` al iniciar
- [ ] Enviador: livianos primero y un archivo a la vez; borrado del archivo local al confirmar o descartar
- [ ] «Pendientes de envío»: miniatura y «Subiendo foto…»; pruebas de la spec
