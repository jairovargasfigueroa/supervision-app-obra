// expo-secure-store simulado en memoria (jest.setup.ts lo instala para todas las pruebas).
const almacen = new Map<string, string>();

export async function getItemAsync(clave: string): Promise<string | null> {
  return almacen.get(clave) ?? null;
}

export async function setItemAsync(clave: string, valor: string): Promise<void> {
  almacen.set(clave, valor);
}

export async function deleteItemAsync(clave: string): Promise<void> {
  almacen.delete(clave);
}

/** Contenido actual, para comprobarlo en las pruebas. */
export function contenidoSecureStore(): Record<string, string> {
  return Object.fromEntries(almacen);
}

export function reiniciarSecureStore(): void {
  almacen.clear();
}
