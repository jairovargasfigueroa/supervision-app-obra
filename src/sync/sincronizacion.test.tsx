import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { jsonRespuesta, simularFetch } from '../pruebas/fetch-simulado';
import { agregar, listar, obtener, tomarParaEnvio } from './cola';
import { SincronizacionProvider, useSincronizacion, type RegistroOperacion } from './sincronizacion';

const usuario = { id: 'u1', nombre: 'Ana Almacenera' };
const obtenerToken = jest.fn(async () => 'token-1');

let valor: ReturnType<typeof useSincronizacion>;
function Consumidor() {
  valor = useSincronizacion();
  return <Text>{`pendientes:${valor.pendientes}`}</Text>;
}

function registro(id: string): RegistroOperacion {
  return {
    idOperacion: id,
    tipo: 'MOVIMIENTO_MATERIAL',
    obraId: 'obra-1',
    datos: { id, obraId: 'obra-1', materialId: 'mat-1', tipo: 'INGRESO', cantidad: 5, registradoEn: '2026-11-15T14:00:00Z' },
    descripcion: 'Ingreso · 5 bolsas de Cemento IP-30',
  };
}

/** Sincronización procesa todo lo que llega; el paquete responde 304. */
function servidorQueProcesa() {
  return simularFetch().mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith('/lotes')) {
      const { operaciones } = JSON.parse(String(init.body)) as { operaciones: { idOperacion: string }[] };
      return jsonRespuesta(200, {
        resultados: operaciones.map((o) => ({
          idOperacion: o.idOperacion,
          estado: 'PROCESADO',
          status: 201,
          respuesta: { id: o.idOperacion, periodo: '2026-11', superaStock: false, stock: { cantidad: 5, minimo: 0, estado: 'OK' } },
        })),
      });
    }
    return new Response(null, { status: 304 });
  });
}

const montar = () =>
  render(
    <SincronizacionProvider usuario={usuario} obtenerToken={obtenerToken}>
      <Consumidor />
    </SincronizacionProvider>,
  );

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('SincronizacionProvider', () => {
  it('al abrir la app recupera lo que quedó ENVIANDO y lo envía', async () => {
    await agregar({ ...registro('a'), usuarioId: 'u1', usuarioNombre: 'Ana Almacenera' });
    await tomarParaEnvio('u1'); // la app se cerró a mitad del envío
    const red = servidorQueProcesa();

    await montar();

    await waitFor(async () => expect((await obtener('a'))?.estado).toBe('ENVIADO'));
    expect(red.mock.calls.some(([u]) => String(u).endsWith('/lotes'))).toBe(true);
    await waitFor(() => expect(screen.getByText('pendientes:0')).toBeTruthy());
  });

  it('registrar guarda con el usuario de la sesión y dispara el envío', async () => {
    servidorQueProcesa();
    await montar();

    await act(async () => {
      await valor.registrar(registro('b'));
    });

    const [guardada] = await listar('u1');
    expect(guardada).toMatchObject({ idOperacion: 'b', usuarioId: 'u1', usuarioNombre: 'Ana Almacenera' });
    await waitFor(async () => expect((await obtener('b'))?.estado).toBe('ENVIADO'));
  });

  it('sin señal el registro queda en la cola y el contador lo muestra', async () => {
    simularFetch(); // sin red
    await montar();

    await act(async () => {
      await valor.registrar(registro('c'));
    });

    await waitFor(() => expect(screen.getByText('pendientes:1')).toBeTruthy());
    expect((await obtener('c'))?.estado).toBe('PENDIENTE');
  });

  it('«Enviar ahora» envía sin esperar el próximo intento', async () => {
    simularFetch();
    await montar();
    await act(async () => {
      await valor.registrar(registro('d'));
    });
    await waitFor(() => expect(valor.enviando).toBe(false));

    expect((await obtener('d'))?.proximoIntentoEn).not.toBeNull();

    servidorQueProcesa();
    let resumen: Awaited<ReturnType<typeof valor.enviarAhora>> | undefined;
    await act(async () => {
      resumen = await valor.enviarAhora();
    });
    expect(resumen).toMatchObject({ enviadas: 1 });
    await waitFor(() => expect(screen.getByText('pendientes:0')).toBeTruthy());
  });
});
