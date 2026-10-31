// Envío de la cola a Sincronización (101, «enviador.ts»): un solo envío a la vez, en lotes de hasta 20
// operaciones listas del usuario de la sesión, en el orden en que se registraron.
import type { ObtenerToken } from '../api/cliente';
import { codigoGenerico, ErrorApi, falloDe } from '../api/errores';
import { ESTADOS_STOCK } from '../api/materiales';
import { enviarLote, type ResultadoLote } from '../api/sincronizacion';
import {
  marcarEnviada,
  marcarParaReintento,
  marcarRechazada,
  tomarParaEnvio,
  type Operacion,
} from './cola';
import { idDispositivo } from './dispositivo';
import { actualizarStockLocal, descargarPaquete } from './paquete';

/** Espera máxima entre intentos: 5 minutos (criterio 12). */
export const ESPERA_MAXIMA_S = 300;

/**
 * Espera antes del intento siguiente, tras `intentos` fallidos (1, 2, 3…): `min(2^(intentos−1), 300)`
 * segundos por un factor aleatorio entre 0,8 y 1,2, para que los celulares no reintenten todos a la
 * vez (decisión del equipo). `azar` devuelve un número en [0, 1), como `Math.random`.
 */
export function esperaCreciente(intentos: number, azar: () => number = Math.random): number {
  const base = Math.min(2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_S);
  return Math.round(base * 1000 * (0.8 + 0.4 * azar()));
}

export type ResumenEnvio = {
  enviadas: number;
  rechazadas: number;
  /** Vuelven a `PENDIENTE` con espera creciente. */
  reintentos: number;
  /**
   * Por qué se cortó el envío antes de vaciar la cola, si se cortó: `sin-red` (no se pudo renovar el
   * token o no llegó el lote), `sin-sesion` (Keycloak rechazó la renovación: hay que iniciar sesión) o
   * `lote` (Sincronización no atendió el lote).
   */
  detenido?: 'sin-red' | 'sin-sesion' | 'lote';
};

export type OpcionesEnvio = {
  /** Usuario de la sesión: solo se envían sus operaciones (criterio 15). */
  usuarioId: string;
  obtenerToken: ObtenerToken;
  ahora?: () => Date;
  azar?: () => number;
};

function codigoDe(respuesta: unknown, status: number): string {
  if (typeof respuesta === 'object' && respuesta !== null && 'codigo' in respuesta) {
    const { codigo } = respuesta;
    if (typeof codigo === 'string' && codigo) {
      return codigo;
    }
  }
  return codigoGenerico(status);
}

/** `detail` o `title` del Problem Details: solo para soporte (no se muestra al usuario). */
function mensajeDe(respuesta: unknown): string | null {
  if (typeof respuesta !== 'object' || respuesta === null) {
    return null;
  }
  const { detail, title } = respuesta as { detail?: unknown; title?: unknown };
  if (typeof detail === 'string' && detail) {
    return detail;
  }
  return typeof title === 'string' && title ? title : null;
}

/** El `stock` de la respuesta de un movimiento, si viene con la forma esperada. */
function stockDe(respuesta: unknown) {
  if (typeof respuesta !== 'object' || respuesta === null || !('stock' in respuesta)) {
    return null;
  }
  const stock = respuesta.stock as Record<string, unknown> | null;
  if (
    stock &&
    typeof stock.cantidad === 'number' &&
    typeof stock.minimo === 'number' &&
    ESTADOS_STOCK.includes(stock.estado as (typeof ESTADOS_STOCK)[number])
  ) {
    return {
      cantidad: stock.cantidad,
      minimo: stock.minimo,
      estado: stock.estado as (typeof ESTADOS_STOCK)[number],
    };
  }
  return null;
}

/** Errores del lote completo que no se arreglan reintentando: el lote mismo no es válido. */
function esRechazoDelLote(error: unknown): error is ErrorApi {
  const fallo = falloDe(error);
  return fallo.tipo === 'http' && (fallo.estado === 400 || fallo.estado === 413);
}

async function aplicarResultado(
  op: Operacion,
  resultado: ResultadoLote | undefined,
  { usuarioId, ahora, azar }: Required<Pick<OpcionesEnvio, 'usuarioId' | 'ahora' | 'azar'>>,
): Promise<'enviada' | 'rechazada' | 'reintento'> {
  if (resultado?.estado === 'PROCESADO') {
    await marcarEnviada(op.idOperacion, resultado.respuesta, ahora());
    const stock = op.tipo === 'MOVIMIENTO_MATERIAL' ? stockDe(resultado.respuesta) : null;
    const materialId = op.datos.materialId;
    if (stock && typeof materialId === 'string') {
      await actualizarStockLocal(usuarioId, op.obraId, materialId, stock);
    }
    return 'enviada';
  }
  if (resultado?.estado === 'ERROR') {
    await marcarRechazada(
      op.idOperacion,
      codigoDe(resultado.respuesta, resultado.status),
      mensajeDe(resultado.respuesta),
      resultado.respuesta,
    );
    return 'rechazada';
  }
  // REINTENTAR, o una operación sin resultado (no debería pasar): más tarde, con el mismo id.
  const intentos = op.intentos + 1;
  await marcarParaReintento(
    op.idOperacion,
    intentos,
    new Date(ahora().getTime() + esperaCreciente(intentos, azar)),
    resultado ? codigoDe(resultado.respuesta, resultado.status) : null,
  );
  return 'reintento';
}

