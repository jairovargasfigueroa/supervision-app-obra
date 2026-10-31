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
  /** Nombre de la ruta en `src/app/(app)/(pestanas)/`. */
  ruta: 'obras/index' | 'foto' | 'ingreso' | 'salida' | 'stock' | 'pendientes';
  titulo: string;
  /** Ícono de MaterialCommunityIcons. */
  icono:
    | 'office-building-outline'
    | 'camera-outline'
    | 'tray-arrow-down'
    | 'tray-arrow-up'
    | 'package-variant-closed'
    | 'cloud-upload-outline';
  roles: readonly RolApp[];
};

/** Todas las pestañas, en el orden en que se muestran (criterio 5). */
export const PESTANAS: readonly Pestana[] = [
  { ruta: 'obras/index', titulo: 'Mis obras', icono: 'office-building-outline', roles: ['maestro', 'almacenero'] },
  { ruta: 'foto', titulo: 'Foto de avance', icono: 'camera-outline', roles: ['maestro'] },
  { ruta: 'ingreso', titulo: 'Ingreso', icono: 'tray-arrow-down', roles: ['almacenero'] },
  { ruta: 'salida', titulo: 'Salida', icono: 'tray-arrow-up', roles: ['almacenero'] },
  { ruta: 'stock', titulo: 'Stock', icono: 'package-variant-closed', roles: ['almacenero'] },
  // 101: registros guardados en el celular por enviar, con contador.
  { ruta: 'pendientes', titulo: 'Pendientes', icono: 'cloud-upload-outline', roles: ['maestro', 'almacenero'] },
];

/**
 * Pestañas del usuario: `maestro` → Mis obras, Foto de avance; `almacenero` → Mis obras, Ingreso,
 * Salida, Stock; con los dos, la unión sin repetir «Mis obras». Los dos tienen además «Pendientes»
 * (101). Sin ninguno, ninguna.
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

/**
 * Pantallas de una obra (`src/app/(app)/obras/[id]/…`): se apilan sobre las pestañas (se llega
 * desde «Mis obras» o desde la pestaña de su rol) y solo existen para su rol. `accion` es el botón
 * de cada obra en «Mis obras».
 */
export const PANTALLAS_OBRA = [
  {
    ruta: 'obras/[id]/foto',
    titulo: 'Foto de avance',
    accion: 'Foto de avance',
    icono: 'camera-outline',
    roles: ['maestro'],
  },
  {
    ruta: 'obras/[id]/ingreso',
    titulo: 'Ingreso de material',
    accion: 'Ingreso',
    icono: 'tray-arrow-down',
    roles: ['almacenero'],
  },
  {
    ruta: 'obras/[id]/salida',
    titulo: 'Salida de material',
    accion: 'Salida',
    icono: 'tray-arrow-up',
    roles: ['almacenero'],
  },
  {
    ruta: 'obras/[id]/stock',
    titulo: 'Stock de la obra',
    accion: 'Stock',
    icono: 'package-variant-closed',
    roles: ['almacenero'],
  },
] as const satisfies readonly {
  ruta: string;
  titulo: string;
  accion: string;
  icono: string;
  roles: readonly RolApp[];
}[];

export type PantallaObra = (typeof PANTALLAS_OBRA)[number];

/** Pantallas de obra del usuario, en el orden de las pestañas (botones de «Mis obras»). */
export function pantallasObraPorRol(roles: readonly string[]): PantallaObra[] {
  return PANTALLAS_OBRA.filter((pantalla) => tieneAlgunRol(roles, pantalla.roles));
}

/** Dirección de una pantalla de obra: `obras/[id]/ingreso` → `/obras/o1/ingreso`. */
export function rutaDeObra(pantalla: PantallaObra['ruta'], obraId: string): string {
  return `/${pantalla.replace('[id]', encodeURIComponent(obraId))}`;
}

/** El usuario tiene alguno de los roles. */
export function tieneAlgunRol(roles: readonly string[], permitidos: readonly RolApp[]): boolean {
  return rolesEfectivos(roles).some((rol) => permitidos.includes(rol));
}
