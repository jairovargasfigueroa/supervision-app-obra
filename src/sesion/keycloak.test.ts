import * as AuthSession from 'expo-auth-session';

import { crearJwt } from '../pruebas/jwt';
import { cerrarSesionKeycloak, renovarTokens, tokensDeRespuesta } from './keycloak';
import { RenovacionRechazada } from './renovacion';

jest.mock('expo-auth-session', () => ({
  ...jest.requireActual('expo-auth-session'),
  fetchDiscoveryAsync: jest.fn(),
  refreshAsync: jest.fn(),
}));

jest.mock('../nucleo/configuracion', () => ({
  ...jest.requireActual('../nucleo/configuracion'),
  configuracion: () => ({
    keycloakUrl: 'http://localhost:8080',
    realm: 'supervision',
    clientId: 'app-obra',
    obrasUrl: 'http://localhost:8081',
    materialesUrl: 'http://localhost:8082',
    sincronizacionUrl: 'http://localhost:8084',
  }),
}));

const DESCUBRIMIENTO: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'http://localhost:8080/realms/supervision/protocol/openid-connect/auth',
  tokenEndpoint: 'http://localhost:8080/realms/supervision/protocol/openid-connect/token',
  endSessionEndpoint: 'http://localhost:8080/realms/supervision/protocol/openid-connect/logout',
};

const refreshMock = jest.mocked(AuthSession.refreshAsync);

const fetchOriginal = globalThis.fetch;

describe('keycloak', () => {
  beforeEach(() => {
    jest.mocked(AuthSession.fetchDiscoveryAsync).mockResolvedValue(DESCUBRIMIENTO);
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('calcula el vencimiento con expires_in', () => {
    expect(
      tokensDeRespuesta({ accessToken: 'a', refreshToken: 'r', expiresIn: 300, issuedAt: 1000 }),
    ).toEqual({ accessToken: 'a', refreshToken: 'r', venceEn: 1300 });
  });

  it('sin expires_in usa el exp del token y conserva el refresh anterior', () => {
    const acceso = crearJwt({ exp: 2000 });
    expect(
      tokensDeRespuesta({ accessToken: acceso, refreshToken: undefined, issuedAt: 1000 }, 'r0'),
    ).toEqual({ accessToken: acceso, refreshToken: 'r0', venceEn: 2000 });
  });

  it('renueva con el refresh token del cliente app-obra', async () => {
    refreshMock.mockResolvedValue(
      new AuthSession.TokenResponse({
        accessToken: 'a2',
        refreshToken: 'r2',
        expiresIn: 300,
        issuedAt: 1000,
      }),
    );
    await expect(renovarTokens('r1')).resolves.toEqual({
      accessToken: 'a2',
      refreshToken: 'r2',
      venceEn: 1300,
    });
    expect(refreshMock).toHaveBeenCalledWith(
      { clientId: 'app-obra', refreshToken: 'r1' },
      DESCUBRIMIENTO,
    );
  });

  it('Keycloak rechaza la renovación (invalid_grant) → RenovacionRechazada', async () => {
    refreshMock.mockRejectedValue(
        new AuthSession.TokenError({ error: 'invalid_grant', error_description: 'Session not active' }),
      );
    await expect(renovarTokens('r1')).rejects.toBeInstanceOf(RenovacionRechazada);
  });

  it('falla de red al renovar → se lanza tal cual (no cierra la sesión)', async () => {
    refreshMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(renovarTokens('r1')).rejects.toThrow(TypeError);
  });

  it('cierra la sesión con un POST al end_session_endpoint (client_id y refresh_token)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(cerrarSesionKeycloak('r1')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(DESCUBRIMIENTO.endSessionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_id=app-obra&refresh_token=r1',
    });
  });

  it('sin conexión el cierre en Keycloak no falla: devuelve false', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(cerrarSesionKeycloak('r1')).resolves.toBe(false);
  });
});
