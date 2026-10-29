import { ErrorApi } from '../api/errores';
import type { FilaStock, RegistroMovimiento } from '../api/materiales';
import {
  actualizarFilaStock,
  avisoSuperaStock,
  mensajeFalloMovimiento,
  registroParaEnviar,
} from './movimiento';
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

describe('registroParaEnviar: el UUID del registro (criterio 6)', () => {
  const contexto = (pendiente: RegistroMovimiento | null) => ({
    obraId: 'o1',
    idFormulario: 'id-formulario',
    pendiente,
    ahora: () => new Date('2026-11-15T14:00:00Z'),
    nuevoId: () => 'id-nuevo',
  });
  const datos = valores({ materialId: 'm1', cantidad: '10', partidaId: 'p1' });

  it('el primer envío usa el UUID creado al abrir el formulario', () => {
    expect(registroParaEnviar('SALIDA', datos, contexto(null))).toMatchObject({
      id: 'id-formulario',
      registradoEn: '2026-11-15T14:00:00.000Z',
    });
  });

  it('volver a enviar lo mismo repite el registro pendiente: mismo id y misma fecha', () => {
    const pendiente = registroParaEnviar('SALIDA', datos, {
      ...contexto(null),
      ahora: () => new Date('2026-11-15T13:00:00Z'),
    });
    const repetido = registroParaEnviar('SALIDA', valores({ ...datos, cantidad: '10,000' }), contexto(pendiente));
    expect(repetido).toBe(pendiente);
  });

  it('si cambiaron los datos, es otro registro con otro id', () => {
    const pendiente = registroParaEnviar('SALIDA', datos, contexto(null));
    expect(registroParaEnviar('SALIDA', valores({ ...datos, cantidad: '11' }), contexto(pendiente))).toMatchObject({
      id: 'id-nuevo',
      cantidad: 11,
    });
  });
});

describe('avisos (criterios 5 y 7)', () => {
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

  it('periodo cerrado con el mes del movimiento en La Paz', () => {
    const cerrado = new ErrorApi({ tipo: 'http', estado: 409, codigo: 'PERIODO_CERRADO' });
    expect(mensajeFalloMovimiento(cerrado, { registradoEn: '2026-12-01T02:00:00Z' })).toBe(
      'El periodo 2026-11 ya está cerrado',
    );
    const inactivo = new ErrorApi({ tipo: 'http', estado: 422, codigo: 'MATERIAL_INACTIVO' });
    expect(mensajeFalloMovimiento(inactivo, { registradoEn: '2026-11-15T14:00:00Z' })).toBe(
      'El material está desactivado; no se puede usar en movimientos ni fijarle un mínimo.',
    );
  });
});

describe('stock tras registrar (criterio 4)', () => {
  it('actualiza solo la fila del material', () => {
    const filas: FilaStock[] = [
      { materialId: 'm1', codigo: 'CEM', nombre: 'Cemento', unidad: 'bolsa', unidadPlural: 'bolsas', cantidad: 120, minimo: 100, estado: 'JUSTO' },
      { materialId: 'm2', codigo: 'FIE', nombre: 'Fierro', unidad: 'barra', unidadPlural: 'barras', cantidad: 50, minimo: 10, estado: 'OK' },
    ];
    const nuevas = actualizarFilaStock(filas, 'm1', { cantidad: 90, minimo: 100, estado: 'BAJO' });
    expect(nuevas[0]).toMatchObject({ cantidad: 90, estado: 'BAJO' });
    expect(nuevas[1]).toBe(filas[1]);
  });
});
