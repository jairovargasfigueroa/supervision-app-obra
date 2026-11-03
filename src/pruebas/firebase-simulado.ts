// @react-native-firebase/app y @react-native-firebase/messaging simulados (010), más el permiso de
// notificaciones (src/avisos/permiso.ts). jest.setup.ts los instala para todas las pruebas y los
// reinicia antes de cada una: Firebase configurado, permiso todavía no pedido (el usuario lo concede
// al pedírselo) y sin temas.
export type MensajeSimulado = {
  messageId?: string;
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};
type Oyente = (mensaje: MensajeSimulado) => unknown;

const estado = {
  configurado: true,
  temas: new Set<string>(),
  /** Temas cuya suscripción o baja falla (sin red, FCM caído). */
  temasQueFallan: new Set<string>(),
  todosFallan: false,
  alAbrirse: new Set<Oyente>(),
  enPrimerPlano: new Set<Oyente>(),
  inicial: null as MensajeSimulado | null,
  manejadorFondo: null as ((mensaje: MensajeSimulado) => Promise<unknown>) | null,
  permiso: { concedido: false, alPedir: true, pedidos: 0 },
};

const MENSAJERIA = { app: { name: '[DEFAULT]' } };

function exigirApp(): void {
  if (!estado.configurado) {
    throw new Error("No Firebase App '[DEFAULT]' has been created - call firebase.initializeApp()");
  }
}

function operarTema(tema: string, operacion: () => void): Promise<void> {
  if (estado.todosFallan || estado.temasQueFallan.has(tema)) {
    return Promise.reject(new Error('SERVICE_NOT_AVAILABLE'));
  }
  operacion();
  return Promise.resolve();
}

export const moduloApp = {
  getApps: () => (estado.configurado ? [{ name: '[DEFAULT]' }] : []),
};

export const moduloMensajeria = {
  getMessaging: () => {
    exigirApp();
    return MENSAJERIA;
  },
  subscribeToTopic: jest.fn((_m: unknown, tema: string) => operarTema(tema, () => estado.temas.add(tema))),
  unsubscribeFromTopic: jest.fn((_m: unknown, tema: string) =>
    operarTema(tema, () => estado.temas.delete(tema)),
  ),
  onMessage: (_m: unknown, oyente: Oyente) => {
    estado.enPrimerPlano.add(oyente);
    return () => {
      estado.enPrimerPlano.delete(oyente);
    };
  },
  onNotificationOpenedApp: (_m: unknown, oyente: Oyente) => {
    estado.alAbrirse.add(oyente);
    return () => {
      estado.alAbrirse.delete(oyente);
    };
  },
  getInitialNotification: jest.fn(async () => {
    // Como en Android: se entrega una sola vez.
    const mensaje = estado.inicial;
    estado.inicial = null;
    return mensaje;
  }),
  setBackgroundMessageHandler: jest.fn(
    (_m: unknown, manejador: (mensaje: MensajeSimulado) => Promise<unknown>) => {
      estado.manejadorFondo = manejador;
    },
  ),
};

export const moduloPermiso = {
  permisoConcedido: jest.fn(async () => estado.permiso.concedido),
  pedirPermiso: jest.fn(async () => {
    estado.permiso.pedidos += 1;
    estado.permiso.concedido = estado.permiso.alPedir;
    return estado.permiso.concedido;
  }),
};

export function reiniciarFirebase(): void {
  estado.configurado = true;
  estado.temas.clear();
  estado.temasQueFallan.clear();
  estado.todosFallan = false;
  estado.alAbrirse.clear();
  estado.enPrimerPlano.clear();
  estado.inicial = null;
  estado.manejadorFondo = null;
  estado.permiso = { concedido: false, alPedir: true, pedidos: 0 };
  moduloMensajeria.subscribeToTopic.mockClear();
  moduloMensajeria.unsubscribeFromTopic.mockClear();
  moduloMensajeria.getInitialNotification.mockClear();
  moduloMensajeria.setBackgroundMessageHandler.mockClear();
  moduloPermiso.permisoConcedido.mockClear();
  moduloPermiso.pedirPermiso.mockClear();
}

/** Sin `google-services.json` (o en Expo Go): no hay app de Firebase. */
export function simularSinFirebase(): void {
  estado.configurado = false;
}

/**
 * Permiso de notificaciones: `concedido` es el estado actual (al empezar, todavía no se pidió) y
 * `alPedir`, lo que responde el usuario en el diálogo.
 */
export function simularPermiso(permiso: { concedido?: boolean; alPedir?: boolean }): void {
  Object.assign(estado.permiso, permiso);
}

export function vecesQueSePidioPermiso(): number {
  return estado.permiso.pedidos;
}

/** Temas a los que está suscrito el celular en FCM. */
export function temasEnFirebase(): string[] {
  return [...estado.temas].sort();
}

/** Hace fallar la suscripción y la baja de esos temas, o de todos si no se dan. */
export function fallarTemas(...temas: string[]): void {
  if (temas.length === 0) {
    estado.todosFallan = true;
  } else {
    temas.forEach((tema) => estado.temasQueFallan.add(tema));
  }
}

export function repararTemas(): void {
  estado.todosFallan = false;
  estado.temasQueFallan.clear();
}

/** Llega un aviso con la app abierta (`onMessage`). */
export function recibirEnPrimerPlano(mensaje: MensajeSimulado): void {
  for (const oyente of [...estado.enPrimerPlano]) {
    oyente(mensaje);
  }
}

/** El usuario toca la notificación con la app en segundo plano (`onNotificationOpenedApp`). */
export function tocarNotificacion(mensaje: MensajeSimulado): void {
  for (const oyente of [...estado.alAbrirse]) {
    oyente(mensaje);
  }
}

/** La app se abre desde cerrada tocando la notificación (`getInitialNotification`). */
export function abrirDesdeNotificacion(mensaje: MensajeSimulado): void {
  estado.inicial = mensaje;
}

export function hayManejadorEnSegundoPlano(): boolean {
  return estado.manejadorFondo !== null;
}
