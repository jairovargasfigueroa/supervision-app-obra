// Paquete de datos para trabajar sin señal (101, criterios 1 a 5): lo que devuelve
// `GET /paquete-datos` de Sincronización, guardado en la base local por usuario.
import {
  esquemaPaqueteDatos,
  pedirPaqueteDatos,
  type PaqueteDatos,
  type StockPaquete,
} from '../api/sincronizacion';
import type { ObtenerToken } from '../api/cliente';
import type { EstadoStock } from '../api/materiales';
import { baseLocal } from './base-local';
import { idDispositivo } from './dispositivo';

export type PaqueteLocal = {
  versionDatos: string;
  contenido: PaqueteDatos;
  /** ISO 8601 (UTC): última vez que se descargó o que el servidor dijo «sin cambios». */
  descargadoEn: string;
};

type FilaPaquete = { version_datos: string; contenido: string; descargado_en: string };

/** El paquete guardado del usuario, o `null` si nunca se descargó (criterio 4). */
export async function leerPaquete(usuarioId: string): Promise<PaqueteLocal | null> {
  const db = await baseLocal();
  const fila = await db.getFirstAsync<FilaPaquete>(
    'SELECT version_datos, contenido, descargado_en FROM paquete_datos WHERE usuario_id = ?',
    usuarioId,
  );
  if (!fila) {
    return null;
  }
  let contenido: unknown;
  try {
    contenido = JSON.parse(fila.contenido);
  } catch {
    return null;
  }
  const resultado = esquemaPaqueteDatos.safeParse(contenido);
  if (!resultado.success) {
    // Guardado por otra versión de la app con otra forma: se vuelve a descargar.
    return null;
  }
  return { versionDatos: fila.version_datos, contenido: resultado.data, descargadoEn: fila.descargado_en };
}

/** Guarda (o reemplaza) el paquete del usuario. */
export async function guardarPaquete(
  usuarioId: string,
  contenido: PaqueteDatos,
  descargadoEn: string,
): Promise<PaqueteLocal> {
  const db = await baseLocal();
  await db.runAsync(
    `INSERT INTO paquete_datos (usuario_id, version_datos, contenido, descargado_en) VALUES (?, ?, ?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET
       version_datos = excluded.version_datos, contenido = excluded.contenido, descargado_en = excluded.descargado_en`,
    usuarioId,
    contenido.versionDatos,
    JSON.stringify(contenido),
    descargadoEn,
  );
  return { versionDatos: contenido.versionDatos, contenido, descargadoEn };
}

type OpcionesDescarga = {
  obtenerToken: ObtenerToken;
  usuarioId: string;
  obraActivaId?: string;
  ahora?: () => Date;
};

/**
 * Descarga el paquete con `If-None-Match` (la versión guardada) y lo guarda. Con `304` (criterio 2)
 * solo actualiza `descargado_en`. Si falla (sin señal, `503`, `504`…) lanza el `ErrorApi` y el
 * paquete guardado queda como estaba.
 */
export async function descargarPaquete({
  obtenerToken,
  usuarioId,
  obraActivaId,
  ahora = () => new Date(),
}: OpcionesDescarga): Promise<{ paquete: PaqueteLocal; cambio: boolean }> {
  const anterior = await leerPaquete(usuarioId);
  const nuevo = await pedirPaqueteDatos({
    obtenerToken,
    idDispositivo: await idDispositivo(),
    versionAnterior: anterior?.versionDatos,
    obraActivaId,
  });
  const descargadoEn = ahora().toISOString();
  if (nuevo === null && anterior) {
    const db = await baseLocal();
    await db.runAsync(
      'UPDATE paquete_datos SET descargado_en = ? WHERE usuario_id = ?',
      descargadoEn,
      usuarioId,
    );
    return { paquete: { ...anterior, descargadoEn }, cambio: false };
  }
  if (nuevo === null) {
    // `304` sin paquete guardado: no debería pasar (sin versión no se manda If-None-Match).
    throw new Error('Sincronización respondió «sin cambios» sin un paquete guardado.');
  }
  return { paquete: await guardarPaquete(usuarioId, nuevo, descargadoEn), cambio: true };
}

/**
 * Tras un movimiento enviado (diseño, enviador paso 4): reemplaza en el paquete guardado el stock de
 * ese material en la obra con el `stock` de la respuesta de Materiales. Sin paquete u obra, no hace nada.
 */
export async function actualizarStockLocal(
  usuarioId: string,
  obraId: string,
  materialId: string,
  stock: { cantidad: number; minimo: number; estado: EstadoStock },
): Promise<void> {
  const guardado = await leerPaquete(usuarioId);
  const obra = guardado?.contenido.obras.find((o) => o.id === obraId);
  if (!guardado || !obra) {
    return;
  }
  const fila: StockPaquete = {
    materialId,
    cantidad: stock.cantidad,
    minimo: stock.minimo,
    estado: stock.estado,
  };
  const indice = obra.stock.findIndex((s) => s.materialId === materialId);
  if (indice >= 0) {
    obra.stock[indice] = fila;
  } else {
    obra.stock.push(fila);
  }
  await guardarPaquete(usuarioId, guardado.contenido, guardado.descargadoEn);
}

/** Al cerrar sesión (criterio 18): se borran los datos descargados del usuario; la cola se conserva. */
export async function borrarPaquete(usuarioId: string): Promise<void> {
  const db = await baseLocal();
  await db.runAsync('DELETE FROM paquete_datos WHERE usuario_id = ?', usuarioId);
}
