import {
  formatearCantidad,
  fechaLaPaz,
  formatearCantidadMaterial,
  formatearDiaMes,
  restarDias,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentaje,
  periodoLaPaz,
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

  it('periodo AAAA-MM en hora de La Paz', () => {
    expect(periodoLaPaz('2026-11-15T14:00:00Z')).toBe('2026-11');
    // 1 de diciembre a las 02:00 UTC todavía es 30 de noviembre en La Paz.
    expect(periodoLaPaz('2026-12-01T02:00:00Z')).toBe('2026-11');
    expect(periodoLaPaz('2027-01-01T04:00:00Z')).toBe('2027-01');
  });

  it('cantidad de un material con la unidad en singular o plural', () => {
    expect(formatearCantidadMaterial(1, 'bolsa', 'bolsas')).toBe('1 bolsa');
    expect(formatearCantidadMaterial(12.5, 'bolsa', 'bolsas')).toBe('12,5 bolsas');
    expect(formatearCantidadMaterial(0, 'bolsa', 'bolsas')).toBe('0 bolsas');
  });

  it('rechaza valores no válidos', () => {
    expect(() => formatearMonto(Number.NaN)).toThrow(RangeError);
    expect(() => formatearFechaHora('no es fecha')).toThrow(RangeError);
  });
});

describe('fechas del diario (103)', () => {
  it('el día en La Paz, días hacia atrás y dd/mm', () => {
    expect(fechaLaPaz('2026-11-16T03:30:00Z')).toBe('2026-11-15');
    expect(fechaLaPaz('2026-11-16T04:00:00Z')).toBe('2026-11-16');
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28');
    expect(restarDias('2026-01-03', 7)).toBe('2025-12-27');
    expect(formatearDiaMes('2026-11-05')).toBe('05/11');
  });
});
