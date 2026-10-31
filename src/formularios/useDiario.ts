// Formulario de la entrada del diario de obra (103): fecha (hoy o uno de los 7 días anteriores en La
// Paz), clima y texto, con TanStack Form + Zod. La entrada se guarda en la cola con su UUID (creado al
// abrir el formulario) y se envía como `ENTRADA_DIARIO`; una sola por obra y día. Mientras no salió
// (`PENDIENTE`), se puede corregir: se reemplazan sus datos en la misma fila, con el mismo `id`.
import { useForm } from '@tanstack/react-form';
import { useCallback, useMemo, useState } from 'react';

import { MENSAJES } from '../api/errores';
import type { ObraPaquete } from '../api/sincronizacion';
import { nuevoUuid } from '../nucleo/uuid';
import { corregir as corregirEnCola } from '../sync/cola';
import { entradaDelDia, entradasDeObra, fechasElegibles, type EntradaDiario } from '../sync/diario-local';
import {
  descripcionDiario,
  MENSAJE_DIARIO_NO_CORREGIBLE,
  MENSAJE_GUARDADO_EN_CELULAR,
  mensajeDiarioYaRegistrado,
  mensajeRechazo,
} from '../sync/mensajes';
import { useOperaciones, useSincronizacion } from '../sync/sincronizacion';
import { aEntradaDiario, esquemaDiario, type ValoresDiario } from './diario.esquema';
import { MENSAJE_REGISTRADO } from './movimiento';

/** Se puede corregir mientras la operación está `PENDIENTE` (todavía no se está enviando). */
export function sePuedeCorregir(entrada: EntradaDiario): boolean {
  return entrada.operacion?.estado === 'PENDIENTE';
}

export function useDiario(obra: ObraPaquete) {
  const { registrar } = useSincronizacion();
  const operaciones = useOperaciones();
  const [idFormulario, setIdFormulario] = useState(nuevoUuid);
  /** Entrada que se está corrigiendo, o `null` si es una nueva. */
  const [editando, setEditando] = useState<EntradaDiario | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const entradas = useMemo(() => entradasDeObra(obra, operaciones.data ?? []), [obra, operaciones.data]);
  const elegibles = useMemo(() => fechasElegibles(), []);
  // Al corregir una entrada de un día que ya no está entre los elegibles, ese día se sigue mostrando.
  const fechas = editando && !elegibles.includes(editando.fecha) ? [...elegibles, editando.fecha] : elegibles;
  // Estables: TanStack Form vuelve a los valores iniciales si cambian entre renders.
  const valoresIniciales = useMemo<ValoresDiario>(() => ({ fecha: elegibles[0]!, clima: '', texto: '' }), [elegibles]);

  const terminarEdicion = (formApi: { reset: () => void }) => {
    setEditando(null);
    formApi.reset();
  };

  const formulario = useForm({
    defaultValues: valoresIniciales,
    validators: { onChange: esquemaDiario, onSubmit: esquemaDiario },
    onSubmit: async ({ value, formApi }) => {
      setResultado(null);
      setFallo(null);
      // Criterio 4: una sola entrada por obra y día (en el servidor o en el celular).
      if (entradaDelDia(entradas, value.fecha, editando?.id)) {
        setFallo(mensajeDiarioYaRegistrado(value.fecha));
        return;
      }
      const id = editando?.id ?? idFormulario;
      const datos = aEntradaDiario(value, { id, obraId: obra.id });
      const descripcion = descripcionDiario(datos.fecha, datos.clima);
      setEnviando(true);
      try {
        if (editando) {
          // Criterio 5: solo si todavía no salió del celular.
          if (!(await corregirEnCola(id, datos, descripcion))) {
            setFallo(MENSAJE_DIARIO_NO_CORREGIBLE);
            return;
          }
          terminarEdicion(formApi);
          setResultado(MENSAJE_GUARDADO_EN_CELULAR);
          return;
        }
        const op = await registrar({ idOperacion: id, tipo: 'ENTRADA_DIARIO', obraId: obra.id, datos, descripcion });
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

  /** «Corregir» una entrada sin enviar: la carga en el formulario. */
  const corregir = useCallback(
    (entrada: EntradaDiario) => {
      if (!sePuedeCorregir(entrada)) {
        return;
      }
      setFallo(null);
      setResultado(null);
      setEditando(entrada);
      formulario.setFieldValue('fecha', entrada.fecha);
      formulario.setFieldValue('clima', entrada.clima);
      formulario.setFieldValue('texto', entrada.texto);
    },
    [formulario],
  );

  const cancelarCorreccion = useCallback(() => {
    setFallo(null);
    setEditando(null);
    formulario.reset();
  }, [formulario]);

  const cerrarResultado = useCallback(() => setResultado(null), []);

  return {
    formulario,
    /** Entradas de los últimos 30 días (paquete y cola). */
    entradas: entradas as readonly EntradaDiario[],
    /** Hoy y los 7 días anteriores (La Paz). */
    fechas,
    editando,
    corregir,
    cancelarCorreccion,
    enviando,
    fallo,
    resultado,
    cerrarResultado,
  };
}
