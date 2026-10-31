// Cola local de operaciones por enviar a Sincronización (101, «Base local» y «Módulo src/sync/»).
// Todo registro se guarda aquí primero, con su UUID, y sale en el orden en que se registró.
// Las fechas se guardan en ISO 8601 UTC (`toISOString`), así se comparan como texto.
import { borrarArchivo } from './archivos';
import { baseLocal } from './base-local';

export type EstadoOperacion = 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'RECHAZADO';

/** Tipos de operación de Sincronización que registra la app (101, 102, 103). */
export type TipoOperacion = 'MOVIMIENTO_MATERIAL' | 'FOTO_AVANCE' | 'ENTRADA_DIARIO';

/**
 * Archivo de la operación (102): `NINGUNO` (sin archivo), `PENDIENTE` (falta subirlo), `SUBIENDO` o
 * `SUBIDO` (ya está en S3; el registro puede ir en un lote).
 */
export type EstadoArchivo = 'NINGUNO' | 'PENDIENTE' | 'SUBIENDO' | 'SUBIDO';

export type NuevaOperacion = {
  /** UUID creado en el celular; en un registro nuevo es también su `id`. */
  idOperacion: string;
  usuarioId: string;
  /** Para el aviso de pendientes de otro usuario (criterio 15). */
  usuarioNombre: string;
  tipo: TipoOperacion;
  obraId: string;
  /** Lo que va en `datos` de la operación de `POST /lotes`. */
  datos: Record<string, unknown>;
  /** Texto corto para «Pendientes de envío», p. ej. «Salida · 12,5 bolsas de Cemento IP-30 · P-01». */
  descripcion: string;
  /** Ruta del archivo guardado en el celular que hay que subir antes de enviar el registro (102). */
  archivoLocal?: string | null;
};

export type Operacion = NuevaOperacion & {
  archivoLocal: string | null;
  estadoArchivo: EstadoArchivo;
  estado: EstadoOperacion;
  intentos: number;
  /** ISO; `null` = se puede enviar ya. */
  proximoIntentoEn: string | null;
  errorCodigo: string | null;
  /** `detail` o `title` del rechazo: solo para soporte, no se muestra al usuario. */
  errorMensaje: string | null;
  /** Respuesta del servicio dueño (en un movimiento, con `stock` y `superaStock`). */
  respuesta: unknown;
  creadaEn: string;
  enviadaEn: string | null;
};

/** Tamaño máximo de un lote de `POST /lotes` (decisión del equipo). */
export const TAMANO_LOTE = 20;

/** Los `ENVIADO` se muestran 24 h y luego se borran del celular (criterio 17). */
export const HORAS_ENVIADAS = 24;

type Fila = {
  id_operacion: string;
  usuario_id: string;
  usuario_nombre: string;
  tipo: TipoOperacion;
  obra_id: string;
  datos: string;
  descripcion: string;
  estado: EstadoOperacion;
  intentos: number;
  proximo_intento_en: string | null;
  error_codigo: string | null;
  error_mensaje: string | null;
  respuesta: string | null;
  creada_en: string;
  enviada_en: string | null;
  archivo_local: string | null;
  estado_archivo: EstadoArchivo;
};

