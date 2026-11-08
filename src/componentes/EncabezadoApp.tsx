import { useState } from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { nombreRoles } from '../sesion/roles';
import { useSesion } from '../sesion/sesion';
import { contarPendientes } from '../sync/cola';
import { mensajePendientesAlCerrar } from '../sync/mensajes';
import { borrarPaquete } from '../sync/paquete';
import { radios } from '../tema';
import { BarraSuperior } from './BarraSuperior';

type Props = { onVolver?: () => void };

/**
 * Barra superior de las pantallas con sesión. «Cerrar sesión» (101, criterio 18): si el usuario tiene
 * registros sin enviar, primero avisa que se conservan; al cerrar se borran los datos descargados del
 * usuario (la cola queda en el celular con su usuario).
 */
export function EncabezadoApp({ onVolver }: Props) {
  const { sesion, cerrarSesion } = useSesion();
  const usuario = sesion.estado === 'activa' ? sesion.usuario : null;
  const [pendientes, setPendientes] = useState<number | null>(null);

  const cerrar = async () => {
    setPendientes(null);
    if (usuario) {
      await borrarPaquete(usuario.id).catch(() => undefined);
    }
    await cerrarSesion();
  };

  const pedirCierre = async () => {
    const n = usuario ? await contarPendientes(usuario.id).catch(() => 0) : 0;
    if (n > 0) {
      setPendientes(n);
    } else {
      await cerrar();
    }
  };

  return (
    <>
      <BarraSuperior
        nombre={usuario?.nombre ?? ''}
        rol={nombreRoles(usuario?.roles ?? [])}
        onCerrarSesion={() => void pedirCierre()}
        onVolver={onVolver}
      />
      <Portal>
        <Dialog
          visible={pendientes !== null}
          onDismiss={() => setPendientes(null)}
          style={{ borderRadius: radios.tarjeta }}
        >
          <Dialog.Title>¿Cerrar sesión?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{mensajePendientesAlCerrar(pendientes ?? 0)}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendientes(null)}>Cancelar</Button>
            <Button onPress={() => void cerrar()}>Cerrar sesión</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
