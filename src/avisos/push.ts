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

/**
 * Cuánto se espera a FCM por cada suscripción o baja. Sin red no contesta hasta que vuelve la red;
 * pasado este tiempo la operación se da por aplicada (queda en la cola persistente del SDK).
 */
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

// La notificación que abrió la app desde cerrada (`getInitialNotification`).
let inicial: { mensaje: Promise<MensajeFcm | null>; entregada: boolean } | null = null;

/** Solo para las pruebas: vuelve a buscar Firebase y vacía la cola y la notificación inicial. */
export function olvidarFirebase(): void {
  cargado = undefined;
  cola = Promise.resolve();
  inicial = null;
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

/**
 * Espera la operación de FCM hasta `ms`. Si contesta, `'hecho'`; si la rechaza (error real del SDK),
 * `'rechazado'`; si no contesta a tiempo (sin red), `'en-espera'`: en Android el SDK de FCM guarda las
 * suscripciones y bajas pendientes en una cola persistente y las ejecuta en orden al volver la red.
 */
function esperarOperacion(promesa: Promise<void>, ms: number): Promise<'hecho' | 'rechazado' | 'en-espera'> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<'en-espera'>((listo) => {
    temporizador = setTimeout(() => listo('en-espera'), ms);
  });
  return Promise.race([
    promesa.then(
      () => 'hecho' as const,
      () => 'rechazado' as const,
    ),
    plazo,
  ]).finally(() => clearTimeout(temporizador));
}

/**
 * Deja el celular suscrito exactamente a `nuevos` (con `cambiosDeTemas` respecto de los guardados) y
 * guarda lo que quedó. Una operación que FCM no contestó a tiempo se da por aplicada (la cola nativa
 * de FCM la ejecutará en orden al volver la red), así lo guardado coincide con lo que terminará pasando;
 * solo un rechazo real deja el tema como estaba, para reintentarlo la próxima vez.
 */
async function aplicarTemas(fb: Firebase, nuevos: readonly string[]): Promise<string[]> {
  const actuales = await temasGuardados();
  const { suscribir, quitar } = cambiosDeTemas(actuales, nuevos);
  if (suscribir.length === 0 && quitar.length === 0) {
    return actuales;
  }
  const vigentes = new Set(actuales);
  await Promise.all([
    ...quitar.map(async (tema) => {
      const resultado = await esperarOperacion(fb.modulo.unsubscribeFromTopic(fb.mensajeria, tema), ESPERA_TEMA_MS);
      if (resultado !== 'rechazado') {
        vigentes.delete(tema);
      }
    }),
    ...suscribir.map(async (tema) => {
      const resultado = await esperarOperacion(fb.modulo.subscribeToTopic(fb.mensajeria, tema), ESPERA_TEMA_MS);
      if (resultado !== 'rechazado') {
        vigentes.add(tema);
      }
    }),
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
      // La marca se guarda solo si el diálogo se mostró y el usuario respondió; si no se pudo mostrar
      // (p. ej. sin actividad en primer plano), se vuelve a pedir en la próxima actualización.
      if ((await pedirPermiso()) !== 'no-se-pudo') {
        await SecureStore.setItemAsync(CLAVE_PERMISO_PEDIDO, 'si');
      }
    }
    const permitido = await permisoConcedido();
    await aplicarTemas(fb, permitido ? temasDe(obras, roles) : []);
    return permitido ? 'activos' : 'sin-permiso';
  });
}

/**
 * Al cerrar sesión (o si la sesión vence): baja de todos los temas. Sin red, FCM las deja en su cola y
 * las ejecuta al volver la red; solo las que FCM rechaza quedan guardadas y se quitan al próximo inicio
 * de sesión (si no son del nuevo usuario).
 */
export function quitarTodosLosTemas(): Promise<void> {
  return enCola(async () => {
    const fb = firebase();
    if (fb) {
      await aplicarTemas(fb, []);
    }
  });
}

/** Lo que la app usa de un aviso recibido. */
export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** `data { tipo, obraId }` que pone n8n. */
  datos: Readonly<Record<string, unknown>>;
};

type MensajeFcm = {
  notification?: { title?: string; body?: string };
  data?: Readonly<Record<string, unknown>>;
};

function avisoDe(mensaje: MensajeFcm): Aviso {
  return {
    titulo: mensaje.notification?.title ?? '',
    cuerpo: mensaje.notification?.body ?? '',
    datos: mensaje.data ?? {},
  };
}

type Oyentes = {
  /** El usuario tocó la notificación (app cerrada o en segundo plano, criterios 3 y 5). */
  alTocar: (aviso: Aviso) => void;
  /** Llegó con la app abierta: Android no muestra la notificación (criterio 9). */
  conLaAppAbierta: (aviso: Aviso) => void;
};

/**
 * Escucha los avisos: el que abrió la app desde cerrada (`getInitialNotification`, se entrega una vez),
 * los que se tocan con la app en segundo plano (`onNotificationOpenedApp`) y los que llegan con la app
 * abierta (`onMessage`). Devuelve con qué dejar de escuchar. Sin Firebase no hace nada.
 */
export function escucharAvisos({ alTocar, conLaAppAbierta }: Oyentes): () => void {
  const fb = firebase();
  if (!fb) {
    return () => undefined;
  }
  let vigente = true;
  // Se pide una sola vez por apertura de la app y se entrega al primer oyente que siga escuchando
  // cuando llega (si el primero dejó de escuchar antes, p. ej. al volver a montarse, no se pierde).
  inicial ??= { mensaje: fb.modulo.getInitialNotification(fb.mensajeria).catch(() => null), entregada: false };
  const pedida = inicial;
  void pedida.mensaje.then((mensaje) => {
    if (mensaje && vigente && !pedida.entregada) {
      pedida.entregada = true;
      alTocar(avisoDe(mensaje));
    }
  });
  const dejarAbiertos = fb.modulo.onNotificationOpenedApp(fb.mensajeria, (mensaje) => alTocar(avisoDe(mensaje)));
  const dejarAbierta = fb.modulo.onMessage(fb.mensajeria, (mensaje) => conLaAppAbierta(avisoDe(mensaje)));
  return () => {
    vigente = false;
    dejarAbiertos();
    dejarAbierta();
  };
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