function leerJson(texto: string | null): unknown {
  if (texto === null) {
    return null;
  }
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function desdeFila(f: Fila): Operacion {
  return {
    idOperacion: f.id_operacion,
    usuarioId: f.usuario_id,
    usuarioNombre: f.usuario_nombre,
    tipo: f.tipo,
    obraId: f.obra_id,
    datos: (leerJson(f.datos) ?? {}) as Record<string, unknown>,
    descripcion: f.descripcion,
    archivoLocal: f.archivo_local,
    estadoArchivo: f.estado_archivo,
    estado: f.estado,
    intentos: f.intentos,
    proximoIntentoEn: f.proximo_intento_en,
    errorCodigo: f.error_codigo,
    errorMensaje: f.error_mensaje,
    respuesta: leerJson(f.respuesta),
    creadaEn: f.creada_en,
    enviadaEn: f.enviada_en,
  };
}

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Avisa cada cambio de la cola (para el contador y la pantalla «Pendientes de envío»). */
export function alCambiarCola(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function avisar(): void {
  for (const oyente of [...oyentes]) {
    oyente();
  }
}

// `rowid` desempata dos registros del mismo milisegundo: sale primero el que se guardó primero.
const ORDEN = 'ORDER BY creada_en, rowid';

/** La operación, o `null` si no está (se envió hace más de 24 h o se descartó). */
export async function obtener(idOperacion: string): Promise<Operacion | null> {
  const db = await baseLocal();
  const fila = await db.getFirstAsync<Fila>(
    'SELECT * FROM operacion_pendiente WHERE id_operacion = ?',
    idOperacion,
  );
  return fila ? desdeFila(fila) : null;
}

/**
 * Guarda una operación `PENDIENTE`. Si ese `idOperacion` ya estaba (doble toque), no la duplica y
 * devuelve la guardada.
 */
export async function agregar(nueva: NuevaOperacion, ahora: Date = new Date()): Promise<Operacion> {
  const db = await baseLocal();
  await db.runAsync(
    `INSERT INTO operacion_pendiente
       (id_operacion, usuario_id, usuario_nombre, tipo, obra_id, datos, descripcion, estado, creada_en,
        archivo_local, estado_archivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)
     ON CONFLICT (id_operacion) DO NOTHING`,
    nueva.idOperacion,
    nueva.usuarioId,
    nueva.usuarioNombre,
    nueva.tipo,
    nueva.obraId,
    JSON.stringify(nueva.datos),
    nueva.descripcion,
    ahora.toISOString(),
    nueva.archivoLocal ?? null,
    nueva.archivoLocal ? 'PENDIENTE' : 'NINGUNO',
  );
  avisar();
  const guardada = await obtener(nueva.idOperacion);
  if (!guardada) {
    throw new Error('No se pudo guardar la operación en el celular.');
  }
  return guardada;
}

/** Todas las operaciones del usuario, en el orden en que se registraron. */
export async function listar(usuarioId: string): Promise<Operacion[]> {
  const db = await baseLocal();
  const filas = await db.getAllAsync<Fila>(
    `SELECT * FROM operacion_pendiente WHERE usuario_id = ? ${ORDEN}`,
    usuarioId,
  );
  return filas.map(desdeFila);
}

/** Las operaciones del usuario que todavía no llegaron al servidor (`PENDIENTE` y `ENVIANDO`). */
export async function contarPendientes(usuarioId: string): Promise<number> {
  const db = await baseLocal();
  const fila = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM operacion_pendiente WHERE usuario_id = ? AND estado IN ('PENDIENTE', 'ENVIANDO')",
    usuarioId,
  );
  return fila?.n ?? 0;
}

/**
 * Registros sin enviar (`PENDIENTE` y `ENVIANDO`) de otros usuarios en este celular (criterio 15): se
 * envían cuando esa persona vuelve a iniciar sesión.
 */
export async function pendientesDeOtros(
  usuarioId: string,
): Promise<{ usuarioId: string; usuarioNombre: string; cantidad: number }[]> {
  const db = await baseLocal();
  const filas = await db.getAllAsync<{ usuario_id: string; usuario_nombre: string; n: number }>(
    `SELECT usuario_id, MAX(usuario_nombre) AS usuario_nombre, COUNT(*) AS n FROM operacion_pendiente
     WHERE usuario_id <> ? AND estado IN ('PENDIENTE', 'ENVIANDO')
     GROUP BY usuario_id ORDER BY MIN(creada_en)`,
    usuarioId,
  );
  return filas.map((f) => ({ usuarioId: f.usuario_id, usuarioNombre: f.usuario_nombre, cantidad: f.n }));
}

/**
 * Borra una operación `PENDIENTE` o `RECHAZADO` (criterio 17), con su archivo si tiene (102). Devuelve `false` si no se pudo
 * (ya se está enviando, ya se envió o no existe).
 */
export async function descartar(idOperacion: string): Promise<boolean> {
  const db = await baseLocal();
  const fila = await db.getFirstAsync<{ archivo_local: string | null }>(
    "SELECT archivo_local FROM operacion_pendiente WHERE id_operacion = ? AND estado IN ('PENDIENTE', 'RECHAZADO')",
    idOperacion,
  );
  const { changes } = await db.runAsync(
    "DELETE FROM operacion_pendiente WHERE id_operacion = ? AND estado IN ('PENDIENTE', 'RECHAZADO')",
    idOperacion,
  );
  if (changes > 0) {
    // 102, criterio 10: con la operación se borra su archivo del celular.
    borrarArchivo(fila?.archivo_local);
    avisar();
  }
  return changes > 0;
}

/**
 * Al abrir la app: lo que quedó `ENVIANDO` (la app se cerró a mitad de un envío) vuelve a
 * `PENDIENTE` (es seguro: Sincronización no procesa dos veces el mismo `idOperacion`), un archivo que
 * quedó `SUBIENDO` vuelve a `PENDIENTE` (102), y se borran los `ENVIADO` de hace más de 24 h.
 */
export async function prepararCola(ahora: Date = new Date()): Promise<void> {
  const db = await baseLocal();
  const limite = new Date(ahora.getTime() - HORAS_ENVIADAS * 3_600_000).toISOString();
  await db.runAsync("UPDATE operacion_pendiente SET estado = 'PENDIENTE' WHERE estado = 'ENVIANDO'");
  // 102: una subida cortada se vuelve a hacer completa (el PUT a la misma clave es idempotente).
  await db.runAsync(
    "UPDATE operacion_pendiente SET estado_archivo = 'PENDIENTE' WHERE estado_archivo = 'SUBIENDO'",
  );
  await db.runAsync(
    "DELETE FROM operacion_pendiente WHERE estado = 'ENVIADO' AND enviada_en < ?",
    limite,
  );
  avisar();
}

/** «Enviar ahora»: los `PENDIENTE` del usuario quedan listos ya, sin esperar su próximo intento. */
export async function adelantarPendientes(usuarioId: string): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    "UPDATE operacion_pendiente SET proximo_intento_en = NULL WHERE usuario_id = ? AND estado = 'PENDIENTE'",
    usuarioId,
  );
}

