# 102 · Fotos sin señal y mala conexión · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/102-fotos-mala-conexion/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Requiere la 101 hecha.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Instalar `expo-file-system` con `npx expo install`; migración de la base local (columnas de archivo, partes y `depende_de`)
- [ ] Foto de avance a la cola: segunda compresión si pasa de 1 MB, copia a `pendientes/`, huella SHA-256 y tamaño
- [ ] Foto opcional de la nota de remisión en el ingreso (dos operaciones con `depende_de`)
- [ ] Regla de «liviana lista» y rechazo en cascada cuando la dependencia es rechazada
- [ ] `src/sync/subidor.ts`: creación o consulta de la subida, partes faltantes con tiempo máximo de 20 s, completar (30 s), reinicios, rechazos
- [ ] Enviador: livianos primero y un archivo a la vez; borrado del archivo local al confirmar o descartar
- [ ] «Pendientes de envío»: miniatura y progreso «Subiendo foto · X de Y partes»
- [ ] Pruebas de la spec
