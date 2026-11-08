// Estado de la red con NetInfo (101, «red.ts»): hay conexión cuando NetInfo dice `isConnected` y no
// dice que internet no se alcanza (`isInternetReachable` es `null` mientras lo comprueba).
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function hayConexionEn(estado: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

/** Si ahora hay conexión. */
export async function hayConexion(): Promise<boolean> {
  return hayConexionEn(await NetInfo.fetch());
}

/** Avisa cada cambio de conexión (`true` / `false`); devuelve la función para dejar de escuchar. */
export function escucharConexion(alCambiar: (conectado: boolean) => void): () => void {
  return NetInfo.addEventListener((estado) => alCambiar(hayConexionEn(estado)));
}
