// Errores de las llamadas a los servicios y su texto para el usuario (docs/mensajes.md de la carpeta
// general). Solo están los códigos que la app puede recibir hoy (004, 005, 101 a 103 y genéricos); un código que no
// está aquí se muestra con el genérico de su estado HTTP.

/** Qué falló en una llamada. */
export type FalloApi =
  /** El servicio respondió con un error (Problem Details con `codigo`). */
  | { tipo: 'http'; estado: number; codigo: string; requestId?: string }
  /** No hubo respuesta: sin señal o el servidor no está. */
  | { tipo: 'red' }
  /** No llegó la respuesta dentro del tiempo máximo de la app. */
  | { tipo: 'tiempo' }
  /** La sesión terminó (no hay token); la app vuelve sola al inicio de sesión. */
  | { tipo: 'sin-sesion' }
  /** El servicio respondió algo que no es lo del contrato. */
  | { tipo: 'respuesta-invalida' }
  /** El almacenamiento (S3) rechazó la subida con la URL firmada. */
  | { tipo: 'subida'; estado: number }
  /** No se pudo leer el archivo de la foto en el celular. */
  | { tipo: 'archivo' };

export class ErrorApi extends Error {
  constructor(readonly fallo: FalloApi) {
    super(fallo.tipo === 'http' ? `${fallo.estado} ${fallo.codigo}` : fallo.tipo);
    this.name = 'ErrorApi';
  }
}

/** Código genérico de cada estado cuando el cuerpo no trae uno (convenciones, «Errores REST»). */
const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'DATOS_INVALIDOS',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  413: 'ARCHIVO_DEMASIADO_GRANDE',
  429: 'DEMASIADAS_PETICIONES',
  500: 'ERROR_INTERNO',
  503: 'SERVICIO_NO_DISPONIBLE',
  504: 'TIEMPO_AGOTADO',
};

export function codigoGenerico(estado: number): string {
  return CODIGO_POR_ESTADO[estado] ?? (estado >= 500 ? 'ERROR_INTERNO' : 'DATOS_INVALIDOS');
}

export const MENSAJES = {
  DATOS_INVALIDOS: 'Algunos datos no son válidos. Revisa los campos marcados.',
  NO_AUTENTICADO: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  SIN_PERMISO: 'No tienes permiso para hacer esta acción.',
  RUTA_NO_ENCONTRADA: 'No encontramos lo que buscas. Puede que ya no exista o que no tengas acceso.',
  ARCHIVO_DEMASIADO_GRANDE: 'El envío supera el tamaño permitido.',
  DEMASIADAS_PETICIONES: 'Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.',
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo; si se repite, avisa a soporte.',
  SERVICIO_NO_DISPONIBLE:
    'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
  TIEMPO_AGOTADO: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  OBRA_NO_ENCONTRADA: 'Obra no encontrada',
  PARTIDA_NO_ES_DE_LA_OBRA: 'La partida elegida no pertenece a esta obra.',
  CLAVE_ARCHIVO_INVALIDA: 'No se pudo asociar el archivo a este registro.',
  PAGINACION_INVALIDA: 'No se pudo cargar la lista. Recarga la página.',
  MATERIAL_INACTIVO: 'El material está desactivado; no se puede usar en movimientos ni fijarle un mínimo.',
  // Sin el periodo (docs/mensajes.md, «Marcadores»); con el dato, `mensajePeriodoCerrado`.
  PERIODO_CERRADO: 'El periodo ya está cerrado',
  // Sincronización (101): rechazos de un registro de la cola.
  LOTE_INVALIDO: 'No se pudieron enviar los registros pendientes.',
  TIPO_OPERACION_DESCONOCIDO: 'Este tipo de registro no se reconoce. Actualiza la app.',
  OPERACION_INVALIDA: 'El registro está incompleto y no se pudo enviar.',
  OPERACION_AJENA: 'Este registro lo envió otro usuario y no se puede enviar con tu sesión.',
  // Diario de obra (103).
  DIARIO_DIA_YA_REGISTRADO: 'Ya existe una entrada del diario para ese día',
  FECHA_DIARIO_INVALIDA: 'La fecha no es válida para esta obra',
  OBRA_NO_EN_EJECUCION: 'La obra no está en ejecución',
  // Código de la app (102): el archivo de la foto ya no está en el celular; se descarta y se toma otra.
  FOTO_NO_DISPONIBLE: 'La foto no se pudo preparar para el envío.',
} as const satisfies Record<string, string>;

/** Genéricos de los estados que siempre traen código propio, para un código que la app no conoce. */
const GENERICO_POR_ESTADO: Record<number, string> = {
  404: MENSAJES.RUTA_NO_ENCONTRADA,
  409: 'Los datos cambiaron mientras trabajabas. Recarga para ver la última versión.',
  422: 'No se pudo completar la operación porque no cumple una regla del sistema.',
};

/** `PERIODO_CERRADO` con el periodo del movimiento (004, criterio 7): «El periodo 2026-11 ya está cerrado». */
export function mensajePeriodoCerrado(periodo: string): string {
  return `El periodo ${periodo} ya está cerrado`;
}

export const MENSAJE_SIN_CONEXION =
  'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.';
/** `SUBIDA_INVALIDA` en docs/mensajes.md: la foto no está lista para enviarse. */
export const MENSAJE_FOTO_NO_PREPARADA = 'La foto no se pudo preparar para el envío.';
export const MENSAJE_TIEMPO_CLIENTE =
  'La respuesta está tardando demasiado. Revisa tu conexión e intenta de nuevo.';

function mensajeHttp(estado: number, codigo: string): string {
  if (codigo in MENSAJES) {
    return MENSAJES[codigo as keyof typeof MENSAJES];
  }
  const generico = GENERICO_POR_ESTADO[estado];
  if (generico) {
    return generico;
  }
  const codigoDelEstado = codigoGenerico(estado);
  return MENSAJES[codigoDelEstado as keyof typeof MENSAJES] ?? MENSAJES.ERROR_INTERNO;
}

/** Texto para el usuario de un fallo (nunca muestra nombres técnicos ni el `codigo`). */
export function mensajeDeFallo(fallo: FalloApi): string {
  switch (fallo.tipo) {
    case 'http':
      return mensajeHttp(fallo.estado, fallo.codigo);
    case 'red':
      return MENSAJE_SIN_CONEXION;
    case 'tiempo':
      return MENSAJE_TIEMPO_CLIENTE;
    case 'sin-sesion':
      return MENSAJES.NO_AUTENTICADO;
    case 'respuesta-invalida':
    case 'subida':
      return MENSAJES.ERROR_INTERNO;
    case 'archivo':
      return MENSAJE_FOTO_NO_PREPARADA;
  }
}

/** Cualquier error (de la API o inesperado) como `FalloApi`. */
export function falloDe(error: unknown): FalloApi {
  return error instanceof ErrorApi ? error.fallo : { tipo: 'respuesta-invalida' };
}

export function mensajeDeError(error: unknown): string {
  return mensajeDeFallo(falloDe(error));
}

/**
 * Vale la pena repetir el mismo pedido: sin señal, tiempo agotado, servicio caído o saturado. Un
 * `4xx` (datos, permiso, regla del negocio) daría lo mismo otra vez.
 */
export function esReintentable(fallo: FalloApi): boolean {
  if (fallo.tipo === 'red' || fallo.tipo === 'tiempo' || fallo.tipo === 'subida') {
    return true;
  }
  return fallo.tipo === 'http' && (fallo.estado === 429 || fallo.estado >= 500);
}
