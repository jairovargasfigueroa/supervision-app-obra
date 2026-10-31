// Estado de la pantalla Foto de avance (005 con la cola de la 101 y la 102): partida elegida, foto
// comprimida con su `fotoId` y su registro. Desde la 102 la foto no se sube en el momento: se guarda
// en el celular (`pendientes/{fotoId}.jpg`) y entra a la cola como operación `FOTO_AVANCE`; el
// subidor la sube a S3 cuando hay señal y después se envía el registro.
import { useCallback, useMemo, useState } from 'react';

import { MENSAJE_FOTO_NO_PREPARADA, MENSAJES } from '../api/errores';
import type { ObraPaquete } from '../api/sincronizacion';
import { nuevoUuid } from '../nucleo/uuid';
import { borrarArchivo, guardarFotoPendiente } from '../sync/archivos';
import {
  descripcionFoto,
  FOTOS_SIN_ENVIAR_PARA_AVISAR,
  MENSAJE_GUARDADO_EN_CELULAR,
  mensajeFotosSinEnviar,
  mensajeRechazo,
} from '../sync/mensajes';
import { useOperaciones, useSincronizacion } from '../sync/sincronizacion';
import { obtenerFoto, type FotoTomada, type OrigenFoto } from './foto';
import { faltaParaEnviar } from './foto.esquema';

export const MENSAJE_SIN_PERMISO_CAMARA =
  'Para tomar la foto, permite el uso de la cámara en los ajustes del celular.';
export const MENSAJE_FOTO_ENVIADA = 'Foto enviada.';

/** Foto lista para guardar: el `fotoId` (UUID del registro) se crea al tenerla. */
export type FotoLista = FotoTomada & { fotoId: string };

export function useFotoAvance(obra: ObraPaquete) {
  const { registrar } = useSincronizacion();
  const operaciones = useOperaciones();
  const [partidaId, setPartidaId] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoLista | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** «Foto enviada.» o «Guardado en el celular · se enviará cuando haya señal». */
  const [resultado, setResultado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  // Criterio 3: fotos del usuario guardadas en el celular que todavía no llegaron al servidor.
  const fotosSinEnviar = useMemo(
    () =>
      (operaciones.data ?? []).filter(
        (op) => op.tipo === 'FOTO_AVANCE' && (op.estado === 'PENDIENTE' || op.estado === 'ENVIANDO'),
      ).length,
    [operaciones.data],
  );

  const elegirFoto = useCallback(async (origen: OrigenFoto) => {
    setAviso(null);
    setFallo(null);
    setPreparando(true);
    try {
      const elegida = await obtenerFoto(origen);
      if (elegida.tipo === 'lista') {
        setFoto({ ...elegida.foto, fotoId: nuevoUuid() });
      } else if (elegida.tipo === 'sin-permiso') {
        setAviso(MENSAJE_SIN_PERMISO_CAMARA);
      }
    } catch {
      setAviso(MENSAJE_FOTO_NO_PREPARADA);
    } finally {
      setPreparando(false);
    }
  }, []);

  const falta = faltaParaEnviar({ partidaId, foto });

  /** «Enviar»: guarda la foto en el celular, la pone en la cola y dispara el envío (espera hasta 5 s). */
  const enviar = useCallback(async () => {
    if (falta !== null || !partidaId || !foto) {
      return;
    }
    setEnviando(true);
    setResultado(null);
    setFallo(null);
    let archivo: string | null = null;
    try {
      archivo = guardarFotoPendiente(foto.foto.uri, foto.fotoId);
    } catch {
      setEnviando(false);
      setAviso(MENSAJE_FOTO_NO_PREPARADA);
      return;
    }
    try {
      const partida = obra.partidas.find((p) => p.id === partidaId);
      const op = await registrar({
        idOperacion: foto.fotoId,
        tipo: 'FOTO_AVANCE',
        obraId: obra.id,
        datos: { id: foto.fotoId, obraId: obra.id, partidaId, tomadaEn: foto.tomadaEn },
        descripcion: descripcionFoto(partida),
        archivoLocal: archivo,
      });
      // Ya está en la cola: la siguiente foto es otro registro. La partida queda elegida.
      setFoto(null);
      if (op.estado === 'RECHAZADO') {
        setFallo(mensajeRechazo(op));
      } else {
        setResultado(op.estado === 'ENVIADO' ? MENSAJE_FOTO_ENVIADA : MENSAJE_GUARDADO_EN_CELULAR);
      }
    } catch {
      // No se pudo guardar en la cola: no queda nada a medias en el celular.
      borrarArchivo(archivo);
      setFallo(MENSAJES.ERROR_INTERNO);
    } finally {
      setEnviando(false);
    }
  }, [falta, partidaId, foto, obra, registrar]);

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
    enviando,
    /** Motivo del rechazo o del fallo al guardar, o `null`. */
    fallo,
    resultado,
    cerrarResultado: () => setResultado(null),
    /** «Tienes N fotos sin enviar; busca señal para enviarlas» con más de 100 (criterio 3), o `null`. */
    avisoFotosSinEnviar:
      fotosSinEnviar > FOTOS_SIN_ENVIAR_PARA_AVISAR ? mensajeFotosSinEnviar(fotosSinEnviar) : null,
  };
}
