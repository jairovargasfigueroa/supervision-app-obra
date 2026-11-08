// Única salida de la app a la red (servicios, S3 y archivos locales `file://`). Las pruebas la
// simulan con `jest.mock` (jest.setup.ts): el `fetch` global no sirve para eso porque Expo lo
// reinstala al cargar sus módulos.
export function enviar(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}
