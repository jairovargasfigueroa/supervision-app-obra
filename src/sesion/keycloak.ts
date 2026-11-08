// Inicio de sesión con Keycloak (OIDC, realm supervision, cliente público app-obra) mediante
// expo-auth-session: código de autorización con PKCE S256, sin contraseña dentro de la app.
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { configuracion, emisor } from '../nucleo/configuracion';
import { vencimientoDelToken } from './token';
import { RenovacionRechazada } from './renovacion';
import type { Tokens } from './tokens';

// Solo hace algo en web: cierra la ventana emergente al volver del inicio de sesión.
WebBrowser.maybeCompleteAuthSession();

// `offline_access` (101, sesión larga): Keycloak entrega un refresh token «offline» que vale mientras la
// sesión offline no pase 30 días sin usarse, para enviar lo registrado aunque el celular pase días sin señal.
export const ALCANCES = ['openid', 'profile', 'offline_access'];

/**
 * Dirección a la que vuelve Keycloak. En Expo Go: `exp://localhost:8090/--/iniciar-sesion`; en un
 * development build: `appobra://iniciar-sesion`. Encaja con los redirect del realm (`exp://*` y
 * `appobra://*`). Lleva ruta porque Keycloak rechaza `appobra://` sola (URI sin autoridad).
 */
export function redirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'appobra', path: 'iniciar-sesion' });
}

let descubrimiento: Promise<AuthSession.DiscoveryDocument> | null = null;

/** Documento de descubrimiento del realm (se pide una vez; si falla, se vuelve a pedir). */
export function obtenerDescubrimiento(): Promise<AuthSession.DiscoveryDocument> {
  descubrimiento ??= AuthSession.fetchDiscoveryAsync(emisor(configuracion())).catch((error: unknown) => {
    descubrimiento = null;
    throw error;
  });
  return descubrimiento;
}

/** Respuesta de Keycloak → tokens a guardar. */
export function tokensDeRespuesta(
  respuesta: Pick<AuthSession.TokenResponse, 'accessToken' | 'refreshToken' | 'expiresIn' | 'issuedAt'>,
  refreshAnterior?: string,
): Tokens {
  const venceEn =
    respuesta.expiresIn != null
      ? respuesta.issuedAt + respuesta.expiresIn
      : (vencimientoDelToken(respuesta.accessToken) ?? respuesta.issuedAt);
  return {
    accessToken: respuesta.accessToken,
    refreshToken: respuesta.refreshToken ?? refreshAnterior,
    venceEn,
  };
}

/**
 * Abre el inicio de sesión de Keycloak en el navegador del sistema y canjea el código por los
 * tokens. Devuelve `null` si el usuario lo cerró sin entrar.
 */
export async function iniciarSesionKeycloak(): Promise<Tokens | null> {
  const discovery = await obtenerDescubrimiento();
  const { clientId } = configuracion();
  const uri = redirectUri();
  const pedido = new AuthSession.AuthRequest({
    clientId,
    redirectUri: uri,
    scopes: ALCANCES,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  });
  const resultado = await pedido.promptAsync(discovery);
  if (resultado.type === 'error') {
    throw resultado.error ?? new Error(resultado.errorCode ?? 'Error al iniciar sesión');
  }
  if (resultado.type !== 'success' || !pedido.codeVerifier) {
    return null;
  }
  const respuesta = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: resultado.params.code,
      redirectUri: uri,
      extraParams: { code_verifier: pedido.codeVerifier },
    },
    discovery,
  );
  return tokensDeRespuesta(respuesta);
}

/**
 * Renueva con el refresh token. Si Keycloak responde con un error OAuth (sesión vencida o cerrada)
 * lanza `RenovacionRechazada`; una falla de red se lanza tal cual.
 */
export async function renovarTokens(refreshToken: string): Promise<Tokens> {
  const discovery = await obtenerDescubrimiento();
  try {
    const respuesta = await AuthSession.refreshAsync(
      { clientId: configuracion().clientId, refreshToken },
      discovery,
    );
    return tokensDeRespuesta(respuesta, refreshToken);
  } catch (error) {
    if (error instanceof AuthSession.TokenError) {
      throw new RenovacionRechazada(error);
    }
    throw error;
  }
}

const FORMULARIO = { 'Content-Type': 'application/x-www-form-urlencoded' };

/**
 * Cierra la sesión en Keycloak. Primero revoca el refresh token «offline» en el `revocation_endpoint`
 * (101: así termina la sesión offline de 30 días; `token_type_hint=refresh_token`) y después hace
 * `POST` al `end_session_endpoint` con el refresh token (cierre por canal trasero de un cliente
 * público): termina también la sesión SSO y la próxima vez se vuelve a pedir la contraseña. Devuelve
 * `false` si algo no se pudo (sin conexión, por ejemplo).
 */
export async function cerrarSesionKeycloak(refreshToken: string): Promise<boolean> {
  try {
    const discovery = await obtenerDescubrimiento();
    const { clientId } = configuracion();
    let revocado = false;
    if (discovery.revocationEndpoint) {
      const revocacion = await fetch(discovery.revocationEndpoint, {
        method: 'POST',
        headers: FORMULARIO,
        body: new URLSearchParams({
          client_id: clientId,
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }).toString(),
      });
      revocado = revocacion.ok;
    }
    if (!discovery.endSessionEndpoint) {
      return false;
    }
    const respuesta = await fetch(discovery.endSessionEndpoint, {
      method: 'POST',
      headers: FORMULARIO,
      body: new URLSearchParams({ client_id: clientId, refresh_token: refreshToken }).toString(),
    });
    return revocado && respuesta.ok;
  } catch {
    return false;
  }
}
