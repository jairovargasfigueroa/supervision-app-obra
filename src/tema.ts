// Tema de la app según docs/diseno-visual.md: MD3LightTheme de Paper con los colores de la
// plataforma y la fuente Inter (400, 500 y 600). Solo tema claro.
import type { FontFamilyDefinition } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

type Variante = Exclude<keyof MD3Theme['fonts'], 'default'>;
type MD3Type = MD3Theme['fonts'][Variante];

/** Tokens de color de docs/diseno-visual.md. */
export const colores = {
  primario: '#0E4D5C',
  primarioOscuro: '#0A3741',
  primarioSuave: '#E2EEF1',
  acento: '#F08A24',
  acentoSuave: '#FDEEDC',
  texto: '#14232A',
  textoSecundario: '#56676F',
  borde: '#DAE2E5',
  fondo: '#F2F5F6',
  superficie: '#FFFFFF',
  exito: '#1B7343',
  exitoSuave: '#E2F3E9',
  atencion: '#9A4A00',
  atencionSuave: '#FDEEDC',
  error: '#B42318',
  errorSuave: '#FCE8E6',
} as const;

/**
 * Radios de docs/diseno-visual.md («Forma y espacios»). Paper deriva todos los radios de `roundness`
 * (botón ×5, tarjeta ×3, diálogo ×7, campo ×1), así que no hay un valor único que los cumpla:
 * `roundness` deja los botones en 6 y tarjetas, diálogos y campos usan estos valores en su `style`
 * (`Card style={{ borderRadius: radios.tarjeta }}`, `TextInput outlineStyle={{ borderRadius: radios.control }}`).
 */
export const radios = {
  tarjeta: 10,
  control: 6,
  chip: 999,
} as const;

/** Objetivo táctil mínimo (docs/diseno-visual.md, «Pantallas chicas»). */
export const TAMANO_TACTIL_MINIMO = 44;

export const FAMILIA_INTER = 'Inter';

/** Las tres caras de Inter bajo una sola familia; se elige con `fontWeight`. */
export const fuentesInter: FontFamilyDefinition[] = [
  {
    fontFamily: FAMILIA_INTER,
    fontDefinitions: [
      { path: Inter_400Regular, weight: 400 },
      { path: Inter_500Medium, weight: 500 },
      { path: Inter_600SemiBold, weight: 600 },
    ],
  },
];

// Títulos de página y de sección en 600 (docs/diseno-visual.md, «Tipografía»).
const VARIANTES_600: readonly string[] = [
  'headlineLarge',
  'headlineMedium',
  'headlineSmall',
  'titleLarge',
];

function fuentesCon(familia: string): MD3Theme['fonts'] {
  const base = MD3LightTheme.fonts;
  const variantes = Object.fromEntries(
    (Object.keys(base) as (keyof MD3Theme['fonts'])[])
      .filter((clave): clave is Variante => clave !== 'default')
      .map((clave) => {
        const variante: MD3Type = {
          ...base[clave],
          fontFamily: familia,
          fontWeight: VARIANTES_600.includes(clave) ? '600' : base[clave].fontWeight,
        };
        return [clave, variante];
      }),
  ) as Record<Variante, MD3Type>;
  return { ...variantes, default: { ...base.default, fontFamily: familia } };
}

const coloresPaper = {
  ...MD3LightTheme.colors,
  primary: colores.primario,
  onPrimary: colores.superficie,
  primaryContainer: colores.primarioSuave,
  onPrimaryContainer: colores.primarioOscuro,
  secondary: colores.acento,
  onSecondary: colores.texto,
  secondaryContainer: colores.acentoSuave,
  onSecondaryContainer: colores.atencion,
  tertiary: colores.primarioOscuro,
  onTertiary: colores.superficie,
  tertiaryContainer: colores.primarioSuave,
  onTertiaryContainer: colores.primarioOscuro,
  error: colores.error,
  onError: colores.superficie,
  errorContainer: colores.errorSuave,
  onErrorContainer: colores.error,
  background: colores.fondo,
  onBackground: colores.texto,
  surface: colores.superficie,
  onSurface: colores.texto,
  surfaceVariant: colores.fondo,
  onSurfaceVariant: colores.textoSecundario,
  outline: colores.borde,
  outlineVariant: colores.borde,
  inverseSurface: colores.texto,
  inverseOnSurface: colores.superficie,
  inversePrimary: colores.primarioSuave,
  // Sin el tinte violeta de MD3: superficies elevadas en blanco y grises del fondo.
  elevation: {
    level0: 'transparent',
    level1: colores.superficie,
    level2: colores.superficie,
    level3: colores.fondo,
    level4: colores.fondo,
    level5: colores.fondo,
  },
  // Tokens propios de la plataforma (sin equivalente en MD3).
  primarioOscuro: colores.primarioOscuro,
  primarioSuave: colores.primarioSuave,
  textoSecundario: colores.textoSecundario,
  borde: colores.borde,
  exito: colores.exito,
  exitoSuave: colores.exitoSuave,
  atencion: colores.atencion,
  atencionSuave: colores.atencionSuave,
  errorSuave: colores.errorSuave,
};

/** Tema con Inter (cuando la fuente cargó). */
export const tema = {
  ...MD3LightTheme,
  dark: false,
  // Botones de Paper: 5 × 1.2 = 6 px (radios.control)
  roundness: radios.control / 5,
  colors: coloresPaper,
  fonts: fuentesCon(FAMILIA_INTER),
};

export type Tema = typeof tema;

/** Mismo tema con la fuente del sistema, si Inter no carga. */
export const temaSistema: Tema = { ...tema, fonts: MD3LightTheme.fonts };

/** `useTheme` de Paper con los tokens propios tipados. */
export const useTema = () => useTheme<Tema>();
