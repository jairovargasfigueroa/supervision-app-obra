import { baseSimulada } from '../pruebas/sqlite-simulado';
import { MIGRACIONES, NOMBRE_BASE, baseLocal, olvidarBaseLocal } from './base-local';

async function tablas(): Promise<string[]> {
  const db = await baseLocal();
  const filas = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name",
  );
  return filas.map((f) => f.name);
}

describe('baseLocal', () => {
  it('crea las tablas de la cola y del paquete y deja la versión del esquema', async () => {
    expect(await tablas()).toEqual(
      expect.arrayContaining(['operacion_pendiente', 'operacion_pendiente_envio', 'paquete_datos']),
    );
    const db = await baseLocal();
    await expect(db.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: MIGRACIONES.length,
    });
  });

  it('se abre una sola vez aunque se pida a la vez', async () => {
    const [a, b] = await Promise.all([baseLocal(), baseLocal()]);
    expect(b).toBe(a);
  });

  it('al volver a abrir la app conserva los datos y no repite las migraciones', async () => {
    const db = await baseLocal();
    await db.runAsync(
      'INSERT INTO paquete_datos (usuario_id, version_datos, contenido, descargado_en) VALUES (?, ?, ?, ?)',
      'u1',
      'v1',
      '{}',
      '2026-11-15T13:00:00.000Z',
    );
    olvidarBaseLocal();
    const otra = await baseLocal();
    expect(otra).not.toBe(db);
    await expect(otra.getAllAsync('SELECT usuario_id FROM paquete_datos')).resolves.toEqual([
      { usuario_id: 'u1' },
    ]);
  });

  it('una base de la 101 (versión 1) se lleva a la 102 sin perder la cola (archivo_local, estado_archivo)', async () => {
    const vieja = baseSimulada(NOMBRE_BASE);
    vieja.exec(MIGRACIONES[0]!);
    vieja.exec('PRAGMA user_version = 1');
    vieja.exec(`INSERT INTO operacion_pendiente (id_operacion, usuario_id, usuario_nombre, tipo, obra_id, datos, descripcion, estado, creada_en)
      VALUES ('a', 'u1', 'Ana', 'MOVIMIENTO_MATERIAL', 'o1', '{}', 'Ingreso', 'PENDIENTE', '2026-11-15T14:00:00.000Z')`);

    const db = await baseLocal();
    await expect(db.getFirstAsync('PRAGMA user_version')).resolves.toEqual({ user_version: MIGRACIONES.length });
    await expect(
      db.getFirstAsync('SELECT id_operacion, archivo_local, estado_archivo FROM operacion_pendiente'),
    ).resolves.toEqual({ id_operacion: 'a', archivo_local: null, estado_archivo: 'NINGUNO' });
  });

  it('no abre una base de una versión más nueva de la app', async () => {
    baseSimulada(NOMBRE_BASE).exec(`PRAGMA user_version = ${MIGRACIONES.length + 1}`);
    await expect(baseLocal()).rejects.toThrow('versión más nueva');
  });

  it('si una migración falla no deja nada a medias y se puede volver a intentar', async () => {
    // Una tabla que choca con la migración 1: falla el CREATE de paquete_datos.
    const vieja = baseSimulada(NOMBRE_BASE);
    vieja.exec('CREATE TABLE paquete_datos (x TEXT)');
    await expect(baseLocal()).rejects.toThrow();
    expect(vieja.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });
    expect(
      vieja.prepare("SELECT name FROM sqlite_master WHERE name = 'operacion_pendiente'").get(),
    ).toBeUndefined();

    vieja.exec('DROP TABLE paquete_datos');
    expect(await tablas()).toEqual(expect.arrayContaining(['operacion_pendiente', 'paquete_datos']));
  });
});
