// Lectura del token de acceso de Keycloak (JWT). Solo decodifica la carga para mostrar el usuario y
// elegir el menú: la firma la validan los servicios, no la app.

export type Usuario = {
  /** `sub` del token. */
  id: string;
  /** `name` del token (o el nombre de usuario si no tiene nombre). */
  nombre: string;
  /** `preferred_username`. */
  usuario: string;
  /** `realm_access.roles` completo (los que cuentan en la app se eligen con `rolesEfectivos`). */
  roles: string[];
};

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ERROR_FORMATO = 'El token no tiene un formato válido';

/** Base64url → bytes, sin depender de `atob` ni `Buffer` (Hermes y Node dan lo mismo). */
function bytesDeBase64Url(texto: string): number[] {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let acumulado = 0;
  let bits = 0;
  for (const caracter of base64) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) {
      throw new Error(ERROR_FORMATO);
    }
    acumulado = ((acumulado << 6) | valor) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >> bits) & 0xff);
    }
  }
  return bytes;
}

/** Bytes UTF-8 → texto (los nombres llevan tildes y eñes). */
function textoDeUtf8(bytes: number[]): string {
  let texto = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let largo = 1;
    let puntoCodigo = b;
    if (b >= 0xf0) {
      largo = 4;
      puntoCodigo = b & 0x07;
    } else if (b >= 0xe0) {
      largo = 3;
      puntoCodigo = b & 0x0f;
    } else if (b >= 0xc0) {
      largo = 2;
      puntoCodigo = b & 0x1f;
    }
    for (let j = 1; j < largo; j++) {
      puntoCodigo = (puntoCodigo << 6) | ((bytes[i + j] ?? 0) & 0x3f);
    }
    texto += String.fromCodePoint(puntoCodigo);
    i += largo;
  }
  return texto;
}

/** Carga (payload) de un JWT. */
export function decodificarCargaJwt(jwt: string): Record<string, unknown> {
  const partes = jwt.split('.');
  if (partes.length !== 3) {
    throw new Error(ERROR_FORMATO);
  }
  let carga: unknown;
  try {
    carga = JSON.parse(textoDeUtf8(bytesDeBase64Url(partes[1])));
  } catch {
    throw new Error(ERROR_FORMATO);
  }
  if (typeof carga !== 'object' || carga === null) {
    throw new Error(ERROR_FORMATO);
  }
  return carga as Record<string, unknown>;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');

/** Usuario del token de acceso. */
export function usuarioDelToken(accessToken: string): Usuario {
  const carga = decodificarCargaJwt(accessToken);
  const accesoRealm = carga.realm_access as { roles?: unknown } | undefined;
  const roles = Array.isArray(accesoRealm?.roles)
    ? accesoRealm.roles.filter((rol): rol is string => typeof rol === 'string')
    : [];
  const usuario = texto(carga.preferred_username);
  return {
    id: texto(carga.sub),
    nombre: texto(carga.name).trim() || usuario,
    usuario,
    roles,
  };
}

/** `exp` del token (segundos desde 1970), si lo tiene. */
export function vencimientoDelToken(jwt: string): number | undefined {
  const exp = decodificarCargaJwt(jwt).exp;
  return typeof exp === 'number' ? exp : undefined;
}
