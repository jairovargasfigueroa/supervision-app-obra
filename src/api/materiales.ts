// Tipos y respuestas de Materiales que usa la app (docs/contratos.md). Desde la 101 la app no llama
// directo a Materiales: los materiales y el stock llegan en el paquete de Sincronización y el ingreso o
// la salida va como operación `MOVIMIENTO_MATERIAL` de `POST /lotes`, que Sincronización reparte a
// `POST /movimientos`. Las respuestas se validan con Zod: solo los campos que la app usa.
import { z } from 'zod';

export type Material = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  unidadPlural: string;
};

export const ESTADOS_STOCK = ['BAJO', 'JUSTO', 'OK'] as const;
const esquemaEstadoStock = z.enum(ESTADOS_STOCK);

const esquemaMovimientoRegistrado = z.looseObject({
  id: z.string(),
  periodo: z.string(),
  superaStock: z.boolean(),
  stock: z.looseObject({ cantidad: z.number(), minimo: z.number(), estado: esquemaEstadoStock }),
});

export type EstadoStock = z.infer<typeof esquemaEstadoStock>;
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

/** La respuesta de `POST /movimientos` guardada en la cola (101), o `null` si no tiene esa forma. */
export function leerMovimientoRegistrado(respuesta: unknown): MovimientoRegistrado | null {
  const resultado = esquemaMovimientoRegistrado.safeParse(respuesta);
  return resultado.success ? resultado.data : null;
}
