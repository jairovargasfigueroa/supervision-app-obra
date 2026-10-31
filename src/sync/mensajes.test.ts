import {
  descripcionMovimiento,
  mensajeIncluyeSinEnviar,
  mensajePendientesAlCerrar,
  mensajePendientesDeOtro,
  mensajeRechazo,
  mensajeSinSenal,
  sePuedeRegistrarHoy,
} from './mensajes';

const cemento = { nombre: 'Cemento IP-30', unidad: 'bolsa', unidadPlural: 'bolsas' };

describe('textos de la 101', () => {
  it('descripción de un movimiento (criterio 16)', () => {
    expect(descripcionMovimiento('SALIDA', 12.5, cemento, { codigo: 'P-01' })).toBe(
      'Salida · 12,5 bolsas de Cemento IP-30 · P-01',
    );
    expect(descripcionMovimiento('INGRESO', 1, cemento)).toBe('Ingreso · 1 bolsa de Cemento IP-30');
  });

  it('motivo del rechazo por código, sin el detail del servicio', () => {
    expect(
      mensajeRechazo({
        errorCodigo: 'PERIODO_CERRADO',
        respuesta: { status: 409, detail: 'El periodo 2026-10 ya está cerrado.' },
        datos: { registradoEn: '2026-12-01T02:00:00Z' },
      }),
    ).toBe('El periodo 2026-11 ya está cerrado');
    expect(mensajeRechazo({ errorCodigo: 'MATERIAL_INACTIVO', respuesta: { status: 422 }, datos: {} })).toBe(
      'El material está desactivado; no se puede usar en movimientos ni fijarle un mínimo.',
    );
    expect(mensajeRechazo({ errorCodigo: 'OPERACION_AJENA', respuesta: null, datos: {} })).toBe(
      'Este registro lo envió otro usuario y no se puede enviar con tu sesión.',
    );
    expect(mensajeRechazo({ errorCodigo: 'CODIGO_NUEVO', respuesta: { status: 422 }, datos: {} })).toBe(
      'No se pudo completar la operación porque no cumple una regla del sistema.',
    );
  });

  it('sin señal con la fecha de los datos en La Paz, y los movimientos sin enviar (criterios 3 y 9)', () => {
    expect(mensajeSinSenal('2026-11-15T18:30:00.000Z')).toBe('Sin señal · datos del 15/11 14:30');
    expect(mensajeIncluyeSinEnviar(3)).toBe('Incluye 3 movimientos sin enviar');
    expect(mensajeIncluyeSinEnviar(1)).toBe('Incluye 1 movimiento sin enviar');
  });

  it('pendientes de otro usuario (criterio 15) y «Registrar con fecha de hoy» solo por periodo cerrado (14b)', () => {
    expect(mensajePendientesDeOtro(2, 'Rosa Flores')).toBe(
      'Hay 2 registros de Rosa Flores sin enviar; se enviarán cuando esa persona vuelva a iniciar sesión',
    );
    const rechazo = { estado: 'RECHAZADO' as const, tipo: 'MOVIMIENTO_MATERIAL' as const };
    expect(sePuedeRegistrarHoy({ ...rechazo, errorCodigo: 'PERIODO_CERRADO' })).toBe(true);
    expect(sePuedeRegistrarHoy({ ...rechazo, errorCodigo: 'MATERIAL_INACTIVO' })).toBe(false);
    expect(sePuedeRegistrarHoy({ ...rechazo, estado: 'PENDIENTE', errorCodigo: 'PERIODO_CERRADO' })).toBe(false);
  });

  it('aviso al cerrar sesión con pendientes (criterio 18)', () => {
    expect(mensajePendientesAlCerrar(3)).toBe(
      'Tienes 3 registros sin enviar; se enviarán cuando vuelvas a iniciar sesión con este usuario',
    );
  });
});
