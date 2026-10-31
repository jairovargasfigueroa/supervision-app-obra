import type { Operacion } from './cola';
import { estadoStock, stockConPendientes } from './stock-local';

function op(id: string, tipo: 'INGRESO' | 'SALIDA', cantidad: number, extra: Partial<Operacion> = {}): Operacion {
  return {
    idOperacion: id,
    usuarioId: 'u1',
    usuarioNombre: 'Ana',
    tipo: 'MOVIMIENTO_MATERIAL',
    obraId: 'o1',
    datos: { id, obraId: 'o1', materialId: 'm1', tipo, cantidad },
    descripcion: '',
    estado: 'PENDIENTE',
    intentos: 0,
    proximoIntentoEn: null,
    errorCodigo: null,
    errorMensaje: null,
    respuesta: null,
    creadaEn: '2026-11-15T14:00:00.000Z',
    enviadaEn: null,
    ...extra,
  };
}

describe('stock local (criterio 9)', () => {
  it('estado: BAJO < mínimo ≤ JUSTO ≤ 1,25 × mínimo < OK', () => {
    expect(estadoStock(99.9, 100)).toBe('BAJO');
    expect(estadoStock(100, 100)).toBe('JUSTO');
    expect(estadoStock(125, 100)).toBe('JUSTO');
    expect(estadoStock(125.1, 100)).toBe('OK');
  });

  it('suma ingresos y resta salidas sin enviar de esa obra, y los cuenta', () => {
    const obra = { id: 'o1', stock: [{ materialId: 'm1', cantidad: 120, minimo: 100, estado: 'JUSTO' as const }] };
    const { filas, sinEnviar } = stockConPendientes(obra, [
      op('a', 'SALIDA', 30.1),
      op('b', 'INGRESO', 0.2, { estado: 'ENVIANDO' }),
      op('c', 'SALIDA', 50, { estado: 'ENVIADO' }), // ya está en el paquete
      op('d', 'SALIDA', 50, { estado: 'RECHAZADO' }),
      op('e', 'SALIDA', 50, { obraId: 'o2' }),
      op('f', 'INGRESO', 7, { datos: { materialId: 'm2', tipo: 'INGRESO', cantidad: 7 } }),
    ]);
    expect(sinEnviar).toBe(3);
    expect(filas).toEqual([
      { materialId: 'm1', cantidad: 90.1, minimo: 100, estado: 'BAJO' },
      { materialId: 'm2', cantidad: 7, minimo: 0, estado: 'OK' },
    ]);
  });

  it('sin pendientes deja el stock del paquete tal cual', () => {
    const obra = { id: 'o1', stock: [{ materialId: 'm1', cantidad: 120, minimo: 100, estado: 'JUSTO' as const }] };
    expect(stockConPendientes(obra, [])).toEqual({ filas: obra.stock, sinEnviar: 0 });
  });
});
