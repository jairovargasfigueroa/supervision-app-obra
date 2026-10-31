// Sincronización en la app (101): con la sesión abierta prepara la cola, envía los pendientes del
// usuario con sus disparadores y da a las pantallas el contador, el estado de la red, «Enviar ahora» y
// el registro de operaciones nuevas.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { ObtenerToken } from '../api/cliente';
import {
  adelantarPendientes,
  agregar,
  alCambiarCola,
  contarPendientes,
  prepararCola,
  type NuevaOperacion,
  type Operacion,
} from './cola';
import { iniciarDisparadores } from './disparadores';
import { enviarPendientes, type ResumenEnvio } from './enviador';

export type UsuarioSincronizacion = { id: string; nombre: string };

/** Lo que pone la pantalla al registrar: el usuario lo agrega la sincronización. */
export type RegistroOperacion = Omit<NuevaOperacion, 'usuarioId' | 'usuarioNombre'>;

type ValorSincronizacion = {
  /** Según NetInfo; `true` hasta saberlo. */
  conectado: boolean;
  /** Operaciones del usuario que todavía no llegaron al servidor (contador del menú). */
  pendientes: number;
  enviando: boolean;
  /** «Enviar ahora»: envía ya todos los pendientes, sin esperar su próximo intento. */
  enviarAhora: () => Promise<ResumenEnvio>;
  /** Guarda la operación en la cola del usuario y dispara el envío (no espera a que termine). */
  registrar: (registro: RegistroOperacion) => Promise<Operacion>;
};

const ContextoSincronizacion = createContext<ValorSincronizacion | null>(null);

export function useSincronizacion(): ValorSincronizacion {
  const valor = useContext(ContextoSincronizacion);
  if (!valor) {
    throw new Error('useSincronizacion se usa dentro de <SincronizacionProvider>');
  }
  return valor;
}

type Props = {
  usuario: UsuarioSincronizacion;
  obtenerToken: ObtenerToken;
  children: ReactNode;
};

export function SincronizacionProvider({ usuario, obtenerToken, children }: Props) {
  const [conectado, setConectado] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
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

  const registrar = useCallback(
    async (registro: RegistroOperacion) => {
      await preparada();
      const operacion = await agregar({ ...registro, usuarioId: usuario.id, usuarioNombre: usuario.nombre });
      enviar();
      return operacion;
    },
    [usuario.id, usuario.nombre, enviar, preparada],
  );

  // Contador: se recalcula con cada cambio de la cola.
  useEffect(() => {
    let vigente = true;
    const contar = () => {
      contarPendientes(usuario.id)
        .then((n) => vigente && setPendientes(n))
        .catch(() => undefined);
    };
    contar();
    const dejar = alCambiarCola(contar);
    return () => {
      vigente = false;
      dejar();
    };
  }, [usuario.id]);

  // Al abrir la app (o iniciar sesión) se envía; después, con los disparadores.
  useEffect(() => {
    montado.current = true;
    enviar();
    const detener = iniciarDisparadores({
      enviar,
      hayPendientes: async () => (await contarPendientes(usuario.id)) > 0,
      alCambiarConexion: (c) => montado.current && setConectado(c),
    });
    return () => {
      montado.current = false;
      detener();
    };
  }, [enviar, usuario.id]);

  const valor = useMemo<ValorSincronizacion>(
    () => ({ conectado, pendientes, enviando, enviarAhora, registrar }),
    [conectado, pendientes, enviando, enviarAhora, registrar],
  );

  return <ContextoSincronizacion.Provider value={valor}>{children}</ContextoSincronizacion.Provider>;
}
