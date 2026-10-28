# 301 · Detección de casco y chaleco · tareas de `mobile/app-obra`

Requisitos y diseño: `docs/specs/301-deteccion-epp/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Instalar con `npx expo install` `react-native-fast-tflite` 3, `expo-dev-client`, `jpeg-js` y `buffer`; config plugin en `app.json`, `tflite` en `metro.config.js`; generar y probar la *development build* en Android
- [ ] Agregar `assets/modelos/` (`efficientdet_lite0.tflite`, `clasificador_epp.tflite`, `epp.json`) y confirmar el orden de salidas y el índice de «person» del detector
- [ ] Módulo `src/avance/epp/`: carga de modelos, preparación de la imagen (320×320 y recortes 224×224), conteo con umbrales y tiempo límite de 5 s; pruebas de las funciones puras y de `analizarFoto` con modelos simulados
- [ ] Pantalla de foto: «Analizando…», resumen, aviso no bloqueante y recuadros sobre la vista previa; mensaje si el análisis falla
- [ ] Enviar `deteccion` en `POST /obras/{obraId}/fotos` y conservarla en los reintentos con el mismo `fotoId`; pruebas del cliente
- [ ] Prueba manual en un Android de gama media con 5 fotos de referencia (tiempos y conteos anotados aquí)
