import { rutaDeAviso } from './rutaDeAviso';

describe('rutaDeAviso', () => {
  it('STOCK_BAJO abre el stock de la obra', () => {
    expect(rutaDeAviso({ tipo: 'STOCK_BAJO', obraId: 'o1' })).toBe('/obras/o1/stock');
  });

  it('DIARIO abre el diario de la obra', () => {
    expect(rutaDeAviso({ tipo: 'DIARIO', obraId: 'o1' })).toBe('/obras/o1/diario');
  });

  it('codifica el id de la obra en la ruta', () => {
    expect(rutaDeAviso({ tipo: 'DIARIO', obraId: 'a b' })).toBe('/obras/a%20b/diario');
  });

  it('con otro tipo, sin obra o sin datos, no abre nada', () => {
    expect(rutaDeAviso({ tipo: 'PLANILLA', obraId: 'o1' })).toBeNull();
    expect(rutaDeAviso({ tipo: 'STOCK_BAJO' })).toBeNull();
    expect(rutaDeAviso({ tipo: 'STOCK_BAJO', obraId: '' })).toBeNull();
    expect(rutaDeAviso({ tipo: 'STOCK_BAJO', obraId: 7 })).toBeNull();
    expect(rutaDeAviso(undefined)).toBeNull();
    expect(rutaDeAviso(null)).toBeNull();
  });
});
