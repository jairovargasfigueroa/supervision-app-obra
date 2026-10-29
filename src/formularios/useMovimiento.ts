// Estado del formulario de ingreso o salida de material (004): campos con TanStack Form + Zod, el
// `id` del registro (UUID de expo-crypto creado al abrir el formulario y reutilizado en cada
// reintento de ese mismo registro), el envío y los avisos.
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  claveStock,
  materialesActivosQuery,
  registrarMovimiento,
  type FilaStock,
  type RegistroMovimiento,
  type TipoMovimiento,
} from '../api/materiales';
import { nuevoUuid } from '../nucleo/uuid';
import { useSesion } from '../sesion/sesion';
import {
  actualizarFilaStock,
  avisoSuperaStock,
  mensajeFalloMovimiento,
  registroParaEnviar,
} from './movimiento';
import { esquemaMovimiento, VALORES_INICIALES } from './movimiento.esquema';

/** Primer mensaje de error de un campo (TanStack Form guarda los *issues* del esquema). */
export function primerError(errores: readonly unknown[]): string | null {
  for (const error of errores) {
    if (typeof error === 'string' && error) {
      return error;
    }
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return null;
}

export function useMovimiento(tipo: TipoMovimiento, obraId: string) {
  const { obtenerToken } = useSesion();
  const queryClient = useQueryClient();
  const materiales = useQuery(materialesActivosQuery(obtenerToken));
  // El UUID del registro se crea al abrir el formulario (diseño 004) y se renueva al registrar.
  const [idFormulario, setIdFormulario] = useState(nuevoUuid);
  // Último registro enviado y todavía sin confirmar: «Registrar» lo repite tal cual si no cambió nada.
  const pendienteRef = useRef<RegistroMovimiento | null>(null);
  const [registrado, setRegistrado] = useState(false);
  const [avisoStock, setAvisoStock] = useState<string | null>(null);

  const envio = useMutation({
    mutationFn: (registro: RegistroMovimiento) => registrarMovimiento(registro, obtenerToken),
  });

  const esquema = useMemo(() => esquemaMovimiento(tipo), [tipo]);

  const formulario = useForm({
    defaultValues: VALORES_INICIALES,
    validators: { onChange: esquema, onSubmit: esquema },
    onSubmit: async ({ value, formApi }) => {
      const registro = registroParaEnviar(tipo, value, {
        obraId,
        idFormulario,
        pendiente: pendienteRef.current,
        ahora: () => new Date(),
        nuevoId: nuevoUuid,
      });
      pendienteRef.current = registro;
      setRegistrado(false);
      setAvisoStock(null);
      let movimiento;
      try {
        ({ movimiento } = await envio.mutateAsync(registro));
      } catch {
        return; // El error queda en `envio` y se muestra; el registro sigue pendiente.
      }
      // Registrado (201) o ya estaba registrado (200): el próximo es un registro nuevo.
      pendienteRef.current = null;
      setIdFormulario(nuevoUuid());
      formApi.reset();
      const material = materiales.data?.find((item) => item.id === registro.materialId);
      setAvisoStock(avisoSuperaStock(registro, movimiento, material));
      setRegistrado(true);
      // El stock de ese material se actualiza (criterio 4): con lo que devolvió Materiales y,
      // además, volviendo a pedir el stock de la obra.
      queryClient.setQueryData<FilaStock[]>(claveStock(obraId), (filas) =>
        filas ? actualizarFilaStock(filas, registro.materialId, movimiento.stock) : filas,
      );
      void queryClient.invalidateQueries({ queryKey: claveStock(obraId) });
    },
  });

  const cerrarAvisoRegistrado = useCallback(() => setRegistrado(false), []);

  return {
    formulario,
    materiales,
    /** UUID del registro que se está llenando (el que se enviará si no hay uno pendiente). */
    idFormulario,
    enviando: envio.isPending,
    /** Texto del último envío fallido (criterio 7 y demás errores), o `null`. */
    fallo: envio.isError && envio.variables ? mensajeFalloMovimiento(envio.error, envio.variables) : null,
    /** «Registrado» visible (criterio 4). */
    registrado,
    cerrarAvisoRegistrado,
    /** Aviso de salida mayor al stock (criterio 5), o `null`. */
    avisoStock,
  };
}
