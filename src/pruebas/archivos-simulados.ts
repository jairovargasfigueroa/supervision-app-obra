// expo-file-system simulado en memoria (jest.setup.ts lo instala para todas las pruebas): cada archivo
// es una ruta con un contenido de texto. Se vacía antes de cada prueba.
const archivos = new Map<string, string>();
const carpetas = new Set<string>();

type Parte = string | { uri: string };

function unir(partes: Parte[]): string {
  return partes
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .reduce((ruta, parte) => (ruta ? `${ruta.replace(/\/+$/, '')}/${parte.replace(/^\/+/, '')}` : parte), '');
}

export class Directory {
  readonly uri: string;
  constructor(...partes: Parte[]) {
    this.uri = unir(partes);
  }
  get exists(): boolean {
    return carpetas.has(this.uri);
  }
  create(): void {
    carpetas.add(this.uri);
  }
}

export class File {
  uri: string;
  constructor(...partes: Parte[]) {
    this.uri = unir(partes);
  }
  get exists(): boolean {
    return archivos.has(this.uri);
  }
  get size(): number {
    return archivos.get(this.uri)?.length ?? 0;
  }
  get type(): string {
    return 'image/jpeg';
  }
  delete(): void {
    if (!archivos.delete(this.uri)) {
      throw new Error(`No existe ${this.uri}`);
    }
  }
  moveSync(destino: File | Directory): void {
    const ruta = destino instanceof Directory ? unir([destino, this.uri.split('/').pop() ?? '']) : destino.uri;
    // La imagen que guarda el manipulador simulado no está en el mapa: se da por existente.
    archivos.set(ruta, archivos.get(this.uri) ?? `imagen:${this.uri}`);
    archivos.delete(this.uri);
    this.uri = ruta;
  }
}

export const Paths = { document: new Directory('file:///documento') };

/** Escribe un archivo (para preparar una prueba). */
export function escribirArchivo(uri: string, contenido = 'jpeg'): void {
  archivos.set(uri, contenido);
}

/** Rutas de los archivos que hay ahora. */
export function archivosSimulados(): string[] {
  return [...archivos.keys()].sort();
}

export function reiniciarArchivos(): void {
  archivos.clear();
  carpetas.clear();
}
