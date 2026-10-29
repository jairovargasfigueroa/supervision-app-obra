import {
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentaje,
} from './formato';

describe('formato', () => {
  it('formatea montos en bolivianos con 2 decimales', () => {
    expect(formatearMonto(1250000)).toBe('Bs 1.250.000,00');
    expect(formatearMonto(1250)).toBe('Bs 1.250,00');
    expect(formatearMonto(999.5)).toBe('Bs 999,50');
    expect(formatearMonto(0)).toBe('Bs 0,00');
    expect(formatearMonto(0.5)).toBe('Bs 0,50');
    expect(formatearMonto(-1250.4)).toBe('Bs -1.250,40');
  });

  it('redondea montos mitad hacia arriba sin errores de coma flotante', () => {
    expect(formatearMonto(1.005)).toBe('Bs 1,01');
    expect(formatearMonto(1234567.125)).toBe('Bs 1.234.567,13');
    expect(formatearMonto(99999999999.995)).toBe('Bs 100.000.000.000,00');
    expect(formatearMonto(-0.001)).toBe('Bs 0,00');
  });

  it('formatea cantidades con hasta 3 decimales y la unidad', () => {
    expect(formatearCantidad(120.5, 'm²')).toBe('120,5 m²');
    expect(formatearCantidad(1234.5678, 'kg')).toBe('1.234,568 kg');
    expect(formatearCantidad(15, 'bolsa')).toBe('15 bolsa');
    expect(formatearCantidad(0.125, 'm³')).toBe('0,125 m³');
  });

  it('formatea porcentajes con hasta 1 decimal', () => {
    expect(formatearPorcentaje(32.5)).toBe('32,5 %');
    expect(formatearPorcentaje(100)).toBe('100 %');
    expect(formatearPorcentaje(33.333)).toBe('33,3 %');
  });

  it('formatea fechas sin hora sin cambiar el día', () => {
    expect(formatearFecha('2026-11-15')).toBe('15/11/2026');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
  });

  it('formatea instantes en hora de La Paz (UTC−4)', () => {
    expect(formatearFecha('2026-11-16T02:00:00Z')).toBe('15/11/2026');
    expect(formatearFecha(new Date('2026-11-15T12:00:00Z'))).toBe('15/11/2026');
    expect(formatearFechaHora('2026-11-15T18:30:00Z')).toBe('15/11/2026 14:30');
    expect(formatearFechaHora('2026-01-01T03:05:00Z')).toBe('31/12/2025 23:05');
    expect(formatearFechaHora('2026-11-15T14:30:00-04:00')).toBe('15/11/2026 14:30');
  });

  it('rechaza valores no válidos', () => {
    expect(() => formatearMonto(Number.NaN)).toThrow(RangeError);
    expect(() => formatearFechaHora('no es fecha')).toThrow(RangeError);
  });
});
