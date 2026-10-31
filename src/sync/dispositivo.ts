// Identificador del celular (101, «Identificador del celular»): un UUID creado la primera vez que se
// abre la app y guardado en expo-secure-store. Va en el encabezado `X-Dispositivo-Id` de cada llamada
// a Sincronización, que guarda por celular el usuario, la obra y la última sincronización.
import * as SecureStore from 'expo-secure-store';

import { nuevoUuid } from '../nucleo/uuid';

export const CLAVE_DISPOSITIVO = 'sync.id_dispositivo';

let enMemoria: Promise<string> | null = null;

/** El `idDispositivo` del celular; lo crea y lo guarda la primera vez (una sola vez, aunque se pida a la vez). */
export function idDispositivo(): Promise<string> {
  enMemoria ??= (async () => {
    const guardado = await SecureStore.getItemAsync(CLAVE_DISPOSITIVO);
    if (guardado) {
      return guardado;
    }
    const nuevo = nuevoUuid();
    await SecureStore.setItemAsync(CLAVE_DISPOSITIVO, nuevo);
    return nuevo;
  })().catch((error: unknown) => {
    enMemoria = null;
    throw error;
  });
  return enMemoria;
}

/** Solo para las pruebas: olvida el valor leído (el almacenamiento simulado se vacía en cada prueba). */
export function olvidarIdDispositivo(): void {
  enMemoria = null;
}
