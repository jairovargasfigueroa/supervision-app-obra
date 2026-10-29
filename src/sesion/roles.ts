// Roles y menú de la app (001, criterios 3, 5 y 11). Lógica pura, probada en roles.test.ts.
//
// En la app solo cuentan los roles internos (convenciones, «Usuario con varios roles»: el token de
// la app tiene azp = app-obra) y, de ellos, solo `maestro` y `almacenero` entran a la app. Un
// `cliente` o un `residente` que además tenga uno de estos roles entra solo con el de la app.

export const ROLES_APP = ['maestro', 'almacenero'] as const;
export type RolApp = (typeof ROLES_APP)[number];

/** Roles del token que cuentan en la app, en orden fijo y sin repetir. */
export function rolesEfectivos(roles: readonly string[]): RolApp[] {
  return ROLES_APP.filter((rol) => roles.includes(rol));
}

/** Entra a la app quien tiene `maestro` o `almacenero` (criterio 3). */
export function tieneAccesoApp(roles: readonly string[]): boolean {
  return rolesEfectivos(roles).length > 0;
}

export type Pestana = {
  /** Nombre de la ruta en `src/app/(app)/`. */
  ruta: 'obras/index' | 'foto' | 'ingreso' | 'salida' | 'stock';
  titulo: string;
  /** Ícono de MaterialCommunityIcons. */
  icono: 'office-building-outline' | 'camera-outline' | 'tray-arrow-down' | 'tray-arrow-up' | 'package-variant-closed';
  roles: readonly RolApp[];
};

/** Todas las pestañas, en el orden en que se muestran (criterio 5). */
export const PESTANAS: readonly Pestana[] = [
  { ruta: 'obras/index', titulo: 'Mis obras', icono: 'office-building-outline', roles: ['maestro', 'almacenero'] },
  { ruta: 'foto', titulo: 'Foto de avance', icono: 'camera-outline', roles: ['maestro'] },
  { ruta: 'ingreso', titulo: 'Ingreso', icono: 'tray-arrow-down', roles: ['almacenero'] },
  { ruta: 'salida', titulo: 'Salida', icono: 'tray-arrow-up', roles: ['almacenero'] },
  { ruta: 'stock', titulo: 'Stock', icono: 'package-variant-closed', roles: ['almacenero'] },
];

/**
 * Pestañas del usuario: `maestro` → Mis obras, Foto de avance; `almacenero` → Mis obras, Ingreso,
 * Salida, Stock; con los dos, la unión sin repetir «Mis obras». Sin ninguno, ninguna.
 */
export function pestanasPorRol(roles: readonly string[]): Pestana[] {
  const efectivos = rolesEfectivos(roles);
  return PESTANAS.filter((pestana) => pestana.roles.some((rol) => efectivos.includes(rol)));
}

const NOMBRE_ROL: Record<RolApp, string> = {
  maestro: 'Maestro de obra',
  almacenero: 'Almacenero',
};

/** Rol que se muestra en la barra superior (criterio 11); con los dos, ambos. */
export function nombreRoles(roles: readonly string[]): string {
  return rolesEfectivos(roles)
    .map((rol) => NOMBRE_ROL[rol])
    .join(' · ');
}