/**
 * Toma hasta 20 operaciones `PENDIENTE` «livianas listas» del usuario (sin archivo, o con el archivo ya
 * subido, 102) con `proximo_intento_en` vencido o nulo, en el orden en que se registraron, y las marca
 * `ENVIANDO`.
 */
export async function tomarParaEnvio(
  usuarioId: string,
  ahora: Date = new Date(),
  limite = TAMANO_LOTE,
): Promise<Operacion[]> {
  const db = await baseLocal();
  let tomadas: Operacion[] = [];
  await db.withTransactionAsync(async () => {
    const filas = await db.getAllAsync<Fila>(
      `SELECT * FROM operacion_pendiente
       WHERE usuario_id = ? AND estado = 'PENDIENTE'
         AND estado_archivo IN ('NINGUNO', 'SUBIDO')
         AND (proximo_intento_en IS NULL OR proximo_intento_en <= ?)
       ${ORDEN} LIMIT ?`,
      usuarioId,
      ahora.toISOString(),
      limite,
    );
    for (const fila of filas) {
      await db.runAsync(
        "UPDATE operacion_pendiente SET estado = 'ENVIANDO' WHERE id_operacion = ?",
        fila.id_operacion,
      );
    }
    tomadas = filas.map((f) => ({ ...desdeFila(f), estado: 'ENVIANDO' as const }));
  });
  if (tomadas.length > 0) {
    avisar();
  }
  return tomadas;
}

