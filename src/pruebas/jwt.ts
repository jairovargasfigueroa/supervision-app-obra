// Ayudas de prueba: un JWT con firma falsa (la app no valida la firma; eso lo hacen los servicios).
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Texto → UTF-8 → base64url sin relleno (sin `Buffer`, que no está en los tipos del proyecto). */
function aBase64Url(texto: string): string {
  const bytes = Array.from(unescape(encodeURIComponent(texto)), (c) => c.charCodeAt(0));
  let salida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a << 16) | (b << 8) | c;
    const quedan = Math.min(3, bytes.length - i);
    salida += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
    if (quedan > 1) salida += ALFABETO[(n >> 6) & 63];
    if (quedan > 2) salida += ALFABETO[n & 63];
  }
  return salida;
}

export function crearJwt(carga: Record<string, unknown>): string {
  return [
    aBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    aBase64Url(JSON.stringify(carga)),
    'firma-de-prueba',
  ].join('.');
}

/** Token de acceso como el de Keycloak para un usuario con esos roles del realm. */
export function tokenDeUsuario(
  roles: string[],
  { nombre = 'Juan Pérez', usuario = 'usuario1', exp = 4102444800 } = {},
): string {
  return crearJwt({
    sub: `id-${usuario}`,
    azp: 'app-obra',
    name: nombre,
    preferred_username: usuario,
    realm_access: { roles: ['default-roles-supervision', ...roles] },
    exp,
  });
}
