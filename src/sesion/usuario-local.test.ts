import { setItemAsync } from 'expo-secure-store';

import { borrarUsuarioLocal, CLAVE_USUARIO_LOCAL, guardarUsuarioLocal, leerUsuarioLocal } from './usuario-local';

const ana = { id: 'u1', nombre: 'Ana Quispe', usuario: 'ana', roles: ['almacenero', 'offline_access'] };

describe('usuarioLocal', () => {
  it('se guarda, se lee y se borra', async () => {
    await expect(leerUsuarioLocal()).resolves.toBeNull();
    await guardarUsuarioLocal(ana);
    await expect(leerUsuarioLocal()).resolves.toEqual(ana);
    await borrarUsuarioLocal();
    await expect(leerUsuarioLocal()).resolves.toBeNull();
  });

  it('lo que no tiene la forma esperada cuenta como que no hay', async () => {
    await setItemAsync(CLAVE_USUARIO_LOCAL, 'no es json');
    await expect(leerUsuarioLocal()).resolves.toBeNull();
    await setItemAsync(CLAVE_USUARIO_LOCAL, JSON.stringify({ id: 'u1' }));
    await expect(leerUsuarioLocal()).resolves.toBeNull();
  });
});
