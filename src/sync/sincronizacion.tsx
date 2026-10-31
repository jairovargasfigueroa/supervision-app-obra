// Sincronización en la app (101): con la sesión abierta prepara la cola, descarga el paquete de datos,
// envía los pendientes del usuario con sus disparadores y da a las pantallas el contador, el estado de
// la red, «Enviar ahora», «Actualizar datos» y el registro de operaciones nuevas.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { ObtenerToken } from '../api/cliente';
import {
  adelantarPendientes,
  agregar,
  alCambiarCola,
  contarPendientes,
  listar,
  obtener,
  prepararCola,
  type NuevaOperacion,
  type Operacion,
} from './cola';
import { iniciarDisparadores } from './disparadores';
import { enviarPendientes, type ResumenEnvio } from './enviador';
import { alCambiarPaquete, descargarPaquete, leerPaquete, type PaqueteLocal } from './paquete';

export type UsuarioSincronizacion = { id: string; nombre: string };

/** Lo que pone la pantalla al registrar: el usuario lo agrega la sincronización. */
export type RegistroOperacion = Omit<NuevaOperacion, 'usuarioId' | 'usuarioNombre'>;

/** Cuánto espera un registro la respuesta del servidor antes de decir «Guardado en el celular» (criterio 8). */
export const ESPERA_REGISTRO_MS = 5_000;

/** Estado de la descarga del paquete de datos en esta sesión. */
export type EstadoDescarga = 'descargando' | 'lista' | 'fallida';

type ValorSincronizacion = {
  usuario: UsuarioSincronizacion;
  /** Según NetInfo; `true` hasta saberlo. */
  conectado: boolean;
  /** Operaciones del usuario que todavía no llegaron al servidor (contador del menú). */
  pendientes: number;
  enviando: boolean;
  descarga: EstadoDescarga;
  /** «Enviar ahora»: envía ya todos los pendientes, sin esperar su próximo intento. */
  enviarAhora: () => Promise<ResumenEnvio>;
  /** «Actualizar datos»: vuelve a pedir el paquete (con la versión guardada). Lanza el error si falla. */
  actualizarDatos: () => Promise<void>;
  /**
   * Guarda la operación en la cola del usuario, dispara el envío y espera hasta `esperarMs` (5 s) a
   * que termine: devuelve la operación como quedó (`ENVIADO`, `RECHAZADO` o todavía `PENDIENTE`).
   */
  registrar: (registro: RegistroOperacion, esperarMs?: number) => Promise<Operacion>;
};

const ContextoSincronizacion = createContext<ValorSincronizacion | null>(null);

export function useSincronizacion(): ValorSincronizacion {
  const valor = useContext(ContextoSincronizacion);
  if (!valor) {
    throw new Error('useSincronizacion se usa dentro de <SincronizacionProvider>');
  }
  return valor;
}

export const clavePaquete = (usuarioId: string) => ['sync', 'paquete', usuarioId] as const;
export const claveCola = (usuarioId: string) => ['sync', 'cola', usuarioId] as const;

/** El paquete guardado del usuario (`null` si nunca se descargó) y el estado de la descarga. */
export function usePaquete() {
  const { usuario, descarga, actualizarDatos, conectado } = useSincronizacion();
  const paquete = useQuery({
    queryKey: clavePaquete(usuario.id),
    queryFn: () => leerPaquete(usuario.id),
    retry: false,
  });
  return { paquete, descarga, actualizarDatos, conectado };
}

/** Las operaciones de la cola del usuario, en el orden en que se registraron. */
export function useOperaciones() {
  const { usuario } = useSincronizacion();
  return useQuery<Operacion[]>({
    queryKey: claveCola(usuario.id),
    queryFn: () => listar(usuario.id),
    retry: false,
  });
}

/** Espera a `promesa` hasta `ms` como máximo (sin dejar el temporizador andando). */
async function esperarHasta(promesa: Promise<unknown>, ms: number): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<void>((listo) => {
    temporizador = setTimeout(listo, ms);
  });
  try {
    await Promise.race([promesa, plazo]);
  } finally {
    clearTimeout(temporizador);
  }
}

