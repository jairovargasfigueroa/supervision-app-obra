import {
  nombreRoles,
  pestanasPorRol,
  rolesEfectivos,
  tieneAccesoApp,
  tieneAlgunRol,
} from './roles';

const titulos = (roles: string[]) => pestanasPorRol(roles).map((p) => p.titulo);

describe('pestanasPorRol (criterio 5)', () => {
  it('maestro → Mis obras y Foto de avance', () => {
    expect(titulos(['default-roles-supervision', 'maestro'])).toEqual(['Mis obras', 'Foto de avance']);
  });

  it('almacenero → Mis obras, Ingreso, Salida y Stock', () => {
    expect(titulos(['almacenero'])).toEqual(['Mis obras', 'Ingreso', 'Salida', 'Stock']);
  });

  it('con los dos roles → la unión sin repetir «Mis obras»', () => {
    expect(titulos(['almacenero', 'maestro'])).toEqual([
      'Mis obras',
      'Foto de avance',
      'Ingreso',
      'Salida',
      'Stock',
    ]);
  });

  it('sin maestro ni almacenero → ninguna', () => {
    expect(titulos(['residente', 'cliente', 'offline_access'])).toEqual([]);
    expect(titulos([])).toEqual([]);
  });
});

describe('roles de la app', () => {
  it('solo cuentan maestro y almacenero (los demás roles del token se ignoran)', () => {
    expect(rolesEfectivos(['cliente', 'almacenero', 'residente', 'maestro'])).toEqual([
      'maestro',
      'almacenero',
    ]);
  });

  it('acceso solo con maestro o almacenero (criterio 3)', () => {
    expect(tieneAccesoApp(['maestro'])).toBe(true);
    expect(tieneAccesoApp(['almacenero', 'cliente'])).toBe(true);
    expect(tieneAccesoApp(['admin', 'residente', 'gerente', 'cliente'])).toBe(false);
  });

  it('nombre del rol para la barra superior (criterio 11)', () => {
    expect(nombreRoles(['maestro'])).toBe('Maestro de obra');
    expect(nombreRoles(['almacenero', 'cliente'])).toBe('Almacenero');
    expect(nombreRoles(['almacenero', 'maestro'])).toBe('Maestro de obra · Almacenero');
    expect(nombreRoles(['residente'])).toBe('');
  });
});

describe('tieneAlgunRol', () => {
  it('cuenta solo los roles de la app', () => {
    expect(tieneAlgunRol(['maestro'], ['maestro'])).toBe(true);
    expect(tieneAlgunRol(['almacenero', 'residente'], ['maestro'])).toBe(false);
  });
});
