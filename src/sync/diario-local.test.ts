import type { Operacion } from './cola';
import { entradaDelDia, entradasDeObra, fechasElegibles } from './diario-local';

// 23:30 del 15/11 en La Paz = 03:30Z del 16/11.
const AHORA = new Date('2026-11-16T03:30:00Z');

function op(id: string, fecha: string, estado: Operacion['estado'], extra: Partial<Operacion> = {}): Operacion {
  return {
    idOperacion: id,
    usuarioId: 'u1',
    usuarioNombre: 'Freddy',
    tipo: 'ENTRADA_DIARIO',
    obraId: 'o1',
    datos: { id, obraId: 'o1', fecha, clima: 'NUBLADO', texto: `Entrada ${id}` },
    descripcion: '',
    archivoLocal: null,
    estadoArchivo: 'NINGUNO',
    estado,
    intentos: 0,
    proximoIntentoEn: null,
    errorCodigo: estado === 'RECHAZADO' ? 'FECHA_DIARIO_INVALIDA' : null,
    errorMensaje: null,
    respuesta: null,
    creadaEn: '2026-11-15T20:00:00.000Z',
    enviadaEn: null,
    ...extra,
  };
}

const obra = {
  id: 'o1',
  diario: [
    { id: 's1', fecha: '2026-11-14', clima: 'SOLEADO' as const, texto: 'Del servidor' },
    { id: 'viejo', fecha: '2026-10-17', clima: 'SOLEADO' as const, texto: 'El día 30 contando hoy' },
    { id: 'muy-viejo', fecha: '2026-10-16', clima: 'SOLEADO' as const, texto: 'El día 31' },
  ],
};

describe('diario en el celular (103)', () => {
  it('junta el paquete y la cola, de la más reciente a la más antigua, últimos 30 días (criterio 7)', () => {
    const entradas = entradasDeObra(
      obra,
      [
        op('p1', '2026-11-15', 'PENDIENTE'),
        op('r1', '2026-11-13', 'RECHAZADO'),
        op('s1', '2026-11-14', 'ENVIADO'), // ya vino en el paquete: no se repite
        op('e1', '2026-11-12', 'ENVIADO'), // enviada, el paquete todavía no la trae
        op('otra-obra', '2026-11-15', 'PENDIENTE', { obraId: 'o2' }),
        op('mov', '2026-11-15', 'PENDIENTE', { tipo: 'MOVIMIENTO_MATERIAL' }),
      ],
      AHORA,
    );
    expect(entradas.map((e) => [e.id, e.estado])).toEqual([
      ['p1', 'SIN_ENVIAR'],
      ['s1', 'ENVIADA'],
      ['r1', 'RECHAZADA'],
      ['e1', 'ENVIADA'],
      ['viejo', 'ENVIADA'],
    ]);
    expect(entradas[0]).toMatchObject({ clima: 'NUBLADO', texto: 'Entrada p1', operacion: { idOperacion: 'p1' } });
  });

  it('hoy y los 7 días anteriores en hora de La Paz, sin días futuros (criterio 2)', () => {
    expect(fechasElegibles(AHORA)).toEqual([
      '2026-11-15',
      '2026-11-14',
      '2026-11-13',
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
      '2026-11-09',
      '2026-11-08',
    ]);
    expect(fechasElegibles(new Date('2026-03-01T12:00:00Z')).slice(0, 2)).toEqual(['2026-03-01', '2026-02-28']);
  });

  it('una sola entrada por día: en el servidor o en el celular, sin contar rechazadas ni la que se corrige (criterio 4)', () => {
    const entradas = entradasDeObra(obra, [op('p1', '2026-11-15', 'PENDIENTE'), op('r1', '2026-11-13', 'RECHAZADO')], AHORA);
    expect(entradaDelDia(entradas, '2026-11-14')?.id).toBe('s1');
    expect(entradaDelDia(entradas, '2026-11-15')?.id).toBe('p1');
    expect(entradaDelDia(entradas, '2026-11-15', 'p1')).toBeNull();
    expect(entradaDelDia(entradas, '2026-11-13')).toBeNull();
    expect(entradaDelDia(entradas, '2026-11-11')).toBeNull();
  });
});
