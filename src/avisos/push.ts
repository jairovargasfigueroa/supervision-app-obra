// Avisos push (010) con Firebase Cloud Messaging: permiso, suscripción a los temas de las obras
// asignadas al cargar el paquete de datos (101) y baja de todos al cerrar sesión. Los temas suscritos
// se guardan en expo-secure-store (son del celular, no del usuario).
//
// Firebase se carga con `require` dentro de `firebase()`: en Expo Go su módulo nativo no existe y, sin
// `google-services.json`, no hay app `[DEFAULT]` (`getApps()` vacío). En los dos casos la app sigue
// igual, sin avisos.
import * as SecureStore from 'expo-secure-store';

import { pedirPermiso, permisoConcedido } from './permiso';
import { cambiosDeTemas, temasDe } from './temas';

type ModuloMensajeria = typeof import('@react-native-firebase/messaging');
type ModuloApp = typeof import('@react-native-firebase/app');

export type Firebase = {
  modulo: ModuloMensajeria;
  mensajeria: ReturnType<ModuloMensajeria['getMessaging']>;
};

const CLAVE_TEMAS = 'avisos.temas';
const CLAVE_PERMISO_PEDIDO = 'avisos.permiso-pedido';

/** Cuánto se espera a FCM por cada suscripción o baja (sin red puede no contestar). */
export const ESPERA_TEMA_MS = 10_000;

let cargado: Firebase | null | undefined;

/** Firebase Messaging si está disponible (development build con `google-services.json`), o `null`. */
export function firebase(): Firebase | null {
  if (cargado !== undefined) {
    return cargado;
  }
  try {
    const app = require('@react-native-firebase/app') as ModuloApp;
    if (app.getApps().length === 0) {
      cargado = null;
    } else {
      const modulo = require('@react-native-firebase/messaging') as ModuloMensajeria;
      cargado = { modulo, mensajeria: modulo.getMessaging() };
    }
  } catch {
    cargado = null;
  }
  if (!cargado) {
    console.info('[avisos] Firebase no está configurado en esta compilación: la app funciona sin avisos.');
  }
  return cargado;
}

// Las operaciones con los temas van de a una (suscripción al cambiar el paquete, baja al cerrar sesión).
let cola: Promise<unknown> = Promise.resolve();

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => undefined);
  return resultado;
}

/** Solo para las pruebas: vuelve a buscar Firebase y vacía la cola. */
export function olvidarFirebase(): void {
  cargado = undefined;
  cola = Promise.resolve();
}

/** Temas a los que el celular quedó suscrito (guardados en expo-secure-store). */
export async function temasGuardados(): Promise<string[]> {
  try {
    const texto = await SecureStore.getItemAsync(CLAVE_TEMAS);
    const valor: unknown = texto ? JSON.parse(texto) : [];
    return Array.isArray(valor) ? valor.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

async function guardarTemas(temas: readonly string[]): Promise<void> {
  if (temas.length === 0) {
    await SecureStore.deleteItemAsync(CLAVE_TEMAS);
  } else {
    await SecureStore.setItemAsync(CLAVE_TEMAS, JSON.stringify(temas));
  }
}

function conLimite(promesa: Promise<void>, ms: number): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('FCM no respondió a tiempo')), ms);
  });
  return Promise.race([promesa, plazo]).finally(() => clearTimeout(temporizador));
}

/**
 * Deja el celular suscrito exactamente a `nuevos` (con `cambiosDeTemas` respecto de los guardados) y
 * guarda lo que quedó. Lo que falla (sin red) queda como estaba y se reintenta la próxima vez.
 */
async function aplicarTemas(fb: Firebase, nuevos: readonly string[]): Promise<string[]> {
  const actuales = await temasGuardados();
  const { suscribir, quitar } = cambiosDeTemas(actuales, nuevos);
  if (suscribir.length === 0 && quitar.length === 0) {
    return actuales;
  }
  const vigentes = new Set(actuales);
  await Promise.allSettled([
    ...quitar.map((tema) =>
      conLimite(fb.modulo.unsubscribeFromTopic(fb.mensajeria, tema), ESPERA_TEMA_MS).then(() =>
        vigentes.delete(tema),
      ),
    ),
    ...suscribir.map((tema) =>
      conLimite(fb.modulo.subscribeToTopic(fb.mensajeria, tema), ESPERA_TEMA_MS).then(() =>
        vigentes.add(tema),
      ),
    ),
  ]);
  const resultado = [...vigentes].sort();
  await guardarTemas(resultado);
  return resultado;
}

export type EstadoAvisos = 'sin-firebase' | 'sin-permiso' | 'activos';

type Datos = {
  /** Obras asignadas del paquete de datos (101). */
  obras: readonly { id: string }[];
  /** Roles del token: `maestro` y `almacenero` dan los temas. */
  roles: readonly string[];
  /** Con señal (NetInfo): la primera vez con señal se pide el permiso. */
  conectado: boolean;
};

/**
 * Al cargar el paquete de datos (criterio 8): la primera vez que el usuario entra con señal pide el
 * permiso (criterio 7, una sola vez en el celular); con permiso, suscribe los temas de sus obras y deja
 * los que ya no corresponden. Sin permiso, se da de baja de todos (la app funciona igual, sin avisos).
 */
export function actualizarAvisos({ obras, roles, conectado }: Datos): Promise<EstadoAvisos> {
  return enCola(async () => {
    const fb = firebase();
    if (!fb) {
      return 'sin-firebase';
    }
    if (conectado && !(await SecureStore.getItemAsync(CLAVE_PERMISO_PEDIDO))) {
      await SecureStore.setItemAsync(CLAVE_PERMISO_PEDIDO, 'si');
      await pedirPermiso();
    }
    const permitido = await permisoConcedido();
    await aplicarTemas(fb, permitido ? temasDe(obras, roles) : []);
    return permitido ? 'activos' : 'sin-permiso';
  });
}

/**
 * Al cerrar sesión (o si la sesión vence): baja de todos los temas. Sin red, los que no se pudieron
 * quitar quedan guardados y se quitan al próximo inicio de sesión (si no son del nuevo usuario).
 */
export function quitarTodosLosTemas(): Promise<void> {
  return enCola(async () => {
    const fb = firebase();
    if (fb) {
      await aplicarTemas(fb, []);
    }
  });
}

/**
 * Manejador de los mensajes que llegan con la app en segundo plano o cerrada. Android ya muestra la
 * notificación (trae `notification`); no hay nada que hacer, pero sin manejador React Native Firebase
 * avisa en el registro. Se registra al cargar la app.
 */
export function prepararAvisosEnSegundoPlano(): void {
  const fb = firebase();
  if (fb) {
    fb.modulo.setBackgroundMessageHandler(fb.mensajeria, async () => undefined);
  }
}
