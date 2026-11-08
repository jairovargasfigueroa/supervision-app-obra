// Tokens guardados en el almacenamiento cifrado del celular (expo-secure-store: Keystore en Android,
// Keychain en iOS). Cada valor va en su propia clave para no acercarse al límite de tamaño por valor.
import * as SecureStore from 'expo-secure-store';

export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  /** Segundos desde 1970 en que vence el token de acceso. */
  venceEn: number;
};

export const CLAVES_TOKENS = {
  acceso: 'sesion.token_acceso',
  renovacion: 'sesion.token_renovacion',
  vencimiento: 'sesion.vence_en',
} as const;

export async function guardarTokens(tokens: Tokens): Promise<void> {
  await SecureStore.setItemAsync(CLAVES_TOKENS.acceso, tokens.accessToken);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(CLAVES_TOKENS.renovacion, tokens.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(CLAVES_TOKENS.renovacion);
  }
  await SecureStore.setItemAsync(CLAVES_TOKENS.vencimiento, String(tokens.venceEn));
}

/** Tokens guardados, o `null` si no hay sesión guardada (o quedó a medias). */
export async function leerTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken, vencimiento] = await Promise.all([
    SecureStore.getItemAsync(CLAVES_TOKENS.acceso),
    SecureStore.getItemAsync(CLAVES_TOKENS.renovacion),
    SecureStore.getItemAsync(CLAVES_TOKENS.vencimiento),
  ]);
  const venceEn = Number(vencimiento);
  if (!accessToken || !vencimiento || !Number.isFinite(venceEn)) {
    return null;
  }
  return { accessToken, refreshToken: refreshToken ?? undefined, venceEn };
}

export async function borrarTokens(): Promise<void> {
  await Promise.all(Object.values(CLAVES_TOKENS).map((clave) => SecureStore.deleteItemAsync(clave)));
}
