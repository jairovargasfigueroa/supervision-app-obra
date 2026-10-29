import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { TAMANO_TACTIL_MINIMO, tema } from '../tema';
import { EstadoError } from './EstadoError';
import { EstadoVacio } from './EstadoVacio';

const conTema = (hijo: ReactNode) => <PaperProvider theme={tema}>{hijo}</PaperProvider>;

describe('EstadoVacio', () => {
  it('muestra el mensaje y ejecuta la acción', async () => {
    const onPress = jest.fn();
    await render(
      conTema(
        <EstadoVacio mensaje="Aún no hay obras." accion={{ texto: 'Registrar obra', onPress }} />,
      ),
    );
    expect(screen.getByText('Aún no hay obras.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Registrar obra'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no muestra botón si no hay acción', async () => {
    await render(conTema(<EstadoVacio mensaje="Aún no hay obras." />));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('EstadoError', () => {
  it('muestra «No disponible por el momento.» y reintenta', async () => {
    const onReintentar = jest.fn();
    await render(conTema(<EstadoError onReintentar={onReintentar} />));
    expect(screen.getByText('No disponible por el momento.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it('el botón Reintentar mide al menos 44 de alto', async () => {
    await render(conTema(<EstadoError onReintentar={() => {}} />));
    const boton = screen.getByRole('button', { name: /Reintentar/ });
    const contenido = boton.queryAll(
      (nodo) => (StyleSheet.flatten(nodo.props.style)?.minHeight ?? 0) >= TAMANO_TACTIL_MINIMO,
    );
    expect(contenido.length).toBeGreaterThan(0);
  });
});
