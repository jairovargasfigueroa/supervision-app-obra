// Identificadores generados en el celular (convenciones, «Idempotencia»): UUID v4 de expo-crypto.
import { randomUUID } from 'expo-crypto';

export function nuevoUuid(): string {
  return randomUUID();
}
