import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Las pruebas de navegación usan las rutas reales de src/app.
describe('rutas', () => {
  it('abre en el inicio de sesión', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText('Iniciar sesión')).toBeTruthy();
    expect(screen).toHavePathname('/iniciar-sesion');
  });

  it('pasa a «Mis obras» con la barra superior y el estado vacío', async () => {
    await renderRouter('src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByText('Iniciar sesión'));
    expect(await screen.findByText('Aún no hay obras asignadas.')).toBeTruthy();
    expect(screen.getByText('Supervisión de obras')).toBeTruthy();
    expect(screen).toHavePathname('/obras');
  });
});
