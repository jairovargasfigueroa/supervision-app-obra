import { crearJwt, tokenDeUsuario } from '../pruebas/jwt';
import { decodificarCargaJwt, usuarioDelToken, vencimientoDelToken } from './token';

describe('token', () => {
  it('decodifica la carga con tildes y eñes', () => {
    const jwt = crearJwt({ name: 'Ñandú Céspedes Peña', sub: 'abc' });
    expect(decodificarCargaJwt(jwt)).toEqual({ name: 'Ñandú Céspedes Peña', sub: 'abc' });
  });

  it('lee el usuario: id, nombre, usuario y roles del realm', () => {
    const jwt = tokenDeUsuario(['maestro'], { nombre: 'José Mamani', usuario: 'maestro1' });
    expect(usuarioDelToken(jwt)).toEqual({
      id: 'id-maestro1',
      nombre: 'José Mamani',
      usuario: 'maestro1',
      roles: ['default-roles-supervision', 'maestro'],
    });
  });

  it('usa el nombre de usuario si el token no trae nombre', () => {
    const jwt = crearJwt({ sub: 'x', preferred_username: 'almacenero1' });
    expect(usuarioDelToken(jwt)).toMatchObject({ nombre: 'almacenero1', roles: [] });
  });

  it('lee el vencimiento', () => {
    expect(vencimientoDelToken(crearJwt({ exp: 1700000000 }))).toBe(1700000000);
    expect(vencimientoDelToken(crearJwt({}))).toBeUndefined();
  });

  it('rechaza algo que no es un JWT', () => {
    expect(() => decodificarCargaJwt('no-es-un-token')).toThrow('El token no tiene un formato válido');
    expect(() => decodificarCargaJwt('a.%%%.c')).toThrow('El token no tiene un formato válido');
  });
});
