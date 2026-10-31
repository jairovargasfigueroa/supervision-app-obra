// Estado del formulario de ingreso o salida de material (004 con la cola de la 101): campos con
// TanStack Form + Zod sobre los datos del paquete guardado en el celular, el `id` del registro (UUID
// de expo-crypto creado al abrir el formulario) y el registro: primero en la cola del celular y después
// a Sincronización, con «Registrado», «Guardado en el celular» o el motivo del rechazo.
import { useForm } from '@tanstack/react-form';
import { useCallback, useMemo, useState } from 'react';

import { MENSAJES } from '../api/errores';
import { leerMovimientoRegistrado, type TipoMovimiento } from '../api/materiales';
import type { ObraPaquete, PaqueteDatos } from '../api/sincronizacion';
import { nuevoUuid } from '../nucleo/uuid';
import { descripcionMovimiento, MENSAJE_GUARDADO_EN_CELULAR, mensajeRechazo } from '../sync/mensajes';
import { useOperaciones, useSincronizacion } from '../sync/sincronizacion';
import { stockConPendientes } from '../sync/stock-local';
import { avisoSuperaStock, avisoSuperaStockLocal, MENSAJE_REGISTRADO } from './movimiento';
import { aRegistro, esquemaMovimiento, VALORES_INICIALES } from './movimiento.esquema';

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

export function useMovimiento(tipo: TipoMovimiento, obra: ObraPaquete, datos: PaqueteDatos) {
  const { registrar } = useSincronizacion();
  const operaciones = useOperaciones();
  // El UUID del registro se crea al abrir el formulario (diseño 004) y se renueva al registrar.
  const [idFormulario, setIdFormulario] = useState(nuevoUuid);
  const [enviando, setEnviando] = useState(false);
  /** «Registrado» o «Guardado en el celular · se enviará cuando haya señal». */
  const [resultado, setResultado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [avisoStock, setAvisoStock] = useState<string | null>(null);

  const materiales = useMemo(
    () => [...datos.materiales].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [datos.materiales],
  );
  // Stock del paquete más los movimientos sin enviar (criterio 9).
  const stock = useMemo(() => stockConPendientes(obra, operaciones.data ?? []), [obra, operaciones.data]);

  const esquema = useMemo(() => esquemaMovimiento(tipo), [tipo]);

  const formulario = useForm({
    defaultValues: VALORES_INICIALES,
    validators: { onChange: esquema, onSubmit: esquema },
    onSubmit: async ({ value, formApi }) => {
      const registro = aRegistro(tipo, value, {
        id: idFormulario,
        obraId: obra.id,
        registradoEn: new Date().toISOString(),
      });
      const material = materiales.find((m) => m.id === registro.materialId);
      const partida = obra.partidas.find((p) => p.id === registro.partidaId);
      const stockMostrado = stock.filas.find((f) => f.materialId === registro.materialId)?.cantidad ?? 0;
      setEnviando(true);
      setResultado(null);
      setFallo(null);
      setAvisoStock(null);
      try {
        const op = await registrar({
          idOperacion: registro.id,
          tipo: 'MOVIMIENTO_MATERIAL',
          obraId: obra.id,
          datos: registro,
          descripcion: material
            ? descripcionMovimiento(tipo, registro.cantidad, material, partida)
            : `${tipo === 'INGRESO' ? 'Ingreso' : 'Salida'} · ${registro.cantidad}`,
        });
        // El registro ya está en la cola: el próximo es otro, con otro id.
        setIdFormulario(nuevoUuid());
        if (op.estado === 'RECHAZADO') {
          // Rechazo definitivo (criterio 14): se muestra el motivo y los datos quedan para corregirlos.
          setFallo(mensajeRechazo(op));
          return;
        }
        formApi.reset();
        if (op.estado === 'ENVIADO') {
          const movimiento = leerMovimientoRegistrado(op.respuesta);
          setAvisoStock(movimiento ? avisoSuperaStock(registro, movimiento, material) : null);
          setResultado(MENSAJE_REGISTRADO);
        } else {
          setAvisoStock(avisoSuperaStockLocal(registro, stockMostrado, material));
          setResultado(MENSAJE_GUARDADO_EN_CELULAR);
        }
      } catch {
        // No se pudo guardar en el celular (la base local falló): no quedó registrado.
        setFallo(MENSAJES.ERROR_INTERNO);
      } finally {
        setEnviando(false);
      }
    },
  });

  const cerrarResultado = useCallback(() => setResultado(null), []);

  return {
    formulario,
    /** Materiales activos del paquete, por código. */
    materiales,
    /** Stock de la obra con los movimientos sin enviar. */
    stock: stock.filas,
    /** UUID del registro que se está llenando. */
    idFormulario,
    enviando,
    /** Motivo del último rechazo (criterio 14) o del fallo al guardar, o `null`. */
    fallo,
    /** «Registrado» o «Guardado en el celular · se enviará cuando haya señal» (criterio 8), o `null`. */
    resultado,
    cerrarResultado,
    /** Aviso de salida mayor al stock (criterios 5 y 10), o `null`. */
    avisoStock,
  };
}
