// Estado de la pantalla Foto de avance (005): partida elegida, foto comprimida con su `fotoId` y
// avisos. La foto y su `fotoId` quedan en memoria hasta que se confirma el registro (criterio 5).
import { useCallback, useState } from 'react';

import { nuevoUuid } from '../nucleo/uuid';
import { obtenerFoto, type FotoTomada, type OrigenFoto } from './foto';
import { faltaParaEnviar } from './foto.esquema';

export const MENSAJE_SIN_PERMISO_CAMARA =
  'Para tomar la foto, permite el uso de la cámara en los ajustes del celular.';
/** docs/mensajes.md (`SUBIDA_INVALIDA`). */
export const MENSAJE_FOTO_NO_PREPARADA = 'La foto no se pudo preparar para el envío.';

/** Foto lista para enviar: el `fotoId` (UUID del registro) se crea al tenerla. */
export type FotoLista = FotoTomada & { fotoId: string };

export function useFotoAvance() {
  const [partidaId, setPartidaId] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoLista | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const elegirFoto = useCallback(async (origen: OrigenFoto) => {
    setAviso(null);
    setPreparando(true);
    try {
      const resultado = await obtenerFoto(origen);
      if (resultado.tipo === 'lista') {
        setFoto({ ...resultado.foto, fotoId: nuevoUuid() });
      } else if (resultado.tipo === 'sin-permiso') {
        setAviso(MENSAJE_SIN_PERMISO_CAMARA);
      }
    } catch {
      setAviso(MENSAJE_FOTO_NO_PREPARADA);
    } finally {
      setPreparando(false);
    }
  }, []);

  return {
    partidaId,
    setPartidaId,
    foto,
    setFoto,
    preparando,
    aviso,
    setAviso,
    elegirFoto,
    /** Lo primero que falta para enviar, o `null`. */
    falta: faltaParaEnviar({ partidaId, foto }),
  };
}
