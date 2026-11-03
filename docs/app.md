# App de obra: qué hace

## Pantallas

| Pantalla | Rol | Caso de uso | Etapa |
|---|---|---|---|
| Mis obras | Maestro, almacenero | — | Base |
| Registrar foto de avance (partida, foto) | Maestro | Registrar foto de avance | Base |
| Registrar ingreso de material (material, cantidad, nota de remisión) | Almacenero | Registrar ingreso de material | Base |
| Registrar salida de material (material, cantidad, partida) | Almacenero | Registrar salida de material | Base |
| Stock de la obra | Almacenero | — | Base |
| Pendientes de envío | Maestro, almacenero | Sincronización | Capa 1 |
| Diario de obra (fecha, clima y texto del día; últimos 30 días) | Maestro | Registrar entrada del diario | Capa 1 |
| Aviso de casco y chaleco en la foto (spec 301) | Maestro | IA en el dispositivo | Capa 3 |
| Control de seguridad: foto de la cuadrilla analizada en el celular, sin enviarla ni guardarla (spec 301) | Maestro | IA en el dispositivo | Capa 3 |

El menú muestra solo las opciones del rol del usuario.

### Avisos al celular (010)

No es una pantalla: avisos *push* de Firebase Cloud Messaging que envía n8n, sin bandeja ni historial.

- **Stock bajo** (almacenero): «Stock bajo: {material}» con «{obra}: quedan {cantidad} {unidad} (mínimo {mínimo})». Al tocarlo abre el stock de la obra (`obras/[id]/stock`).
- **Diario pendiente** (maestro, 18:00 de La Paz si no hay diario de ese día): «Diario pendiente: {obra}» con «Todavía no registraste el diario de hoy. Si ya lo registraste sin señal, se enviará al volver la señal.». Al tocarlo abre el diario de la obra (`obras/[id]/diario`).
- La primera vez que el usuario entra con señal, la app pide permiso para mostrar notificaciones (Android 13 o posterior); si lo niega, funciona igual, sin avisos.
- La app recibe los avisos de sus obras asignadas (las del paquete de datos de la 101): se suscribe a los temas `obra-{obraId}-almacenero` u `obra-{obraId}-maestro` según su rol, deja los de una obra que ya no tiene al actualizar los datos y todos al cerrar sesión.
- Con la app abierta, el aviso se muestra como mensaje breve (`Snackbar`) con «Ver», que abre la misma pantalla.
- Solo en la *development build* y la versión instalable de Android compiladas con `google-services.json` (no en Expo Go ni en iOS).

### Pendientes de envío (101)

Pestaña «Pendientes» (maestro y almacenero) con un contador de los registros que todavía no llegaron al servidor (`Pendiente` y `Enviando`). La pantalla «Pendientes de envío» lista los registros guardados en el celular del usuario de la sesión, agrupados por estado (`Pendiente`, `Enviando`, `Rechazado`, `Enviado`), cada uno con su descripción corta («Salida · 12,5 bolsas de Cemento IP-30 · P-01»), la fecha y hora de registro y su estado; los `Rechazado` muestran el motivo. Botones «Enviar ahora» (solo con señal y con pendientes) y «Actualizar datos» (solo con señal; vuelve a pedir el paquete de datos). «Descartar» en `Pendiente` y `Rechazado`, con la confirmación «¿Descartar este registro? No se enviará y no se podrá recuperar.». Las fotos de avance (102) muestran su miniatura (del archivo guardado en el celular), la partida y el estado; mientras el archivo se sube, «Subiendo foto…». Los `Enviado` se ven 24 horas y luego se borran del celular. Un movimiento `Rechazado` por periodo cerrado ofrece además «Registrar con fecha de hoy» (otro registro con la fecha actual; el rechazado se descarta). Si en el celular hay registros sin enviar de otro usuario: «Hay N registros de {nombre} sin enviar; se enviarán cuando esa persona vuelva a iniciar sesión». Sin registros: «No hay registros pendientes de envío.».

Referencia visual: el prototipo HTML de la carpeta general.

## Qué no hace

- No elabora planillas ni ve montos.
- No edita el catálogo de materiales.
