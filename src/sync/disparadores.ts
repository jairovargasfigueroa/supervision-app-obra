// Disparadores del envío (101, criterio 11): al volver la señal, al volver la app a primer plano y cada
// minuto mientras la app está abierta y hay pendientes. «Al registrar», «al abrir la app» y «Enviar
// ahora» los dispara la sincronización directamente (sincronizacion.tsx).
import { AppState } from 'react-native';

import { escucharConexion } from './red';

/** Cada cuánto se revisa si hay pendientes para enviar. */
export const INTERVALO_ENVIO_MS = 60_000;

type Opciones = {
  enviar: () => void;
  /** Si el usuario tiene pendientes (para el envío de cada minuto). */
  hayPendientes: () => Promise<boolean>;
  /** Cada cambio de conexión (también el primero, al empezar a escuchar). */
  alCambiarConexion?: (conectado: boolean) => void;
  intervaloMs?: number;
};

/** Empieza a escuchar; devuelve la función que lo detiene. */
export function iniciarDisparadores({
  enviar,
  hayPendientes,
  alCambiarConexion,
  intervaloMs = INTERVALO_ENVIO_MS,
}: Opciones): () => void {
  let conectado: boolean | null = null;

  const dejarRed = escucharConexion((ahora) => {
    const antes = conectado;
    conectado = ahora;
    alCambiarConexion?.(ahora);
    // Solo al pasar de sin señal a con señal: el primer aviso es el estado al abrir la app.
    if (ahora && antes === false) {
      enviar();
    }
  });

  const suscripcionApp = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      enviar();
    }
  });

  const temporizador = setInterval(() => {
    if (conectado === false) {
      return;
    }
    hayPendientes()
      .then((hay) => {
        if (hay) {
          enviar();
        }
      })
      .catch(() => undefined);
  }, intervaloMs);

  return () => {
    dejarRed();
    suscripcionApp.remove();
    clearInterval(temporizador);
  };
}
