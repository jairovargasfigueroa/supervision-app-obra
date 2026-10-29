// Lo que hace falta para enviar una foto de avance (005, criterios 1 a 3).
import { z } from 'zod';

export const esquemaFotoAvance = z.object({
  partidaId: z.string({ error: 'Elige la partida.' }).min(1, 'Elige la partida.'),
  foto: z.object(
    {
      foto: z.object({ uri: z.string().min(1), ancho: z.number(), alto: z.number() }),
      tomadaEn: z.iso.datetime(),
    },
    { error: 'Toma una foto o elígela de la galería.' },
  ),
});

export type FotoAvance = z.infer<typeof esquemaFotoAvance>;

/** Primer dato que falta para poder enviar, o `null` si está todo. */
export function faltaParaEnviar(valores: { partidaId: string | null; foto: unknown }): string | null {
  const resultado = esquemaFotoAvance.safeParse(valores);
  return resultado.success ? null : (resultado.error.issues[0]?.message ?? null);
}