type Props = {
  usuario: UsuarioSincronizacion;
  obtenerToken: ObtenerToken;
  children: ReactNode;
};

export function SincronizacionProvider({ usuario, obtenerToken, children }: Props) {
  const consultas = useQueryClient();
  const [conectado, setConectado] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [descarga, setDescarga] = useState<EstadoDescarga>('descargando');
  const montado = useRef(true);
  const lista = useRef<Promise<void> | null>(null);

  // La cola se prepara una vez por sesión, antes del primer envío (ENVIANDO → PENDIENTE, limpieza).
  const preparada = useCallback(() => {
    lista.current ??= prepararCola().catch(() => undefined);
    return lista.current;
  }, []);

  const enviarListos = useCallback(async () => {
    await preparada();
    if (montado.current) {
      setEnviando(true);
    }
    try {
      return await enviarPendientes({ usuarioId: usuario.id, obtenerToken });
    } finally {
      if (montado.current) {
        setEnviando(false);
      }
    }
  }, [usuario.id, obtenerToken, preparada]);

  const enviarAhora = useCallback(async () => {
    await preparada();
    await adelantarPendientes(usuario.id);
    return enviarListos();
  }, [usuario.id, preparada, enviarListos]);

  // Los disparadores envían solo lo que ya está listo (respetan la espera creciente).
  const enviar = useCallback(() => {
    enviarListos().catch((error: unknown) => console.warn('[sync] envío fallido', error));
  }, [enviarListos]);

  const actualizarDatos = useCallback(async () => {
    if (montado.current) {
      setDescarga('descargando');
    }
    try {
      await descargarPaquete({ obtenerToken, usuarioId: usuario.id });
      if (montado.current) {
        setDescarga('lista');
      }
    } catch (error) {
      if (montado.current) {
        setDescarga('fallida');
      }
      throw error;
    }
  }, [obtenerToken, usuario.id]);

  const registrar = useCallback(
    async (registro: RegistroOperacion, esperarMs = ESPERA_REGISTRO_MS) => {
      await preparada();
      const operacion = await agregar({ ...registro, usuarioId: usuario.id, usuarioNombre: usuario.nombre });
      const envio = enviarListos().catch(() => undefined);
      await esperarHasta(envio, esperarMs);
      return (await obtener(operacion.idOperacion)) ?? operacion;
    },
    [usuario.id, usuario.nombre, enviarListos, preparada],
  );

  // Contador y consultas de la cola y del paquete: se recalculan con cada cambio.
  useEffect(() => {
    let vigente = true;
    const contar = () => {
      contarPendientes(usuario.id)
        .then((n) => vigente && setPendientes(n))
        .catch(() => undefined);
      void consultas.invalidateQueries({ queryKey: claveCola(usuario.id) });
    };
    contar();
    const dejarCola = alCambiarCola(contar);
    const dejarPaquete = alCambiarPaquete(
      () => void consultas.invalidateQueries({ queryKey: clavePaquete(usuario.id) }),
    );
    return () => {
      vigente = false;
      dejarCola();
      dejarPaquete();
    };
  }, [usuario.id, consultas]);

  // Al abrir la app (o iniciar sesión) se descarga el paquete y se envía; después, con los disparadores.
  useEffect(() => {
    montado.current = true;
    actualizarDatos().catch(() => undefined);
    enviar();
    const detener = iniciarDisparadores({
      enviar,
      hayPendientes: async () => (await contarPendientes(usuario.id)) > 0,
      alCambiarConexion: (c) => {
        if (montado.current) {
          setConectado(c);
        }
      },
    });
    return () => {
      montado.current = false;
      detener();
    };
    // Solo al montar (una vez por usuario): `enviar` y `actualizarDatos` no cambian durante la sesión.
  }, [usuario.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const valor = useMemo<ValorSincronizacion>(
    () => ({ usuario, conectado, pendientes, enviando, descarga, enviarAhora, actualizarDatos, registrar }),
    [usuario, conectado, pendientes, enviando, descarga, enviarAhora, actualizarDatos, registrar],
  );

  return <ContextoSincronizacion.Provider value={valor}>{children}</ContextoSincronizacion.Provider>;
}

export type { PaqueteLocal };
