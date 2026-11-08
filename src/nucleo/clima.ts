// Clima del diario de obra (103, criterio 1; valores: decisión del equipo).
export const CLIMAS = ['SOLEADO', 'NUBLADO', 'LLUVIA_LEVE', 'LLUVIA_FUERTE'] as const;

export type Clima = (typeof CLIMAS)[number];

export const ETIQUETA_CLIMA: Record<Clima, string> = {
  SOLEADO: 'Soleado',
  NUBLADO: 'Nublado',
  LLUVIA_LEVE: 'Lluvia leve',
  LLUVIA_FUERTE: 'Lluvia fuerte',
};

/** Ícono de MaterialCommunityIcons de cada clima. */
export const ICONO_CLIMA: Record<Clima, string> = {
  SOLEADO: 'weather-sunny',
  NUBLADO: 'weather-cloudy',
  LLUVIA_LEVE: 'weather-rainy',
  LLUVIA_FUERTE: 'weather-pouring',
};
