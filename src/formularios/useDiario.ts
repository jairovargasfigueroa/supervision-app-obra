// Formulario de la entrada del diario de obra (103): fecha (hoy o uno de los 7 días anteriores en La
// Paz), clima y texto, con TanStack Form + Zod. La entrada se guarda en la cola con su UUID (creado al
// abrir el formulario) y se envía como `ENTRADA_DIARIO`; una sola por obra y día.
import { useForm } from '@tanstack/react-form';
import { useCallback, useMemo, useState } from 'react';

import { MENSAJES } from '../api/errores';
import type { ObraPaquete } from '../api/sincronizacion';
import { nuevoUuid } from '../nucleo/uuid';
import { entradaDelDia, entradasDeObra, fechasElegibles, type EntradaDiario } from '../sync/diario-local';
import {
  descripcionDiario,
  MENSAJE_GUARDADO_EN_CELULAR,
  mensajeDiarioYaRegistrado,
  mensajeRechazo,
} from '../sync/mensajes';
import { useOperaciones, useSincronizacion } from '../sync/sincronizacion';
import { aEntradaDiario, esquemaDiario, type ValoresDiario } from './diario.esquema';
import { MENSAJE_REGISTRADO } from './movimiento';

export function useDiario(obra: ObraPaquete) {
  const { registrar } = useSincronizacion();
  const operaciones = useOperaciones();
  const [idFormulario, setIdFormulario] = useState(nuevoUuid);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const entradas = useMemo(() => entradasDeObra(obra, operaciones.data ?? []), [obra, operaciones.data]);
  const fechas = useMemo(() => fechasElegibles(), []);
  const valoresIniciales: ValoresDiario = { fecha: fechas[0]!, clima: '', texto: '' };

  const formulario = useForm({
    defaultValues: valoresIniciales,
    validators: { onChange: esquemaDiario, onSubmit: esquemaDiario },
    onSubmit: async ({ value, formApi }) => {
      setResultado(null);
      setFallo(null);
      // Criterio 4: una sola entrada por obra y día (en el servidor o en el celular).
      if (entradaDelDia(entradas, value.fecha)) {
        setFallo(mensajeDiarioYaRegistrado(value.fecha));
        return;
      }
      const datos = aEntradaDiario(value, { id: idFormulario, obraId: obra.id });
      setEnviando(true);
      try {
        const op = await registrar({
          idOperacion: datos.id,
          tipo: 'ENTRADA_DIARIO',
          obraId: obra.id,
          datos,
          descripcion: descripcionDiario(datos.fecha, datos.clima),
        });
        setIdFormulario(nuevoUuid());
        if (op.estado === 'RECHAZADO') {
          setFallo(mensajeRechazo(op));
          return;
        }
        formApi.reset();
        setResultado(op.estado === 'ENVIADO' ? MENSAJE_REGISTRADO : MENSAJE_GUARDADO_EN_CELULAR);
      } catch {
        setFallo(MENSAJES.ERROR_INTERNO);
      } finally {
        setEnviando(false);
      }
    },
  });

  const cerrarResultado = useCallback(() => setResultado(null), []);

  return {
    formulario,
    /** Entradas de los últimos 30 días (paquete y cola). */
    entradas: entradas as readonly EntradaDiario[],
    /** Hoy y los 7 días anteriores (La Paz). */
    fechas,
    enviando,
    fallo,
    resultado,
    cerrarResultado,
  };
}
