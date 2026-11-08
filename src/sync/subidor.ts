// Subidor de las fotos (102, «Subidor»): un archivo a la vez, completo y directo a S3 con la URL firmada
// que se pide a Sincronización justo antes de subir (una URL nueva en cada intento). Lo llama el
// enviador cuando ya no quedan operaciones livianas listas.
import { falloDe } from '../api/errores';
import { pedirUrlSubidaFoto } from '../api/sincronizacion';
import { subirArchivo } from '../api/subida';
import { abrirArchivo } from './archivos';
import {
  marcarArchivoParaReintento,
  marcarArchivoSubido,
  marcarRechazada,
  tomarArchivoParaSubir,
} from './cola';
import { esperaCreciente } from './espera';

export type ResultadoSubida =
  /** No había archivos listos para subir. */
  | { tipo: 'nada' }
  /** El archivo quedó en S3: su registro ya puede ir en un lote. */
  | { tipo: 'subido'; idOperacion: string }
  /** Rechazo definitivo al pedir la URL (o el archivo ya no está en el celular). */
  | { tipo: 'rechazado'; idOperacion: string }
  /**
   * No se completó (red, tiempo agotado, `5xx`, fallo del `PUT`…): vuelve a `PENDIENTE` con espera
   * creciente y el subidor se detiene hasta el próximo envío. `renovar` si fue un `401`.
   */
  | { tipo: 'reintento'; idOperacion: string; renovar: boolean };

type Opciones = {
  usuarioId: string;
  token: string;
  idDispositivo: string;
  ahora: () => Date;
  azar: () => number;
};

/** Estados con los que Obras rechaza la URL para siempre (diseño: `400`, `403`, `404`, `422`). */
function esRechazoDefinitivo(estado: number): boolean {
  return estado >= 400 && estado < 500 && estado !== 401 && estado !== 408 && estado !== 429;
}

/** Sube el archivo de la operación más antigua que lo tenga pendiente. */
export async function subirSiguiente({ usuarioId, token, idDispositivo, ahora, azar }: Opciones): Promise<ResultadoSubida> {
  const op = await tomarArchivoParaSubir(usuarioId, ahora());
  if (!op) {
    return { tipo: 'nada' };
  }
  const { idOperacion } = op;
  const reintentar = async (codigo: string | null, renovar = false): Promise<ResultadoSubida> => {
    const intentos = op.intentos + 1;
    await marcarArchivoParaReintento(
      idOperacion,
      intentos,
      new Date(ahora().getTime() + esperaCreciente(intentos, azar)),
      codigo,
    );
    return { tipo: 'reintento', idOperacion, renovar };
  };

  const archivo = op.archivoLocal ? abrirArchivo(op.archivoLocal) : null;
  if (!archivo) {
    await marcarRechazada(idOperacion, 'FOTO_NO_DISPONIBLE', 'El archivo ya no está en el celular.', null);
    return { tipo: 'rechazado', idOperacion };
  }

  // 1. URL firmada nueva (10 s).
  let subida;
  try {
    subida = await pedirUrlSubidaFoto(
      { obraId: op.obraId, fotoId: idOperacion },
      { obtenerToken: () => Promise.resolve(token), idDispositivo },
    );
  } catch (error) {
    const fallo = falloDe(error);
    if (fallo.tipo === 'http' && esRechazoDefinitivo(fallo.estado)) {
      await marcarRechazada(idOperacion, fallo.codigo, null, { status: fallo.estado, codigo: fallo.codigo });
      return { tipo: 'rechazado', idOperacion };
    }
    if (fallo.tipo === 'http') {
      return reintentar(fallo.codigo, fallo.estado === 401);
    }
    return reintentar(null);
  }

  // 2. PUT completo a S3 (30 s). Repetirlo sobrescribe el mismo objeto: es idempotente.
  try {
    await subirArchivo(subida.url, archivo);
  } catch {
    return reintentar(null);
  }
  await marcarArchivoSubido(idOperacion, { ...op.datos, claveArchivo: subida.claveArchivo });
  return { tipo: 'subido', idOperacion };
}
