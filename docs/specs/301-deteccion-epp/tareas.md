# 301 · Detección de casco y chaleco · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/301-deteccion-epp/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar con `npx expo install` `react-native-fast-tflite` 3, `expo-dev-client`, `jpeg-js` y `buffer`; config plugin en `app.json`, `tflite` en `metro.config.js`; generar y probar la *development build* en Android (01/11/2026: `react-native-fast-tflite` 3.0.1 con `react-native-nitro-modules` 0.37.1; `prebuild` y `assembleDebug` para `arm64-v8a` compilan; sin celular conectado, la instalación queda para la prueba manual; pasos en el README)
- [ ] Agregar `assets/modelos/` (`efficientdet_lite0.tflite`, `clasificador_epp.tflite`, `epp.json`) y confirmar el orden de salidas y el índice de «person» del detector
- [x] Módulo `src/avance/epp/`: carga de modelos, preparación de la imagen (320×320 y recortes 224×224), conteo con umbrales y tiempo límite de 5 s; pruebas de las funciones puras y de `analizarFoto` con modelos simulados
- [x] Pantalla de foto: «Analizando…», resumen, aviso no bloqueante y recuadros sobre la vista previa; mensaje si el análisis falla
- [x] Pantalla `obras/[id]/control-seguridad`: botón «Control de seguridad» en el detalle de la obra (rol `maestro`), mismo análisis, resumen, aviso y recuadros; «Otro control»; la foto y el resultado no se envían ni se guardan; pruebas
- [x] Enviar `deteccion` en `datos` de la operación `FOTO_AVANCE` de la cola (102), no en un `POST` directo a Obras (con la capa 1 la app envía por Sincronización, que la reenvía a `POST /obras/{obraId}/fotos`), y conservarla en los reintentos con el mismo `fotoId`; pruebas de la cola y del envío
- [ ] Prueba manual en un Android de gama media con 5 fotos de referencia (tiempos y conteos anotados aquí)
