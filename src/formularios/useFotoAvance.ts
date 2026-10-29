// Estado de la pantalla Foto de avance (005): partida elegida, foto comprimida con su `fotoId`,
// envío y avisos. La foto, su `fotoId` y lo ya enviado quedan en memoria hasta que se confirma el
// registro (criterio 5): «Reintentar» sigue con lo mismo, sin volver a tomar la foto.
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import { MENSAJE_FOTO_NO_PREPARADA } from '../api/errores';
import { pedirUrlSubida, registrarFoto } from '../api/obras';
import { leerArchivo, subirArchivo } from '../api/subida';
import { nuevoUuid } from '../nucleo/uuid';
import { useSesion } from '../sesion/sesion';
import { obtenerFoto, type FotoTomada, type OrigenFoto } from './foto';
import {
  decidirTrasError,
  enviarFoto,
  nuevoEnvio,
  type DependenciasEnvio,
  type EnvioFoto,
} from './foto.envio';
import { faltaParaEnviar } from './foto.esquema';

export const MENSAJE_SIN_PERMISO_CAMARA =
  'Para tomar la foto, permite el uso de la cámara en los ajustes del celular.';
export const MENSAJE_FOTO_ENVIADA = 'Foto enviada.';

/** Foto lista para enviar: el `fotoId` (UUID del registro) se crea al tenerla. */
export type FotoLista = FotoTomada & { fotoId: string };

export function useFotoAvance(obraId: string) {
  const { obtenerToken } = useSesion();
  const [partidaId, setPartida] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoLista | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const envioRef = useRef<EnvioFoto | null>(null);

  const dependencias = useMemo<DependenciasEnvio>(
    () => ({
      pedirUrlSubida: (obra, fotoId) => pedirUrlSubida(obra, fotoId, obtenerToken),
      registrarFoto: (obra, registro) => registrarFoto(obra, registro, obtenerToken),
      leerArchivo,
      subirArchivo,
      ahora: Date.now,
    }),
    [obtenerToken],
  );

  const descartarFoto = useCallback(() => {
    setFoto(null);
    envioRef.current = null;
  }, []);

  const envio = useMutation({
    mutationFn: ({ envio: actual, partida }: { envio: EnvioFoto; partida: string }) =>
      enviarFoto(actual, partida, dependencias),
    onSuccess: () => {
      descartarFoto();
      setEnviada(true);
    },
    onError: (error) => {
      if (decidirTrasError(error).accion === 'tomar-otra') {
        descartarFoto();
      }
    },
  });
  const { reset: limpiarEnvio, mutate } = envio;

  const elegirFoto = useCallback(
    async (origen: OrigenFoto) => {
      setAviso(null);
      setPreparando(true);
      try {
        const resultado = await obtenerFoto(origen);
        if (resultado.tipo === 'lista') {
          const fotoId = nuevoUuid();
          envioRef.current = nuevoEnvio({
            obraId,
            fotoId,
            archivoUri: resultado.foto.foto.uri,
            tomadaEn: resultado.foto.tomadaEn,
          });
          setFoto({ ...resultado.foto, fotoId });
          limpiarEnvio();
        } else if (resultado.tipo === 'sin-permiso') {
          setAviso(MENSAJE_SIN_PERMISO_CAMARA);
        }
      } catch {
        setAviso(MENSAJE_FOTO_NO_PREPARADA);
      } finally {
        setPreparando(false);
      }
    },
    [obraId, limpiarEnvio],
  );

  const setPartidaId = useCallback(
    (id: string) => {
      setPartida(id);
      limpiarEnvio();
    },
    [limpiarEnvio],
  );

  const falta = faltaParaEnviar({ partidaId, foto });

  /** «Enviar» y «Reintentar»: sigue el envío de la foto actual (mismo `fotoId`). */
  const enviar = useCallback(() => {
    if (falta !== null || !partidaId || !envioRef.current) {
      return;
    }
    setEnviada(false);
    mutate({ envio: envioRef.current, partida: partidaId });
  }, [falta, partidaId, mutate]);

  return {
    partidaId,
    setPartidaId,
    foto,
    preparando,
    aviso,
    elegirFoto,
    /** Lo primero que falta para enviar, o `null`. */
    falta,
    enviar,
    enviando: envio.isPending,
    /** Qué hacer después de un envío fallido (mensaje y acción), o `null`. */
    fallo: envio.isError ? decidirTrasError(envio.error) : null,
    enviada,
    cerrarAvisoEnviada: () => setEnviada(false),
  };
}
