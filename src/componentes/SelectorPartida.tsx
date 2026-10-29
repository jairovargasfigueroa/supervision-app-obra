import { RadioButton } from 'react-native-paper';

import type { Partida } from '../api/obras';

type Props = {
  partidas: readonly Partida[];
  valor: string | null;
  onCambiar: (partidaId: string) => void;
  deshabilitado?: boolean;
};

/** Lista de partidas de la obra para elegir una («P-01 · Losa de hormigón armado»). */
export function SelectorPartida({ partidas, valor, onCambiar, deshabilitado }: Props) {
  return (
    <RadioButton.Group value={valor ?? ''} onValueChange={onCambiar}>
      {partidas.map((partida) => (
        <RadioButton.Item
          key={partida.id}
          value={partida.id}
          label={`${partida.codigo} · ${partida.nombre}`}
          disabled={deshabilitado}
          mode="android"
          position="leading"
          labelStyle={{ textAlign: 'left' }}
        />
      ))}
    </RadioButton.Group>
  );
}
