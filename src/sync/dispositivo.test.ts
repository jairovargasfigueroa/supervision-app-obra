import { contenidoSecureStore } from '../pruebas/secure-store-simulado';
import { CLAVE_DISPOSITIVO, idDispositivo, olvidarIdDispositivo } from './dispositivo';

describe('idDispositivo', () => {
  it('se crea una sola vez y se guarda en expo-secure-store', async () => {
    const [a, b] = await Promise.all([idDispositivo(), idDispositivo()]);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(b).toBe(a);
    expect(contenidoSecureStore()[CLAVE_DISPOSITIVO]).toBe(a);
  });

  it('al volver a abrir la app se lee el guardado', async () => {
    const primero = await idDispositivo();
    olvidarIdDispositivo();
    await expect(idDispositivo()).resolves.toBe(primero);
  });
});
