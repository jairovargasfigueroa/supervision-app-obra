// Pantalla que abre un aviso (010) según sus `data { tipo, obraId }`. Función pura.
import { rutaDeObra } from '../sesion/roles';

/** `data` de un mensaje de FCM: lo que pone n8n (los valores llegan como texto). */
export type DatosAviso = Readonly<Record<string, unknown>> | undefined | null;

/**
 * `STOCK_BAJO` → `/obras/{obraId}/stock`; `DIARIO` → `/obras/{obraId}/diario`. Con otro `tipo` o sin
 * `obraId`, `null` (el aviso no abre nada).
 */
export function rutaDeAviso(datos: DatosAviso): string | null {
  const tipo = datos?.tipo;
  const obraId = datos?.obraId;
  if (typeof obraId !== 'string' || obraId.trim() === '') {
    return null;
  }
  switch (tipo) {
    case 'STOCK_BAJO':
      return rutaDeObra('obras/[id]/stock', obraId);
    case 'DIARIO':
      return rutaDeObra('obras/[id]/diario', obraId);
    default:
      return null;
  }
}
