// Estado de la pantalla Control de seguridad (301, criterios 10 y 11): el maestro toma o elige una foto
// de la cuadrilla, se comprime como la de avance (005) y se analiza en el celular. La foto y el
// resultado no se envían, no entran a la cola ni se guardan: el archivo comprimido (en la caché) se
// borra con «Otro control», con otra foto o al salir de la pantalla.
import { useCallback, useEffect, useRef, useState } from 'react';

import { MENSAJE_FOTO_NO_PREPARADA } from '../api/errores';
import { useAnalisisEpp } from '../avance/epp/useAnalisisEpp';
import { nuevoUuid } from '../nucleo/uuid';
import { borrarArchivo } from '../sync/archivos';
import { obtenerFoto, type FotoComprimida, type OrigenFoto } from './foto';
import { MENSAJE_SIN_PERMISO_CAMARA } from './useFotoAvance';

type FotoControl = FotoComprimida & { id: string };

export function useControlSeguridad() {
  const { estado, analizar, limpiar } = useAnalisisEpp();
  const [foto, setFoto] = useState<FotoControl | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const actual = useRef<FotoControl | null>(null);

  const descartar = useCallback(() => {
    borrarArchivo(actual.current?.uri);
    actual.current = null;
    setFoto(null);
    limpiar();
  }, [limpiar]);

  // Al salir de la pantalla la foto se descarta.
  useEffect(() => () => borrarArchivo(actual.current?.uri), []);

  const elegirFoto = useCallback(
    async (origen: OrigenFoto) => {
      setAviso(null);
      setPreparando(true);
      try {
        const elegida = await obtenerFoto(origen);
        if (elegida.tipo === 'lista') {
          descartar();
          const nueva = { ...elegida.foto.foto, id: nuevoUuid() };
          actual.current = nueva;
          setFoto(nueva);
          void analizar(nueva.id, nueva.uri);
        } else if (elegida.tipo === 'sin-permiso') {
          setAviso(MENSAJE_SIN_PERMISO_CAMARA);
        }
      } catch {
        setAviso(MENSAJE_FOTO_NO_PREPARADA);
      } finally {
        setPreparando(false);
      }
    },
    [analizar, descartar],
  );

  return {
    foto,
    analisisEpp: estado,
    preparando,
    aviso,
    elegirFoto,
    /** «Otro control»: descarta la foto y su resultado para tomar otra. */
    otroControl: descartar,
  };
}
