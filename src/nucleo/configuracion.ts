// Configuración de la app: app.json → extra, validada con Zod. En desarrollo todo apunta a localhost
// (el celular llega por adb reverse; ver CLAUDE.md, «Celular en desarrollo»).
import Constants from 'expo-constants';
import { z } from 'zod';

const esquemaConfiguracion = z.object({
  keycloakUrl: z.url(),
  realm: z.string().min(1),
  clientId: z.string().min(1),
  obrasUrl: z.url(),
  materialesUrl: z.url(),
  /** Sincronización (capa 1, puerto 8084): por ella pasa todo lo que registra la app. */
  sincronizacionUrl: z.url(),
});

export type Configuracion = z.infer<typeof esquemaConfiguracion>;

/** Valida el `extra` de app.json; falla con un mensaje claro si falta algo. */
export function leerConfiguracion(extra: unknown): Configuracion {
  const resultado = esquemaConfiguracion.safeParse(extra);
  if (!resultado.success) {
    throw new Error(`app.json → extra no es válido: ${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}

let enMemoria: Configuracion | null = null;

/** Configuración de app.json (se lee una vez). */
export function configuracion(): Configuracion {
  enMemoria ??= leerConfiguracion(Constants.expoConfig?.extra);
  return enMemoria;
}

/** Emisor (`iss`) del realm: `http://localhost:8080/realms/supervision`. */
export function emisor(config: Pick<Configuracion, 'keycloakUrl' | 'realm'>): string {
  return `${config.keycloakUrl.replace(/\/+$/, '')}/realms/${config.realm}`;
}