async function enviarTodo({
  usuarioId,
  obtenerToken,
  ahora = () => new Date(),
  azar = Math.random,
}: OpcionesEnvio): Promise<ResumenEnvio> {
  const resumen: ResumenEnvio = { enviadas: 0, rechazadas: 0, reintentos: 0 };
  const dispositivo = await idDispositivo();
  let renovar = false;
  let renovadoPor401 = false;

  for (;;) {
    // 1. Token vigente antes de tomar nada de la cola.
    let token: string | null;
    try {
      token = await obtenerToken(renovar ? { renovar: true } : undefined);
    } catch {
      resumen.detenido = 'sin-red';
      break;
    }
    if (!token) {
      resumen.detenido = 'sin-sesion';
      break;
    }
    renovar = false;

    // 2. Hasta 20 listas, en orden, marcadas ENVIANDO.
    const lote = await tomarParaEnvio(usuarioId, ahora());
    if (lote.length === 0) {
      break;
    }

    // 3. POST /lotes con el token obtenido (tiempo máximo de 30 s).
    let resultados: ResultadoLote[];
    try {
      resultados = await enviarLote(
        lote.map((op) => ({
          idOperacion: op.idOperacion,
          tipo: op.tipo,
          creadaEn: op.creadaEn,
          datos: op.datos,
        })),
        { obtenerToken: () => Promise.resolve(token), idDispositivo: dispositivo },
      );
    } catch (error) {
      if (esRechazoDelLote(error)) {
        // 400 LOTE_INVALIDO o 413: el lote no es válido; reintentarlo daría lo mismo.
        const fallo = falloDe(error);
        const codigo = fallo.tipo === 'http' ? fallo.codigo : 'DATOS_INVALIDOS';
        for (const op of lote) {
          await marcarRechazada(op.idOperacion, codigo, null, null);
        }
        resumen.rechazadas += lote.length;
        continue;
      }
      const fallo401 = falloDe(error);
      if (fallo401.tipo === 'http' && fallo401.estado === 401 && !renovadoPor401) {
        // Sincronización no aceptó el token: se renueva y se vuelve a probar una vez, ya mismo.
        for (const op of lote) {
          await marcarParaReintento(op.idOperacion, op.intentos, ahora(), fallo401.codigo);
        }
        renovar = true;
        renovadoPor401 = true;
        continue;
      }
      // 5. Red, tiempo agotado, 5xx, 401 repetido, 429…: todas vuelven a PENDIENTE con espera creciente.
      for (const op of lote) {
        const intentos = op.intentos + 1;
        await marcarParaReintento(
          op.idOperacion,
          intentos,
          new Date(ahora().getTime() + esperaCreciente(intentos, azar)),
          error instanceof ErrorApi && error.fallo.tipo === 'http' ? error.fallo.codigo : null,
        );
      }
      resumen.reintentos += lote.length;
      const fallo = falloDe(error);
      resumen.detenido = fallo.tipo === 'red' || fallo.tipo === 'tiempo' ? 'sin-red' : 'lote';
      break;
    }

    // 4. Un resultado por operación (se buscan por id por si vinieran en otro orden).
    const porId = new Map(resultados.map((r) => [r.idOperacion, r]));
    for (const op of lote) {
      const resultado = porId.get(op.idOperacion);
      const efecto = await aplicarResultado(op, resultado, { usuarioId, ahora, azar });
      if (efecto === 'enviada') {
        resumen.enviadas++;
      } else if (efecto === 'rechazada') {
        resumen.rechazadas++;
      } else {
        resumen.reintentos++;
        if (resultado && codigoDe(resultado.respuesta, resultado.status) === 'TOKEN_VENCIDO') {
          renovar = true;
        }
      }
    }
    // 6. Se repite mientras queden operaciones listas.
  }

  if (resumen.enviadas > 0) {
    // Con lo enviado cambió el stock: se vuelve a pedir el paquete (con If-None-Match, cuesta poco).
    await descargarPaquete({ obtenerToken, usuarioId, ahora }).catch(() => undefined);
  }
  return resumen;
}

let enCurso: Promise<ResumenEnvio> | null = null;
let otraVuelta: OpcionesEnvio | null = null;

/**
 * Envía los pendientes listos del usuario. Un solo envío a la vez: si ya hay uno en curso, se anota
 * otra vuelta al terminar (para lo que se agregó mientras tanto) y se devuelve el mismo envío.
 */
export function enviarPendientes(opciones: OpcionesEnvio): Promise<ResumenEnvio> {
  if (enCurso) {
    otraVuelta = opciones;
    return enCurso;
  }
  enCurso = (async () => {
    let resumen = await enviarTodo(opciones);
    while (otraVuelta && !resumen.detenido) {
      const siguiente = otraVuelta;
      otraVuelta = null;
      if (siguiente.usuarioId !== opciones.usuarioId) {
        break;
      }
      const mas = await enviarTodo(siguiente);
      resumen = {
        enviadas: resumen.enviadas + mas.enviadas,
        rechazadas: resumen.rechazadas + mas.rechazadas,
        reintentos: resumen.reintentos + mas.reintentos,
        detenido: mas.detenido,
      };
    }
    return resumen;
  })().finally(() => {
    enCurso = null;
    otraVuelta = null;
  });
  return enCurso;
}

/** Hay un envío en curso (para mostrar «Enviando…»). */
export function enviando(): boolean {
  return enCurso !== null;
}
