import { render, screen } from '@testing-library/react-native';

import App from './App';

describe('App', () => {
  it('muestra la barra con el nombre y el estado vacío', async () => {
    await render(<App />);
    expect(await screen.findByText('Supervisión de obras')).toBeTruthy();
    expect(screen.getByText('Aún no hay obras asignadas.')).toBeTruthy();
  });
});
