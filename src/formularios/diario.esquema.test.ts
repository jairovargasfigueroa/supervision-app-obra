import { aEntradaDiario, esquemaDiario, MENSAJES_DIARIO } from './diario.esquema';

const valido = { fecha: '2026-11-15', clima: 'LLUVIA_LEVE', texto: 'Se vació la losa.' };
const errores = (valores: unknown) => {
  const r = esquemaDiario.safeParse(valores);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('entrada del diario (103, criterio 1)', () => {
  it('texto de 10 a 2000 caracteres sin contar los espacios de los costados', () => {
    expect(errores({ ...valido, texto: '123456789' })).toEqual([MENSAJES_DIARIO.textoCorto]);
    expect(errores({ ...valido, texto: '   123456789   ' })).toEqual([MENSAJES_DIARIO.textoCorto]);
    expect(errores({ ...valido, texto: '1234567890' })).toEqual([]);
    expect(errores({ ...valido, texto: 'x'.repeat(2000) })).toEqual([]);
    expect(errores({ ...valido, texto: 'x'.repeat(2001) })).toEqual([MENSAJES_DIARIO.textoLargo]);
  });

  it('el clima es uno de los cuatro', () => {
    expect(errores({ ...valido, clima: '' })).toEqual([MENSAJES_DIARIO.clima]);
    expect(errores({ ...valido, clima: 'GRANIZO' })).toEqual([MENSAJES_DIARIO.clima]);
  });

  it('los datos de la operación llevan el texto sin espacios a los costados', () => {
    expect(aEntradaDiario({ ...valido, texto: '  Se vació la losa.  ' }, { id: 'd1', obraId: 'o1' })).toEqual({
      id: 'd1',
      obraId: 'o1',
      fecha: '2026-11-15',
      clima: 'LLUVIA_LEVE',
      texto: 'Se vació la losa.',
    });
  });
});
