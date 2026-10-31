// Textos de la app sin señal (101; docs/mensajes.md de la carpeta general, «App sin señal»).

/** Cerrar sesión con pendientes (criterio 18). */
export function mensajePendientesAlCerrar(n: number): string {
  return `Tienes ${n} ${n === 1 ? 'registro' : 'registros'} sin enviar; se enviarán cuando vuelvas a iniciar sesión con este usuario`;
}
