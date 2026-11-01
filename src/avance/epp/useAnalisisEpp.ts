// Estado del análisis de casco y chaleco en una pantalla (foto de avance y control de seguridad, 301):
// precarga los modelos al abrirla, analiza cada foto nueva y deja esperar el resultado (el envío lo
// espera si todavía se está analizando; como mucho 5 s).
import { useCallback, useEffect, useRef, useState } from 'react';

import { analizarConLimite, type EstadoAnalisis } from './analisis';
import { cargarModelos } from './modelos';

export type EstadoEpp = { estado: 'analizando' } | EstadoAnalisis;

export function useAnalisisEpp() {
  const [estado, setEstado] = useState<EstadoEpp | null>(null);
  const actual = useRef<{ id: string; promesa: Promise<EstadoAnalisis>; control: AbortController } | null>(null);

  // Los modelos se cargan una vez al abrir la pantalla; si fallan, se reintenta al analizar.
  useEffect(() => {
    cargarModelos().catch(() => undefined);
    // Al salir de la pantalla, el análisis en curso se cancela.
    return () => actual.current?.control.abort();
  }, []);

  /** Analiza la foto `uri` (identificada por `id`); el análisis de la foto anterior se cancela. */
  const analizar = useCallback((id: string, uri: string): Promise<EstadoAnalisis> => {
    actual.current?.control.abort();
    const control = new AbortController();
    const promesa = analizarConLimite(uri, undefined, undefined, control.signal);
    actual.current = { id, promesa, control };
    setEstado({ estado: 'analizando' });
    void promesa.then((resultado) => {
      if (actual.current?.id === id) {
        setEstado(resultado);
      }
    });
    return promesa;
  }, []);

  /** El resultado de la foto `id` (esperando si se está analizando), o `null` si no se analizó. */
  const resultadoDe = useCallback(
    (id: string): Promise<EstadoAnalisis | null> =>
      actual.current?.id === id ? actual.current.promesa : Promise.resolve(null),
    [],
  );

  /** Olvida la foto analizada (se quitó o se descartó) y cancela su análisis si sigue. */
  const limpiar = useCallback(() => {
    actual.current?.control.abort();
    actual.current = null;
    setEstado(null);
  }, []);

  return { estado, analizar, resultadoDe, limpiar };
}
