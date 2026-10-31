// Sesión de la app: tokens guardados, usuario, inicio y cierre de sesión y renovación automática.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cerrarSesionKeycloak, iniciarSesionKeycloak, renovarTokens } from './keycloak';
import { asegurarVigencia, msHastaRenovar } from './renovacion';
import { usuarioDelToken, type Usuario } from './token';
import { borrarTokens, guardarTokens, leerTokens, type Tokens } from './tokens';
import { borrarUsuarioLocal, guardarUsuarioLocal, leerUsuarioLocal } from './usuario-local';

/** Mensajes de docs/mensajes.md. */
export const MENSAJES_SESION = {
  sesionTerminada: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  sinConexion: 'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
} as const;

/** Si una renovación falla por la red, se vuelve a intentar a los 30 s. */
const REINTENTO_RENOVACION_MS = 30_000;

export type EstadoSesion =
  | { estado: 'cargando' }
  /** `inicio`: abrió la app sin sesión · `vencida`: no se pudo renovar · `cerrada`: cerró sesión. */
  | { estado: 'sin-sesion'; motivo: 'inicio' | 'vencida' | 'cerrada' }
  | { estado: 'activa'; usuario: Usuario };

type ValorSesion = {
  sesion: EstadoSesion;
  /** El inicio de sesión de Keycloak está abierto. */
  iniciando: boolean;
  /** Error del último intento de iniciar sesión. */
  error: string | null;
  iniciarSesion: () => Promise<void>;
  /** Abre el inicio de sesión de Keycloak solo, una vez, al abrir la app sin sesión (criterio 1). */
  iniciarSesionAlAbrir: () => void;
  cerrarSesion: () => Promise<void>;
  /**
   * Token de acceso vigente (lo renueva si hace falta, o siempre con `renovar`); `null` si la sesión
   * terminó.
   */
  obtenerToken: (opciones?: { renovar?: boolean }) => Promise<string | null>;
};

const ContextoSesion = createContext<ValorSesion | null>(null);

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) {
    throw new Error('useSesion se usa dentro de <SesionProvider>');
  }
  return valor;
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: 'cargando' });
  const [venceEn, setVenceEn] = useState<number | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const tokensRef = useRef<Tokens | null>(null);
  const renovacionRef = useRef<Promise<string | null> | null>(null);

  // `usuario`: el guardado en el celular (101, sesión sin señal); si no, el del token. El usuario queda
  // guardado como `usuarioLocal` para la próxima vez que se abra la app sin señal.
  const activar = useCallback((tokens: Tokens, usuario?: Usuario) => {
    tokensRef.current = tokens;
    const activo = usuario ?? usuarioDelToken(tokens.accessToken);
    setVenceEn(tokens.venceEn);
    setSesion({ estado: 'activa', usuario: activo });
    guardarUsuarioLocal(activo).catch(() => undefined);
  }, []);

  const terminar = useCallback(async (motivo: 'vencida' | 'cerrada') => {
    tokensRef.current = null;
    setVenceEn(null);
    await borrarTokens();
    await borrarUsuarioLocal();
    setSesion({ estado: 'sin-sesion', motivo });
  }, []);

  const obtenerToken = useCallback((opciones?: { renovar?: boolean }): Promise<string | null> => {
    const tokens = tokensRef.current;
    if (!tokens) {
      return Promise.resolve(null);
    }
    // Una sola renovación a la vez, aunque varias pantallas pidan el token juntas.
    renovacionRef.current ??= asegurarVigencia(tokens, renovarTokens, undefined, opciones?.renovar)
      .then(async (resultado) => {
        if (resultado.tipo === 'vencida') {
          await terminar('vencida');
          return null;
        }
        if (resultado.renovado) {
          await guardarTokens(resultado.tokens);
          activar(resultado.tokens);
        }
        return resultado.tokens.accessToken;
      })
      .finally(() => {
        renovacionRef.current = null;
      });
    return renovacionRef.current;
  }, [activar, terminar]);

  // Al abrir la app: recupera la sesión guardada y la renueva si venció.
  useEffect(() => {
    let vigente = true;
    (async () => {
      const guardados = await leerTokens();
      if (!vigente) {
        return;
      }
      if (!guardados) {
        setSesion({ estado: 'sin-sesion', motivo: 'inicio' });
        return;
      }
      tokensRef.current = guardados;
      try {
        // Renueva antes de mostrar nada si venció; si ya no se puede, queda en «sesión terminada».
        if ((await obtenerToken()) && vigente && tokensRef.current) {
          activar(tokensRef.current);
        }
      } catch {
        // Sin conexión (101, criterio 6): se entra con el último usuario guardado aunque el token haya
        // vencido; los envíos esperan a que se renueve, que se reintenta más tarde.
        const local = await leerUsuarioLocal().catch(() => null);
        if (vigente) {
          activar(guardados, local ?? undefined);
          setReintento((n) => n + 1);
        }
      }
    })();
    return () => {
      vigente = false;
    };
  }, [activar, obtenerToken]);

  // Renovación automática un minuto antes de que venza (criterio 8), sin interrumpir al usuario.
  useEffect(() => {
    if (venceEn == null) {
      return;
    }
    const espera = reintento > 0 ? REINTENTO_RENOVACION_MS : msHastaRenovar({ venceEn });
    const temporizador = setTimeout(() => {
      obtenerToken()
        .then(() => setReintento(0))
        .catch(() => setReintento((n) => n + 1));
    }, espera);
    return () => clearTimeout(temporizador);
  }, [venceEn, reintento, obtenerToken]);

  const iniciarSesion = useCallback(async () => {
    if (iniciando) {
      return;
    }
    setIniciando(true);
    setError(null);
    try {
      const tokens = await iniciarSesionKeycloak();
      if (tokens) {
        await guardarTokens(tokens);
        activar(tokens);
      }
    } catch {
      setError(MENSAJES_SESION.sinConexion);
    } finally {
      setIniciando(false);
    }
  }, [iniciando, activar]);

  const abiertoAlInicio = useRef(false);
  const iniciarSesionAlAbrir = useCallback(() => {
    if (abiertoAlInicio.current || sesion.estado !== 'sin-sesion' || sesion.motivo !== 'inicio') {
      return;
    }
    abiertoAlInicio.current = true;
    void iniciarSesion();
  }, [sesion, iniciarSesion]);

  // Cerrar sesión: primero se borran los tokens del celular (aunque no haya conexión) y después se
  // cierra la sesión en Keycloak con el end_session_endpoint del realm.
  const cerrarSesion = useCallback(async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    await terminar('cerrada');
    if (refreshToken) {
      // Si no hay conexión, la sesión de Keycloak vence sola (10 h); en el celular ya no queda nada.
      await cerrarSesionKeycloak(refreshToken);
    }
  }, [terminar]);

  const valor = useMemo<ValorSesion>(
    () => ({
      sesion,
      iniciando,
      error,
      iniciarSesion,
      iniciarSesionAlAbrir,
      cerrarSesion,
      obtenerToken,
    }),
    [sesion, iniciando, error, iniciarSesion, iniciarSesionAlAbrir, cerrarSesion, obtenerToken],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
