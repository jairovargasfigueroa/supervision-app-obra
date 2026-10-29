import { MD3LightTheme } from 'react-native-paper';

import { radios, tema, temaSistema } from './tema';

describe('tema', () => {
  it('usa los colores de docs/diseno-visual.md', () => {
    expect(tema.colors.primary).toBe('#0E4D5C');
    expect(tema.colors.secondary).toBe('#F08A24');
    expect(tema.colors.error).toBe('#B42318');
    expect(tema.colors.background).toBe('#F2F5F6');
    expect(tema.colors.surface).toBe('#FFFFFF');
    expect(tema.colors.onSurface).toBe('#14232A');
    expect(tema.colors.exito).toBe('#1B7343');
    expect(tema.colors.atencion).toBe('#9A4A00');
    expect(tema.roundness).toBe(2);
    expect(tema.dark).toBe(false);
  });

  it('usa Inter con títulos en 600 y texto en 400', () => {
    expect(tema.fonts.bodyMedium).toMatchObject({ fontFamily: 'Inter', fontWeight: '400' });
    expect(tema.fonts.labelLarge).toMatchObject({ fontFamily: 'Inter', fontWeight: '500' });
    expect(tema.fonts.titleLarge).toMatchObject({ fontFamily: 'Inter', fontWeight: '600' });
    expect(tema.fonts.default.fontFamily).toBe('Inter');
  });

  it('cae a la fuente del sistema con los mismos colores', () => {
    expect(temaSistema.fonts).toBe(MD3LightTheme.fonts);
    expect(temaSistema.colors).toBe(tema.colors);
  });
  it('deja los botones de Paper en 6 px y expone 10 px para tarjetas y diálogos', () => {
    // Paper: radio del botón = 5 × roundness
    expect(5 * tema.roundness).toBe(6);
    expect(radios.tarjeta).toBe(10);
    expect(radios.control).toBe(6);
  });
});
