// Base local del celular (101, «Base local»): la cola de operaciones por enviar a Sincronización y el
// paquete de datos para trabajar sin señal. Una sola conexión para toda la app; el esquema avanza con
// migraciones numeradas por `PRAGMA user_version`.
import * as SQLite from 'expo-sqlite';

export const NOMBRE_BASE = 'app-obra.db';

/** Cada migración lleva la base de la versión `i` a la `i + 1`. Nunca se edita una ya publicada: se agrega otra. */
export const MIGRACIONES: readonly string[] = [
  `
  CREATE TABLE operacion_pendiente (
    id_operacion        TEXT PRIMARY KEY,
    usuario_id          TEXT NOT NULL,
    usuario_nombre      TEXT NOT NULL,
    tipo                TEXT NOT NULL,
    obra_id             TEXT NOT NULL,
    datos               TEXT NOT NULL,
    descripcion         TEXT NOT NULL,
    estado              TEXT NOT NULL,
    intentos            INTEGER NOT NULL DEFAULT 0,
    proximo_intento_en  TEXT,
    error_codigo        TEXT,
    error_mensaje       TEXT,
    respuesta           TEXT,
    creada_en           TEXT NOT NULL,
    enviada_en          TEXT
  );
  CREATE INDEX operacion_pendiente_envio ON operacion_pendiente (usuario_id, estado, creada_en);

  CREATE TABLE paquete_datos (
    usuario_id     TEXT PRIMARY KEY,
    version_datos  TEXT NOT NULL,
    contenido      TEXT NOT NULL,
    descargado_en  TEXT NOT NULL
  );
  `,
];

/** Aplica las migraciones que falten, todas en una transacción junto con el nuevo `user_version`. */
export async function migrar(db: SQLite.SQLiteDatabase): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actual = fila?.user_version ?? 0;
  if (actual > MIGRACIONES.length) {
    throw new Error(
      `La base local es de una versión más nueva de la app (${actual} > ${MIGRACIONES.length}).`,
    );
  }
  if (actual === MIGRACIONES.length) {
    return;
  }
  await db.withTransactionAsync(async () => {
    for (const migracion of MIGRACIONES.slice(actual)) {
      await db.execAsync(migracion);
    }
    // PRAGMA no acepta parámetros; el valor es un número fijo del código.
    await db.execAsync(`PRAGMA user_version = ${MIGRACIONES.length}`);
  });
}

let abierta: Promise<SQLite.SQLiteDatabase> | null = null;

/** La base local abierta y al día (se abre y migra una sola vez, aunque se pida a la vez). */
export function baseLocal(): Promise<SQLite.SQLiteDatabase> {
  abierta ??= (async () => {
    const db = await SQLite.openDatabaseAsync(NOMBRE_BASE);
    // Fuera de la transacción de las migraciones (no se puede cambiar dentro de una).
    await db.execAsync('PRAGMA journal_mode = WAL');
    await migrar(db);
    return db;
  })().catch((error: unknown) => {
    abierta = null;
    throw error;
  });
  return abierta;
}

/** Solo para las pruebas: olvida la conexión (la base simulada se vacía en cada prueba). */
export function olvidarBaseLocal(): void {
  abierta = null;
}
