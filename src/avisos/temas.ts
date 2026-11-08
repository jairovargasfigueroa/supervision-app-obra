// Temas de Firebase Cloud Messaging de los avisos (010): el celular se suscribe a un tema por obra y
// rol, y n8n manda el aviso al tema. Funciones puras.
import { rolesEfectivos } from '../sesion/roles';

// Lo que FCM acepta en el nombre de un tema.
const NOMBRE_VALIDO = /^[a-zA-Z0-9\-_.~%]+$/;

/** `obra-{obraId}-maestro` u `obra-{obraId}-almacenero`. */
export function temaDeObra(obraId: string, rol: 'maestro' | 'almacenero'): string {
  return `obra-${obraId}-${rol}`;
}

/**
 * Temas de las obras asignadas (las del paquete de datos de la 101) según los roles del usuario: con
 * `almacenero`, `obra-{id}-almacenero`; con `maestro`, `obra-{id}-maestro`; con los dos, ambos. Los
 * otros roles no cuentan. Sin repetir, ordenados; se omite un id que no sirva como nombre de tema.
 */
export function temasDe(obrasAsignadas: readonly { id: string }[], roles: readonly string[]): string[] {
  const rolesApp = rolesEfectivos(roles);
  const temas = new Set<string>();
  for (const obra of obrasAsignadas) {
    for (const rol of rolesApp) {
      const tema = temaDeObra(obra.id, rol);
      if (NOMBRE_VALIDO.test(tema)) {
        temas.add(tema);
      }
    }
  }
  return [...temas].sort();
}

export type CambiosDeTemas = { suscribir: string[]; quitar: string[] };

/** Qué suscribir (están en `nuevos` y no en `actuales`) y qué quitar (al revés). */
export function cambiosDeTemas(actuales: readonly string[], nuevos: readonly string[]): CambiosDeTemas {
  const antes = new Set(actuales);
  const despues = new Set(nuevos);
  return {
    suscribir: [...despues].filter((tema) => !antes.has(tema)),
    quitar: [...antes].filter((tema) => !despues.has(tema)),
  };
}