/** `PROCESADO` en el servidor: queda `ENVIADO` con la respuesta del servicio dueño. */
export async function marcarEnviada(
  idOperacion: string,
  respuesta: unknown,
  ahora: Date = new Date(),
): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    `UPDATE operacion_pendiente
     SET estado = 'ENVIADO', respuesta = ?, enviada_en = ?, proximo_intento_en = NULL,
         error_codigo = NULL, error_mensaje = NULL
     WHERE id_operacion = ?`,
    JSON.stringify(respuesta ?? null),
    ahora.toISOString(),
    idOperacion,
  );
  avisar();
}

/** `ERROR` en el servidor: rechazo definitivo con su código (criterio 14); no se reintenta. */
export async function marcarRechazada(
  idOperacion: string,
  codigo: string,
  mensaje: string | null,
  respuesta: unknown,
): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    `UPDATE operacion_pendiente
     SET estado = 'RECHAZADO', error_codigo = ?, error_mensaje = ?, respuesta = ?, proximo_intento_en = NULL,
         estado_archivo = CASE estado_archivo WHEN 'SUBIENDO' THEN 'PENDIENTE' ELSE estado_archivo END
     WHERE id_operacion = ?`,
    codigo,
    mensaje,
    JSON.stringify(respuesta ?? null),
    idOperacion,
  );
  avisar();
}

/** No se pudo completar: vuelve a `PENDIENTE` con un intento más y la hora del próximo. */
export async function marcarParaReintento(
  idOperacion: string,
  intentos: number,
  proximoIntentoEn: Date,
  codigo: string | null = null,
): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    `UPDATE operacion_pendiente
     SET estado = 'PENDIENTE', intentos = ?, proximo_intento_en = ?, error_codigo = ?
     WHERE id_operacion = ?`,
    intentos,
    proximoIntentoEn.toISOString(),
    codigo,
    idOperacion,
  );
  avisar();
}

/**
 * Subidor (102): toma la operación `PENDIENTE` más antigua del usuario con el archivo por subir y su
 * próximo intento vencido, y marca el archivo `SUBIENDO`. `null` si no hay.
 */
export async function tomarArchivoParaSubir(usuarioId: string, ahora: Date = new Date()): Promise<Operacion | null> {
  const db = await baseLocal();
  let tomada: Operacion | null = null;
  await db.withTransactionAsync(async () => {
    const fila = await db.getFirstAsync<Fila>(
      `SELECT * FROM operacion_pendiente
       WHERE usuario_id = ? AND estado = 'PENDIENTE' AND estado_archivo = 'PENDIENTE'
         AND (proximo_intento_en IS NULL OR proximo_intento_en <= ?)
       ${ORDEN} LIMIT 1`,
      usuarioId,
      ahora.toISOString(),
    );
    if (fila) {
      await db.runAsync(
        "UPDATE operacion_pendiente SET estado_archivo = 'SUBIENDO' WHERE id_operacion = ?",
        fila.id_operacion,
      );
      tomada = { ...desdeFila(fila), estadoArchivo: 'SUBIENDO' };
    }
  });
  if (tomada) {
    avisar();
  }
  return tomada;
}

/** El archivo ya está en S3: se guarda la `claveArchivo` en `datos` y el registro queda listo para un lote. */
export async function marcarArchivoSubido(idOperacion: string, datos: Record<string, unknown>): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    `UPDATE operacion_pendiente
     SET estado_archivo = 'SUBIDO', datos = ?, proximo_intento_en = NULL, error_codigo = NULL
     WHERE id_operacion = ?`,
    JSON.stringify(datos),
    idOperacion,
  );
  avisar();
}

/** La subida no se completó: el archivo vuelve a `PENDIENTE` con un intento más y la hora del próximo. */
export async function marcarArchivoParaReintento(
  idOperacion: string,
  intentos: number,
  proximoIntentoEn: Date,
  codigo: string | null = null,
): Promise<void> {
  const db = await baseLocal();
  await db.runAsync(
    `UPDATE operacion_pendiente
     SET estado_archivo = 'PENDIENTE', intentos = ?, proximo_intento_en = ?, error_codigo = ?
     WHERE id_operacion = ?`,
    intentos,
    proximoIntentoEn.toISOString(),
    codigo,
    idOperacion,
  );
  avisar();
}
