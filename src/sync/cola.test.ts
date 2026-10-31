import {
  adelantarPendientes,
  agregar,
  contarPendientes,
  descartar,
  listar,
  marcarEnviada,
  marcarParaReintento,
  marcarRechazada,
  obtener,
  pendientesDeOtros,
  prepararCola,
  tomarParaEnvio,
  type NuevaOperacion,
} from './cola';

const T0 = new Date('2026-11-15T14:00:00.000Z');
const mas = (ms: number, desde = T0) => new Date(desde.getTime() + ms);
const HORA = 3_600_000;

function nueva(id: string, usuarioId = 'u1', extra: Partial<NuevaOperacion> = {}): NuevaOperacion {
  return {
    idOperacion: id,
    usuarioId,
    usuarioNombre: usuarioId === 'u1' ? 'Ana Almacenera' : 'Beto Almacenero',
    tipo: 'MOVIMIENTO_MATERIAL',
    obraId: 'obra-1',
    datos: { id, obraId: 'obra-1', materialId: 'mat-1', tipo: 'SALIDA', cantidad: 12.5, partidaId: 'p-1' },
    descripcion: 'Salida · 12,5 bolsas de Cemento IP-30 · P-01',
    ...extra,
  };
}

const ids = (ops: { idOperacion: string }[]) => ops.map((o) => o.idOperacion);

