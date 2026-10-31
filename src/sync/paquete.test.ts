import { ErrorApi } from '../api/errores';
import type { PaqueteDatos } from '../api/sincronizacion';
import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';
import { idDispositivo } from './dispositivo';
import { descargarPaquete, leerPaquete } from './paquete';

const obtenerToken = async () => 'token-de-prueba';

function paquete(versionDatos: string, cantidad = 120): PaqueteDatos {
  return {
    versionDatos,
    generadoEn: '2026-11-15T13:00:00Z',
    obras: [
      {
        id: 'obra-1',
        nombre: 'Edificio Las Palmas',
        ubicacion: 'Av. Banzer 4to anillo',
        partidas: [{ id: 'partida-1', codigo: 'P-01', nombre: 'Losa', unidad: 'm2' }],
        stock: [{ materialId: 'mat-1', cantidad, minimo: 100, estado: 'JUSTO' }],
      },
    ],
    materiales: [
      { id: 'mat-1', codigo: 'CEM-IP30', nombre: 'Cemento IP-30', unidad: 'bolsa', unidadPlural: 'bolsas' },
    ],
  };
}

const enHora = (iso: string) => () => new Date(iso);

function encabezados(llamada: unknown[]): Record<string, string> {
  return (llamada[1] as RequestInit).headers as Record<string, string>;
}

describe('paquete de datos', () => {
  it('la primera vez lo descarga sin If-None-Match, con el idDispositivo, y lo guarda', async () => {
    const red = simularFetch().mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')));

    const { paquete: guardado, cambio } = await descargarPaquete({
      obtenerToken,
      usuarioId: 'u1',
      ahora: enHora('2026-11-15T13:00:05Z'),
    });

    expect(cambio).toBe(true);
    expect(red).toHaveBeenCalledTimes(1);
    expect(red.mock.calls[0][0]).toBe('http://localhost:8084/paquete-datos');
    const h = encabezados(red.mock.calls[0]);
    expect(h.Authorization).toBe('Bearer token-de-prueba');
    expect(h['X-Dispositivo-Id']).toBe(await idDispositivo());
    expect(h['If-None-Match']).toBeUndefined();
    expect(guardado.descargadoEn).toBe('2026-11-15T13:00:05.000Z');
    await expect(leerPaquete('u1')).resolves.toEqual({
      versionDatos: 'v1',
      contenido: paquete('v1'),
      descargadoEn: '2026-11-15T13:00:05.000Z',
    });
  });

  it('con 304 no lo vuelve a bajar: solo actualiza la hora de descarga', async () => {
    const red = simularFetch()
      .mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    await descargarPaquete({ obtenerToken, usuarioId: 'u1', ahora: enHora('2026-11-15T13:00:00Z') });

    const { paquete: guardado, cambio } = await descargarPaquete({
      obtenerToken,
      usuarioId: 'u1',
      ahora: enHora('2026-11-15T14:00:00Z'),
    });

    expect(encabezados(red.mock.calls[1])['If-None-Match']).toBe('"v1"');
    expect(cambio).toBe(false);
    expect(guardado.contenido).toEqual(paquete('v1'));
    await expect(leerPaquete('u1')).resolves.toMatchObject({
      versionDatos: 'v1',
      descargadoEn: '2026-11-15T14:00:00.000Z',
    });
  });

  it('si la versión cambió reemplaza el guardado', async () => {
    simularFetch()
      .mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')))
      .mockResolvedValueOnce(jsonRespuesta(200, paquete('v2', 80)));
    await descargarPaquete({ obtenerToken, usuarioId: 'u1' });
    await descargarPaquete({ obtenerToken, usuarioId: 'u1' });

    const guardado = await leerPaquete('u1');
    expect(guardado?.versionDatos).toBe('v2');
    expect(guardado?.contenido.obras[0].stock[0].cantidad).toBe(80);
  });

  it('envía la obra activa si la hay', async () => {
    const red = simularFetch().mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')));
    await descargarPaquete({ obtenerToken, usuarioId: 'u1', obraActivaId: 'obra-1' });
    expect(red.mock.calls[0][0]).toBe('http://localhost:8084/paquete-datos?obraActivaId=obra-1');
  });

  it('si falla la descarga conserva el paquete que tenía', async () => {
    simularFetch()
      .mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')))
      .mockResolvedValueOnce(
        jsonRespuesta(503, { title: 'Servicio no disponible', status: 503, codigo: 'SERVICIO_NO_DISPONIBLE' }),
      );
    await descargarPaquete({ obtenerToken, usuarioId: 'u1' });

    const error = await descargarPaquete({ obtenerToken, usuarioId: 'u1' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).fallo).toMatchObject({ tipo: 'http', estado: 503, codigo: 'SERVICIO_NO_DISPONIBLE' });
    await expect(leerPaquete('u1')).resolves.toMatchObject({ versionDatos: 'v1' });
  });

  it('sin señal la primera vez no hay paquete (criterio 4)', async () => {
    simularFetch();
    await expect(descargarPaquete({ obtenerToken, usuarioId: 'u1' })).rejects.toMatchObject({
      fallo: { tipo: 'red' },
    });
    await expect(leerPaquete('u1')).resolves.toBeNull();
  });

  it('una respuesta que no es la del contrato no se guarda', async () => {
    simularFetch().mockResolvedValueOnce(jsonRespuesta(200, { versionDatos: 'v1' }));
    await expect(descargarPaquete({ obtenerToken, usuarioId: 'u1' })).rejects.toMatchObject({
      fallo: { tipo: 'respuesta-invalida' },
    });
    await expect(leerPaquete('u1')).resolves.toBeNull();
  });

  it('cada usuario tiene su paquete', async () => {
    simularFetch().mockResolvedValueOnce(jsonRespuesta(200, paquete('v1')));
    await descargarPaquete({ obtenerToken, usuarioId: 'u1' });
    await expect(leerPaquete('u2')).resolves.toBeNull();
  });
});
