import { leerMovimientoRegistrado } from './materiales';

describe('respuesta de POST /movimientos guardada en la cola', () => {
  it('se lee si tiene la forma del contrato', () => {
    const respuesta = {
      id: 'mv1',
      periodo: '2026-11',
      superaStock: true,
      stock: { cantidad: -4.5, minimo: 100, estado: 'BAJO' },
      extra: 1,
    };
    expect(leerMovimientoRegistrado(respuesta)).toMatchObject({ superaStock: true, stock: { cantidad: -4.5 } });
  });

  it('otra forma (o un estado de stock desconocido) es null', () => {
    expect(leerMovimientoRegistrado(null)).toBeNull();
    expect(leerMovimientoRegistrado({ id: 'mv1' })).toBeNull();
    expect(
      leerMovimientoRegistrado({ id: 'mv1', periodo: 'x', superaStock: false, stock: { cantidad: 1, minimo: 1, estado: 'RARO' } }),
    ).toBeNull();
  });
});
