import { cambiosDeTemas, temaDeObra, temasDe } from './temas';

const obras = [{ id: 'o2' }, { id: 'o1' }];

describe('temasDe', () => {
  it('almacenero: un tema de almacenero por obra', () => {
    expect(temasDe(obras, ['almacenero'])).toEqual(['obra-o1-almacenero', 'obra-o2-almacenero']);
  });

  it('maestro: un tema de maestro por obra', () => {
    expect(temasDe(obras, ['maestro'])).toEqual(['obra-o1-maestro', 'obra-o2-maestro']);
  });

  it('con los dos roles, los dos temas de cada obra', () => {
    expect(temasDe([{ id: 'o1' }], ['maestro', 'almacenero'])).toEqual([
      'obra-o1-almacenero',
      'obra-o1-maestro',
    ]);
  });

  it('ignora los roles que no son de la app y no repite obras', () => {
    expect(temasDe([{ id: 'o1' }, { id: 'o1' }], ['residente', 'almacenero', 'offline_access'])).toEqual([
      'obra-o1-almacenero',
    ]);
  });

  it('sin obras o sin rol de la app, ningún tema', () => {
    expect(temasDe([], ['maestro'])).toEqual([]);
    expect(temasDe(obras, ['residente'])).toEqual([]);
  });

  it('con el id UUID de la obra', () => {
    const id = '2f0c7a8e-1b2c-4d5e-8f90-a1b2c3d4e5f6';
    expect(temasDe([{ id }], ['maestro'])).toEqual([`obra-${id}-maestro`]);
    expect(temaDeObra(id, 'almacenero')).toBe(`obra-${id}-almacenero`);
  });

  it('omite un id que no sirve como nombre de tema de FCM', () => {
    expect(temasDe([{ id: 'a/b' }, { id: 'o 1' }, { id: 'o1' }], ['maestro'])).toEqual(['obra-o1-maestro']);
  });
});

describe('cambiosDeTemas', () => {
  it('suscribe los nuevos y quita los que ya no están', () => {
    expect(
      cambiosDeTemas(['obra-o1-maestro', 'obra-o2-maestro'], ['obra-o2-maestro', 'obra-o3-maestro']),
    ).toEqual({ suscribir: ['obra-o3-maestro'], quitar: ['obra-o1-maestro'] });
  });

  it('la primera vez suscribe todos', () => {
    expect(cambiosDeTemas([], ['obra-o1-maestro'])).toEqual({ suscribir: ['obra-o1-maestro'], quitar: [] });
  });

  it('al cerrar sesión (sin temas nuevos) quita todos', () => {
    expect(cambiosDeTemas(['obra-o1-maestro', 'obra-o1-almacenero'], [])).toEqual({
      suscribir: [],
      quitar: ['obra-o1-maestro', 'obra-o1-almacenero'],
    });
  });

  it('sin cambios, nada que hacer', () => {
    expect(cambiosDeTemas(['obra-o1-maestro'], ['obra-o1-maestro'])).toEqual({ suscribir: [], quitar: [] });
  });
});