describe('cola de envíos', () => {
  it('agrega PENDIENTE con sus datos y lista en el orden en que se registraron', async () => {
    await agregar(nueva('b'), mas(1000));
    await agregar(nueva('a'), T0);
    await agregar(nueva('c'), mas(1000)); // mismo milisegundo que «b»: va después

    const ops = await listar('u1');
    expect(ids(ops)).toEqual(['a', 'b', 'c']);
    expect(ops[0]).toMatchObject({
      estado: 'PENDIENTE',
      intentos: 0,
      proximoIntentoEn: null,
      creadaEn: T0.toISOString(),
      datos: nueva('a').datos,
      usuarioNombre: 'Ana Almacenera',
    });
  });

  it('el mismo idOperacion dos veces no se duplica', async () => {
    await agregar(nueva('a'), T0);
    const otra = await agregar(nueva('a', 'u1', { descripcion: 'otra' }), mas(5000));
    expect(otra).toMatchObject({ descripcion: nueva('a').descripcion, creadaEn: T0.toISOString() });
    expect(await listar('u1')).toHaveLength(1);
  });

  it('filtra por usuario y cuenta solo lo que no llegó al servidor', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('b'), mas(1));
    await agregar(nueva('c'), mas(2));
    await agregar(nueva('d'), mas(3));
    await agregar(nueva('x', 'u2'), mas(4));
    await tomarParaEnvio('u1', mas(10), 1); // «a» queda ENVIANDO
    await marcarEnviada('b', {}, mas(10));
    await marcarRechazada('c', 'PERIODO_CERRADO', 'El periodo 2026-10 ya está cerrado.', {});

    expect(ids(await listar('u2'))).toEqual(['x']);
    expect(await contarPendientes('u1')).toBe(2); // «a» (ENVIANDO) y «d» (PENDIENTE)
    expect(await contarPendientes('u2')).toBe(1);
  });

  it('cuenta los pendientes de otros usuarios con su nombre (criterio 15)', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('x1', 'u2'), mas(1));
    await agregar(nueva('x2', 'u2'), mas(2));
    await agregar(nueva('x3', 'u2'), mas(3));
    await marcarEnviada('x3', {}, mas(4));
    await agregar(nueva('y1', 'u3', { usuarioNombre: 'Carla' }), mas(5));
    await marcarRechazada('y1', 'MATERIAL_INACTIVO', null, {});

    expect(await pendientesDeOtros('u1')).toEqual([{ usuarioId: 'u2', usuarioNombre: 'Beto Almacenero', cantidad: 2 }]);
    expect(await pendientesDeOtros('u2')).toEqual([{ usuarioId: 'u1', usuarioNombre: 'Ana Almacenera', cantidad: 1 }]);
  });

  it('descarta PENDIENTE y RECHAZADO, pero no lo que se está enviando o ya se envió', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('b'), mas(1));
    await agregar(nueva('c'), mas(2));
    await agregar(nueva('d'), mas(3));
    await tomarParaEnvio('u1', mas(10), 1); // «a» ENVIANDO
    await marcarEnviada('b', {}, mas(10));
    await marcarRechazada('c', 'MATERIAL_INACTIVO', null, {});

    expect(await descartar('a')).toBe(false);
    expect(await descartar('b')).toBe(false);
    expect(await descartar('c')).toBe(true);
    expect(await descartar('d')).toBe(true);
    expect(await descartar('no-existe')).toBe(false);
    expect(ids(await listar('u1'))).toEqual(['a', 'b']);
  });

  it('toma hasta 20 listas del usuario, en orden, y las marca ENVIANDO', async () => {
    for (let i = 0; i < 22; i++) {
      await agregar(nueva(`op-${String(i).padStart(2, '0')}`), mas(i));
    }
    await agregar(nueva('ajena', 'u2'), mas(1));

    const lote = await tomarParaEnvio('u1', mas(HORA));
    expect(lote).toHaveLength(20);
    expect(ids(lote)).toEqual(Array.from({ length: 20 }, (_, i) => `op-${String(i).padStart(2, '0')}`));
    expect(lote.every((o) => o.estado === 'ENVIANDO')).toBe(true);
    expect((await obtener('op-00'))?.estado).toBe('ENVIANDO');

    // Las ENVIANDO no se vuelven a tomar.
    expect(ids(await tomarParaEnvio('u1', mas(HORA)))).toEqual(['op-20', 'op-21']);
    expect(await tomarParaEnvio('u1', mas(HORA))).toEqual([]);
  });

  it('respeta la hora del próximo intento', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('b'), mas(1));
    await tomarParaEnvio('u1', T0);
    await marcarParaReintento('a', 1, mas(2000), 'SERVICIO_NO_DISPONIBLE');

    expect(await obtener('a')).toMatchObject({
      estado: 'PENDIENTE',
      intentos: 1,
      proximoIntentoEn: mas(2000).toISOString(),
      errorCodigo: 'SERVICIO_NO_DISPONIBLE',
    });
    expect(await tomarParaEnvio('u1', mas(1999))).toEqual([]);
    expect(ids(await tomarParaEnvio('u1', mas(2000)))).toEqual(['a']);
  });

  it('«Enviar ahora» deja listos los PENDIENTE del usuario', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('x', 'u2'), T0);
    await tomarParaEnvio('u1', T0);
    await tomarParaEnvio('u2', T0);
    await marcarParaReintento('a', 3, mas(HORA));
    await marcarParaReintento('x', 3, mas(HORA));

    await adelantarPendientes('u1');

    expect(await obtener('a')).toMatchObject({ proximoIntentoEn: null, intentos: 3 });
    expect((await obtener('x'))?.proximoIntentoEn).toBe(mas(HORA).toISOString());
  });

  it('guarda la respuesta del enviado y el motivo del rechazado', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('b'), mas(1));
    const respuesta = { id: 'a', periodo: '2026-11', superaStock: false, stock: { cantidad: 107.5 } };
    await marcarEnviada('a', respuesta, mas(3000));
    const problema = { status: 409, codigo: 'PERIODO_CERRADO', detail: 'El periodo 2026-10 ya está cerrado.' };
    await marcarRechazada('b', 'PERIODO_CERRADO', problema.detail, problema);

    expect(await obtener('a')).toMatchObject({ estado: 'ENVIADO', respuesta, enviadaEn: mas(3000).toISOString() });
    expect(await obtener('b')).toMatchObject({
      estado: 'RECHAZADO',
      errorCodigo: 'PERIODO_CERRADO',
      errorMensaje: problema.detail,
      respuesta: problema,
      datos: nueva('b').datos,
    });
  });

  it('al abrir la app, lo que quedó ENVIANDO vuelve a PENDIENTE y se borran los enviados de hace más de 24 h', async () => {
    await agregar(nueva('a'), T0);
    await agregar(nueva('viejo'), T0);
    await agregar(nueva('reciente'), T0);
    await agregar(nueva('rechazado'), T0);
    await tomarParaEnvio('u1', T0, 1); // «a» ENVIANDO
    await marcarEnviada('viejo', {}, T0);
    await marcarEnviada('reciente', {}, mas(2 * HORA));
    await marcarRechazada('rechazado', 'MATERIAL_INACTIVO', null, {});

    await prepararCola(mas(24 * HORA + 1));

    expect((await obtener('a'))?.estado).toBe('PENDIENTE');
    expect(await obtener('viejo')).toBeNull();
    expect((await obtener('reciente'))?.estado).toBe('ENVIADO');
    expect((await obtener('rechazado'))?.estado).toBe('RECHAZADO');
  });
});
