// Red simulada para las pruebas: `src/api/red.ts` está simulado en jest.setup.ts (sin respuesta
// definida, falla como «sin red»); cada prueba le da las respuestas que necesita.
import { enviar } from '../api/red';

/** La red simulada, sin respuestas previas. */
export function simularFetch(): jest.Mock {
  const simulada = jest.mocked(enviar);
  simulada.mockReset();
  simulada.mockRejectedValue(new TypeError('Network request failed'));
  return simulada as unknown as jest.Mock;
}

export function jsonRespuesta(estado: number, cuerpo: unknown, tipo = 'application/json'): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': tipo } });
}
