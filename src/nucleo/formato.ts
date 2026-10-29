// Formatos de docs/diseno-visual.md («Formatos»): como es-BO y en hora de La Paz.
//
// No usa Intl: Hermes en el celular toma los separadores y las zonas horarias del sistema
// (ICU de Android, Foundation en iOS), que cambian según el teléfono, y en las pruebas
// (Node) se vería otro resultado. Por eso los separadores se arman aquí y la hora de La Paz
// se calcula con su desfase fijo: America/La_Paz es UTC−4 todo el año, sin horario de
// verano (docs/convenciones.md).

const SEPARADOR_MILES = '.';
const SEPARADOR_DECIMAL = ',';
const DESFASE_LA_PAZ_MS = -4 * 60 * 60 * 1000;
const FECHA_SIN_HORA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Número con separadores de es-BO, redondeado «mitad hacia arriba» (en valor absoluto)
 * a `maxDecimales`, mostrando al menos `minDecimales`.
 */
function formatearNumero(valor: number, minDecimales: number, maxDecimales: number): string {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`Número no válido: ${valor}`);
  }
  const factor = 10 ** maxDecimales;
  // toPrecision(15) corrige errores de coma flotante (1.005 * 100 = 100.49999999999999).
  const escalado = Math.round(Number((Math.abs(valor) * factor).toPrecision(15)));
  const entero = Math.floor(escalado / factor);
  let decimales = String(escalado % factor).padStart(maxDecimales, '0');
  while (decimales.length > minDecimales && decimales.endsWith('0')) {
    decimales = decimales.slice(0, -1);
  }

  const enteroConMiles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR_MILES);
  const signo = valor < 0 && escalado > 0 ? '-' : '';
  return decimales.length > 0
    ? `${signo}${enteroConMiles}${SEPARADOR_DECIMAL}${decimales}`
    : `${signo}${enteroConMiles}`;
}

/** Instante como fecha y hora de La Paz (campos UTC de una fecha desplazada −4 h). */
function enLaPaz(instante: string | Date): Date {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante.getTime();
  if (Number.isNaN(ms)) {
    throw new RangeError(`Fecha no válida: ${String(instante)}`);
  }
  return new Date(ms + DESFASE_LA_PAZ_MS);
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

function fechaDe(laPaz: Date): string {
  return `${dosDigitos(laPaz.getUTCDate())}/${dosDigitos(laPaz.getUTCMonth() + 1)}/${laPaz.getUTCFullYear()}`;
}

/** `Bs 1.250.000,00` */
export function formatearMonto(monto: number): string {
  return `Bs ${formatearNumero(monto, 2, 2)}`;
}

/** `120,5 m²` (hasta 3 decimales). */
export function formatearCantidad(cantidad: number, unidad: string): string {
  return `${formatearNumero(cantidad, 0, 3)} ${unidad}`;
}

/** `32,5 %` (hasta 1 decimal). */
export function formatearPorcentaje(porcentaje: number): string {
  return `${formatearNumero(porcentaje, 0, 1)} %`;
}

/**
 * `15/11/2026`. Recibe una fecha sin hora (`2026-11-15`, se muestra tal cual) o un instante
 * (ISO 8601 o `Date`, se muestra el día en La Paz).
 */
export function formatearFecha(fecha: string | Date): string {
  if (typeof fecha === 'string') {
    const partes = FECHA_SIN_HORA.exec(fecha);
    if (partes) {
      const [, anio, mes, dia] = partes;
      return `${dia}/${mes}/${anio}`;
    }
  }
  return fechaDe(enLaPaz(fecha));
}

/** `15/11/2026 14:30` en hora de La Paz. */
export function formatearFechaHora(instante: string | Date): string {
  const laPaz = enLaPaz(instante);
  return `${fechaDe(laPaz)} ${dosDigitos(laPaz.getUTCHours())}:${dosDigitos(laPaz.getUTCMinutes())}`;
}
