// Último usuario que inició sesión en el celular (101, «Sesión sin señal»): nombre y roles guardados en
// expo-secure-store para entrar sin señal aunque el token haya vencido (criterio 6).
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import type { Usuario } from './token';

export const CLAVE_USUARIO_LOCAL = 'sesion.usuario_local';

const esquemaUsuarioLocal = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  usuario: z.string(),
  roles: z.array(z.string()),
});

export async function guardarUsuarioLocal(usuario: Usuario): Promise<void> {
  const { id, nombre, usuario: nombreUsuario, roles } = usuario;
  await SecureStore.setItemAsync(
    CLAVE_USUARIO_LOCAL,
    JSON.stringify({ id, nombre, usuario: nombreUsuario, roles }),
  );
}

/** El usuario guardado, o `null` si no hay (o lo guardó otra versión de la app con otra forma). */
export async function leerUsuarioLocal(): Promise<Usuario | null> {
  const texto = await SecureStore.getItemAsync(CLAVE_USUARIO_LOCAL);
  if (!texto) {
    return null;
  }
  try {
    const resultado = esquemaUsuarioLocal.safeParse(JSON.parse(texto));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export async function borrarUsuarioLocal(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_USUARIO_LOCAL);
}
