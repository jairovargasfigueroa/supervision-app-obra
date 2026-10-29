import { asegurarVigencia, msHastaRenovar, necesitaRenovar, RenovacionRechazada } from './renovacion';
import type { Tokens } from './tokens';

const AHORA = 1_800_000_000;
const vigentes: Tokens = { accessToken: 'a1', refreshToken: 'r1', venceEn: AHORA + 300 };
const vencidos: Tokens = { accessToken: 'a1', refreshToken: 'r1', venceEn: AHORA - 10 };
const renovados: Tokens = { accessToken: 'a2', refreshToken: 'r2', venceEn: AHORA + 300 };

describe('necesitaRenovar', () => {
  it('no renueva un token con más de un minuto de vida', () => {
    expect(necesitaRenovar({ venceEn: AHORA + 61 }, AHORA)).toBe(false);
  });

  it('renueva cuando falta un minuto o menos, o ya venció', () => {
    expect(necesitaRenovar({ venceEn: AHORA + 60 }, AHORA)).toBe(true);
    expect(necesitaRenovar({ venceEn: AHORA - 1 }, AHORA)).toBe(true);
  });

  it('calcula cuánto falta para renovar', () => {
    expect(msHastaRenovar({ venceEn: AHORA + 300 }, AHORA)).toBe(240_000);
    expect(msHastaRenovar({ venceEn: AHORA - 5 }, AHORA)).toBe(0);
  });
});

describe('asegurarVigencia', () => {
  it('vigente → usa los mismos tokens sin llamar a Keycloak', async () => {
    const renovar = jest.fn();
    await expect(asegurarVigencia(vigentes, renovar, AHORA)).resolves.toEqual({
      tipo: 'vigente',
      tokens: vigentes,
      renovado: false,
    });
    expect(renovar).not.toHaveBeenCalled();
  });

  it('vencido → renueva con el refresh token', async () => {
    const renovar = jest.fn().mockResolvedValue(renovados);
    await expect(asegurarVigencia(vencidos, renovar, AHORA)).resolves.toEqual({
      tipo: 'vigente',
      tokens: renovados,
      renovado: true,
    });
    expect(renovar).toHaveBeenCalledWith('r1');
  });

  it('Keycloak rechaza la renovación → sesión vencida', async () => {
    const renovar = jest.fn().mockRejectedValue(new RenovacionRechazada());
    await expect(asegurarVigencia(vencidos, renovar, AHORA)).resolves.toEqual({ tipo: 'vencida' });
  });

  it('sin refresh token → sesión vencida', async () => {
    const renovar = jest.fn();
    await expect(
      asegurarVigencia({ ...vencidos, refreshToken: undefined }, renovar, AHORA),
    ).resolves.toEqual({ tipo: 'vencida' });
    expect(renovar).not.toHaveBeenCalled();
  });

  it('falla de red → lanza el error (la sesión no se pierde)', async () => {
    const renovar = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(asegurarVigencia(vencidos, renovar, AHORA)).rejects.toThrow('Network request failed');
  });
});
