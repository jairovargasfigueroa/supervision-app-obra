import {
  nombreRoles,
  pantallasObraPorRol,
  pestanasPorRol,
  rolesEfectivos,
  rutaDeObra,
  tieneAccesoApp,
  tieneAlgunRol,
} from './roles';

const titulos = (roles: string[]) => pestanasPorRol(roles).map((p) => p.titulo);

describe('pestanasPorRol (criterio 5)', () => {
  it('maestro → Mis obras y Foto de avance (y Pendientes, 101)', () => {
    expect(titulos(['default-roles-supervision', 'maestro'])).toEqual(['Mis obras', 'Foto de avance', 'Pendientes']);
  });

  it('almacenero → Mis obras, Ingreso, Salida y Stock (y Pendientes, 101)', () => {
    expect(titulos(['almacenero'])).toEqual(['Mis obras', 'Ingreso', 'Salida', 'Stock', 'Pendientes']);
  });

  it('con los dos roles → la unión sin repetir «Mis obras»', () => {
    expect(titulos(['almacenero', 'maestro'])).toEqual([
      'Mis obras',
      'Foto de avance',
      'Ingreso',
      'Salida',
      'Stock',
      'Pendientes',
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

describe('pantallas de una obra («Mis obras»)', () => {
  const acciones = (roles: string[]) => pantallasObraPorRol(roles).map((pantalla) => pantalla.accion);

  it('maestro → Foto de avance; almacenero → Ingreso, Salida y Stock; con los dos, todas', () => {
    expect(acciones(['maestro'])).toEqual(['Foto de avance', 'Diario de obra']);
    expect(acciones(['almacenero', 'residente'])).toEqual(['Ingreso', 'Salida', 'Stock']);
    expect(acciones(['almacenero', 'maestro'])).toEqual(['Foto de avance', 'Diario de obra', 'Ingreso', 'Salida', 'Stock']);
    expect(acciones(['residente'])).toEqual([]);
  });

  it('rutaDeObra arma la dirección con el id de la obra', () => {
    expect(rutaDeObra('obras/[id]/ingreso', 'o1')).toBe('/obras/o1/ingreso');
  });
});
