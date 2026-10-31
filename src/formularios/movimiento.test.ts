import { avisoSuperaStock, avisoSuperaStockLocal } from './movimiento';
import {
  aRegistro,
  esquemaMovimiento,
  leerCantidad,
  MENSAJES_CAMPOS,
  VALORES_INICIALES,
  type ValoresMovimiento,
} from './movimiento.esquema';
import { primerError } from './useMovimiento';

const valores = (cambios: Partial<ValoresMovimiento>): ValoresMovimiento => ({ ...VALORES_INICIALES, ...cambios });

describe('cantidad (criterios 2 y 3)', () => {
  it('acepta coma o punto, mayor a 0 y hasta 3 decimales', () => {
    expect(leerCantidad('12,5')).toEqual({ tipo: 'ok', valor: 12.5 });
    expect(leerCantidad(' 12.125 ')).toEqual({ tipo: 'ok', valor: 12.125 });
    expect(leerCantidad('3')).toEqual({ tipo: 'ok', valor: 3 });
    expect(leerCantidad('0,001')).toEqual({ tipo: 'ok', valor: 0.001 });
  });

  it('rechaza vacía, cero, más de 3 decimales y lo que no es número', () => {
    expect(leerCantidad('')).toEqual({ tipo: 'falta' });
    expect(leerCantidad('0')).toEqual({ tipo: 'cero' });
    expect(leerCantidad('0,000')).toEqual({ tipo: 'cero' });
    expect(leerCantidad('1,2345')).toEqual({ tipo: 'decimales' });
    expect(leerCantidad('-5')).toEqual({ tipo: 'invalida' });
    expect(leerCantidad('1.000,5')).toEqual({ tipo: 'invalida' });
    expect(leerCantidad('doce')).toEqual({ tipo: 'invalida' });
  });
});

describe('esquema del formulario', () => {
  const mensajes = (tipo: 'INGRESO' | 'SALIDA', datos: ValoresMovimiento) => {
    const resultado = esquemaMovimiento(tipo).safeParse(datos);
    return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
  };

  it('ingreso: material y cantidad; la nota de remisión es opcional y no pide partida', () => {
    expect(mensajes('INGRESO', VALORES_INICIALES)).toEqual([MENSAJES_CAMPOS.material, MENSAJES_CAMPOS.cantidadFalta]);
    expect(mensajes('INGRESO', valores({ materialId: 'm1', cantidad: '10' }))).toEqual([]);
  });

  it('salida: la partida de destino es obligatoria', () => {
    expect(mensajes('SALIDA', valores({ materialId: 'm1', cantidad: '10' }))).toEqual([MENSAJES_CAMPOS.partida]);
    expect(mensajes('SALIDA', valores({ materialId: 'm1', cantidad: '0', partidaId: 'p1' }))).toEqual([
      MENSAJES_CAMPOS.cantidadCero,
    ]);
  });

  it('primerError lee el mensaje de un issue o de un texto', () => {
    expect(primerError([undefined, { message: 'Elige el material.' }])).toBe('Elige el material.');
    expect(primerError(['Texto'])).toBe('Texto');
    expect(primerError([])).toBeNull();
  });
});

describe('cuerpo de POST /movimientos', () => {
  const datos = { id: 'u1', obraId: 'o1', registradoEn: '2026-11-15T14:00:00.000Z' };

  it('ingreso con nota de remisión y sin partida', () => {
    expect(
      aRegistro('INGRESO', valores({ materialId: 'm1', cantidad: '12,5', notaRemision: ' NR-00123 ', partidaId: 'p1' }), datos),
    ).toEqual({
      id: 'u1', obraId: 'o1', materialId: 'm1', tipo: 'INGRESO', cantidad: 12.5,
      notaRemision: { numero: 'NR-00123' }, registradoEn: '2026-11-15T14:00:00.000Z',
    });
  });

  it('ingreso sin nota no la envía; salida con partida y sin nota', () => {
    expect(aRegistro('INGRESO', valores({ materialId: 'm1', cantidad: '1' }), datos)).not.toHaveProperty('notaRemision');
    expect(
      aRegistro('SALIDA', valores({ materialId: 'm1', cantidad: '3', partidaId: 'p1', notaRemision: 'NR-1' }), datos),
    ).toEqual({
      id: 'u1', obraId: 'o1', materialId: 'm1', tipo: 'SALIDA', cantidad: 3, partidaId: 'p1',
      registradoEn: '2026-11-15T14:00:00.000Z',
    });
  });
});

describe('aviso de stock superado (criterios 5 y 10)', () => {
  const cemento = { unidad: 'bolsa', unidadPlural: 'bolsas' };
  const stock = (cantidad: number) => ({ cantidad, minimo: 100, estado: 'BAJO' as const });

  it('salida mayor al stock: muestra el stock que había antes de la salida', () => {
    expect(avisoSuperaStock({ tipo: 'SALIDA', cantidad: 12.5 }, { superaStock: true, stock: stock(-4.5) }, cemento)).toBe(
      'La salida supera el stock registrado (stock: 8 bolsas). Queda como alerta para revisión',
    );
    expect(avisoSuperaStock({ tipo: 'SALIDA', cantidad: 5 }, { superaStock: true, stock: stock(-4) })).toBe(
      'La salida supera el stock registrado (stock: 1). Queda como alerta para revisión',
    );
  });

  it('sin superaStock o en un ingreso no hay aviso', () => {
    expect(avisoSuperaStock({ tipo: 'SALIDA', cantidad: 5 }, { superaStock: false, stock: stock(10) }, cemento)).toBeNull();
    expect(avisoSuperaStock({ tipo: 'INGRESO', cantidad: 5 }, { superaStock: true, stock: stock(10) }, cemento)).toBeNull();
  });

  it('sin señal: compara con el stock que mostraba la app (101, criterio 10)', () => {
    expect(avisoSuperaStockLocal({ tipo: 'SALIDA', cantidad: 12.5 }, 8, cemento)).toBe(
      'La salida supera el stock registrado (stock: 8 bolsas). Queda como alerta para revisión',
    );
    expect(avisoSuperaStockLocal({ tipo: 'SALIDA', cantidad: 8 }, 8, cemento)).toBeNull();
    expect(avisoSuperaStockLocal({ tipo: 'INGRESO', cantidad: 50 }, 8, cemento)).toBeNull();
  });
});
