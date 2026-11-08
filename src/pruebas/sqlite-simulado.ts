// expo-sqlite simulado (jest.setup.ts lo instala para todas las pruebas): el módulo nativo no existe en
// Jest, así que cada base es un SQLite real en memoria de Node (`node:sqlite`), con el mismo SQL que en
// el celular. Las bases se guardan por nombre: volver a abrir la misma devuelve sus datos, como en el
// celular al cerrar y abrir la app. Se vacían antes de cada prueba.
interface SentenciaNode {
  run(...parametros: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...parametros: unknown[]): Record<string, unknown> | undefined;
  all(...parametros: unknown[]): Record<string, unknown>[];
}

interface BaseNode {
  exec(sql: string): void;
  prepare(sql: string): SentenciaNode;
  close(): void;
  readonly isOpen: boolean;
}

const { DatabaseSync } = jest.requireActual<{ DatabaseSync: new (ruta: string) => BaseNode }>(
  'node:sqlite',
);

const bases = new Map<string, BaseNode>();

function leerParametros(parametros: unknown[]): unknown[] {
  if (parametros.length === 1 && Array.isArray(parametros[0])) {
    return parametros[0];
  }
  return parametros;
}

function fila<T>(valor: Record<string, unknown>): T {
  return { ...valor } as T;
}

export class SQLiteDatabaseSimulada {
  private cerrada = false;

  constructor(
    readonly databasePath: string,
    private readonly base: BaseNode,
  ) {}

  private abierta(): BaseNode {
    if (this.cerrada || !this.base.isOpen) {
      throw new Error('La base está cerrada');
    }
    return this.base;
  }

  async execAsync(sql: string): Promise<void> {
    this.abierta().exec(sql);
  }

  async runAsync(sql: string, ...parametros: unknown[]) {
    const r = this.abierta().prepare(sql).run(...leerParametros(parametros));
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...parametros: unknown[]): Promise<T | null> {
    const r = this.abierta().prepare(sql).get(...leerParametros(parametros));
    return r ? fila<T>(r) : null;
  }

  async getAllAsync<T>(sql: string, ...parametros: unknown[]): Promise<T[]> {
    return this.abierta()
      .prepare(sql)
      .all(...leerParametros(parametros))
      .map((r) => fila<T>(r));
  }

  async withTransactionAsync(tarea: () => Promise<void>): Promise<void> {
    const base = this.abierta();
    base.exec('BEGIN');
    try {
      await tarea();
      base.exec('COMMIT');
    } catch (error) {
      base.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.cerrada = true;
  }
}

/** La base de ese nombre tal como está (sirve para preparar una base «vieja» en las pruebas). */
export function baseSimulada(nombre: string): BaseNode {
  let base = bases.get(nombre);
  if (!base) {
    base = new DatabaseSync(':memory:');
    bases.set(nombre, base);
  }
  return base;
}

export async function openDatabaseAsync(nombre: string): Promise<SQLiteDatabaseSimulada> {
  return new SQLiteDatabaseSimulada(nombre, baseSimulada(nombre));
}

export function reiniciarSqlite(): void {
  for (const base of bases.values()) {
    if (base.isOpen) {
      base.close();
    }
  }
  bases.clear();
}
