// `assets/modelos/epp.json` (301): versión del clasificador, umbrales, entrada y orden de las salidas,
// escritos por el entrenamiento (`services/ia/entrenamiento/epp/clasificador.py`,
// `guardar_configuracion_app`). Se valida con Zod al cargar los modelos.
import { z } from 'zod';

const probabilidad = z.number().min(0).max(1);
const atributo = z.enum(['casco', 'chaleco']);

export const esquemaConfigEpp = z.object({
  /** Versión del clasificador, p. ej. `1.0.0`. */
  version: z.string().min(1).max(36),
  /** `epp-<versión>`; si no viene, se arma con `version`. Obras acepta de 1 a 40 caracteres. */
  versionModelo: z.string().min(1).max(40).optional(),
  /** Umbrales de `p_casco` y `p_chaleco` (probabilidad de llevarlo): con menos, «sin casco» o «sin chaleco». */
  umbrales: z.object({ casco: probabilidad, chaleco: probabilidad }),
  /** Medidas del recorte que recibe el clasificador (RGB `float32` de 0 a 255). */
  entrada: z
    .object({
      alto: z.number().int().positive(),
      ancho: z.number().int().positive(),
      canales: z.literal(3).default(3),
      tipo: z.literal('float32').default('float32'),
    })
    .default({ alto: 224, ancho: 224, canales: 3, tipo: 'float32' }),
  /**
   * Orden de las probabilidades de la salida única `[1, 2]` del clasificador. Si tuviera dos salidas,
   * cada una se reconoce por su nombre (`casco` o `chaleco`) y, si no, en este orden.
   */
  salidas: z
    .tuple([atributo, atributo])
    .refine(([a, b]) => a !== b, 'salidas repetidas')
    .default(['casco', 'chaleco']),
});

export type ConfigEpp = z.infer<typeof esquemaConfigEpp>;

export function leerConfigEpp(json: unknown): ConfigEpp {
  return esquemaConfigEpp.parse(json);
}

/** `versionModelo` que se envía con la foto: `epp-<versión del clasificador>` (`epp-1.0.0`). */
export function versionModelo(config: Pick<ConfigEpp, 'version' | 'versionModelo'>): string {
  return config.versionModelo ?? `epp-${config.version}`;
}
