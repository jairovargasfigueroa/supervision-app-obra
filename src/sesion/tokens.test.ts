import { contenidoSecureStore } from '../pruebas/secure-store-simulado';
import { borrarTokens, guardarTokens, leerTokens } from './tokens';

describe('tokens', () => {
  it('guarda y lee los tokens', async () => {
    await guardarTokens({ accessToken: 'a1', refreshToken: 'r1', venceEn: 1800000300 });
    await expect(leerTokens()).resolves.toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
      venceEn: 1800000300,
    });
  });

  it('sin tokens guardados no hay sesión', async () => {
    await expect(leerTokens()).resolves.toBeNull();
  });

  it('borra todos los tokens', async () => {
    await guardarTokens({ accessToken: 'a1', refreshToken: 'r1', venceEn: 1800000300 });
    await borrarTokens();
    expect(contenidoSecureStore()).toEqual({});
    await expect(leerTokens()).resolves.toBeNull();
  });
});
