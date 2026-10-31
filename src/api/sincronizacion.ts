// Llamadas a Sincronización (capa 1, 101; contrato en services/sincronizacion/docs/contratos.md). Todas
// llevan el token de la sesión y `X-Dispositivo-Id`. Las respuestas se validan con Zod: solo los
// campos que la app usa; el resto se deja pasar.
import { z } from 'zod';

import { pedir, urlServicio, validar, type ObtenerToken } from './cliente';
import { ESTADOS_STOCK } from './materiales';

const esquemaPartidaPaquete = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
});

const esquemaStockPaquete = z.looseObject({
  materialId: z.string(),
  cantidad: z.number(),
  minimo: z.number(),
  estado: z.enum(ESTADOS_STOCK),
});

const esquemaObraPaquete = z.looseObject({
  id: z.string(),
  nombre: z.string(),
  ubicacion: z.string(),
  partidas: z.array(esquemaPartidaPaquete),
  stock: z.array(esquemaStockPaquete),
});

const esquemaMaterialPaquete = z.looseObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  unidadPlural: z.string(),
});

export const esquemaPaqueteDatos = z.looseObject({
  versionDatos: z.string().min(1),
  generadoEn: z.string(),
  obras: z.array(esquemaObraPaquete),
  materiales: z.array(esquemaMaterialPaquete),
});

export type PaqueteDatos = z.infer<typeof esquemaPaqueteDatos>;
export type ObraPaquete = z.infer<typeof esquemaObraPaquete>;
export type StockPaquete = z.infer<typeof esquemaStockPaquete>;
export type MaterialPaquete = z.infer<typeof esquemaMaterialPaquete>;

const url = (ruta: string) => urlServicio('sincronizacion', ruta);

type OpcionesPaquete = {
  obtenerToken: ObtenerToken;
  idDispositivo: string;
  /** `versionDatos` del paquete guardado: si no cambió, el servidor responde `304`. */
  versionAnterior?: string;
  /** Obra con la que trabaja el usuario (Sincronización solo la guarda en `estado_dispositivo`). */
  obraActivaId?: string;
};

/** `GET /paquete-datos`: el paquete nuevo, o `null` si no cambió desde `versionAnterior` (`304`). */
export async function pedirPaqueteDatos({
  obtenerToken,
  idDispositivo,
  versionAnterior,
  obraActivaId,
}: OpcionesPaquete): Promise<PaqueteDatos | null> {
  const consulta = obraActivaId ? `?obraActivaId=${encodeURIComponent(obraActivaId)}` : '';
  const { estado, datos } = await pedir(url(`/paquete-datos${consulta}`), {
    obtenerToken,
    encabezados: {
      'X-Dispositivo-Id': idDispositivo,
      ...(versionAnterior ? { 'If-None-Match': `"${versionAnterior}"` } : {}),
    },
  });
  if (estado === 304) {
    return null;
  }
  return validar(esquemaPaqueteDatos, datos);
}
