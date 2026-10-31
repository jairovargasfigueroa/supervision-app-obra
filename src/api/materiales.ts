// Llamadas a Materiales que usa la app (docs/contratos.md). Las respuestas se validan con Zod: solo
// los campos que la app usa; el resto se deja pasar.
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { pedir, urlServicio, validar, type ObtenerToken } from './cliente';

const esquemaMaterial = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  unidadPlural: z.string(),
  activo: z.boolean(),
});

const esquemaPaginaMateriales = z.looseObject({
  items: z.array(esquemaMaterial),
  total: z.number(),
});

export const ESTADOS_STOCK = ['BAJO', 'JUSTO', 'OK'] as const;
const esquemaEstadoStock = z.enum(ESTADOS_STOCK);

const esquemaFilaStock = z.looseObject({
  materialId: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  unidadPlural: z.string(),
  cantidad: z.number(),
  minimo: z.number(),
  estado: esquemaEstadoStock,
});

const esquemaMovimientoRegistrado = z.looseObject({
  id: z.string(),
  periodo: z.string(),
  superaStock: z.boolean(),
  stock: z.looseObject({ cantidad: z.number(), minimo: z.number(), estado: esquemaEstadoStock }),
});

export type Material = z.infer<typeof esquemaMaterial>;
export type EstadoStock = z.infer<typeof esquemaEstadoStock>;
export type FilaStock = z.infer<typeof esquemaFilaStock>;
export type MovimientoRegistrado = z.infer<typeof esquemaMovimientoRegistrado>;

export type TipoMovimiento = 'INGRESO' | 'SALIDA';

/**
 * Cuerpo de `POST /movimientos` (desde la 101 va como `datos` de una operación `MOVIMIENTO_MATERIAL` de
 * la cola): `partidaId` solo en `SALIDA`, `notaRemision` solo en `INGRESO`.
 */
export type RegistroMovimiento = {
  /** UUID generado en el celular: hace idempotente el envío. */
  id: string;
  obraId: string;
  materialId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  partidaId?: string;
  notaRemision?: { numero: string };
  /** ISO 8601 (UTC). */
  registradoEn: string;
};

const url = (ruta: string) => urlServicio('materiales', ruta);
const segmento = encodeURIComponent;

/** Tamaño de página máximo de las listas paginadas (convenciones). */
export const TAMANO_PAGINA = 100;
/** Tope de páginas por si el servicio devolviera un `total` que nunca se alcanza. */
const MAX_PAGINAS = 50;

/**
 * `GET /materiales?soloActivos=true`, todas las páginas (de 100 en 100, en orden de código): la
 * app elige el material de una lista completa.
 */
export async function listarMaterialesActivos(obtenerToken: ObtenerToken): Promise<Material[]> {
  const materiales: Material[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const { datos } = await pedir(
      url(`/materiales?soloActivos=true&pagina=${pagina}&tamano=${TAMANO_PAGINA}`),
      { obtenerToken },
    );
    const { items, total } = validar(esquemaPaginaMateriales, datos);
    materiales.push(...items);
    if (items.length === 0 || materiales.length >= total) {
      break;
    }
  }
  return materiales;
}

/** `GET /obras/{obraId}/stock`: una fila por material con movimientos o mínimo en la obra. */
export async function obtenerStock(obraId: string, obtenerToken: ObtenerToken): Promise<FilaStock[]> {
  const { datos } = await pedir(url(`/obras/${segmento(obraId)}/stock`), { obtenerToken });
  return validar(z.array(esquemaFilaStock), datos);
}

export const materialesActivosQuery = (obtenerToken: ObtenerToken) =>
  queryOptions({
    queryKey: ['materiales', 'activos'],
    queryFn: () => listarMaterialesActivos(obtenerToken),
  });

export const claveStock = (obraId: string) => ['stock', obraId] as const;

export const stockQuery = (obraId: string, obtenerToken: ObtenerToken) =>
  queryOptions({ queryKey: claveStock(obraId), queryFn: () => obtenerStock(obraId, obtenerToken) });

/** La respuesta de `POST /movimientos` guardada en la cola (101), o `null` si no tiene esa forma. */
export function leerMovimientoRegistrado(respuesta: unknown): MovimientoRegistrado | null {
  const resultado = esquemaMovimientoRegistrado.safeParse(respuesta);
  return resultado.success ? resultado.data : null;
}
