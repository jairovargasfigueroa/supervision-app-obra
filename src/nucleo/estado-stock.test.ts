import { presentacionEstadoStock } from './estado-stock';

describe('estado del stock (criterio 9)', () => {
  it('mismos estados y tonos que el ERP', () => {
    expect(presentacionEstadoStock('BAJO')).toEqual({ etiqueta: 'Bajo', tono: 'error' });
    expect(presentacionEstadoStock('JUSTO')).toEqual({ etiqueta: 'Justo', tono: 'atencion' });
    expect(presentacionEstadoStock('OK')).toEqual({ etiqueta: 'OK', tono: 'exito' });
  });
});
