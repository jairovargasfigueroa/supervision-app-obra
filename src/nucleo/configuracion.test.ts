import appJson from '../../app.json';
import { emisor, leerConfiguracion } from './configuracion';

const valida = {
  keycloakUrl: 'http://localhost:8080',
  realm: 'supervision',
  clientId: 'app-obra',
  obrasUrl: 'http://localhost:8081',
  materialesUrl: 'http://localhost:8082',
  sincronizacionUrl: 'http://localhost:8084',
};

describe('configuracion', () => {
  it('el extra de app.json es válido y apunta a localhost (adb reverse)', () => {
    expect(leerConfiguracion(appJson.expo.extra)).toEqual(valida);
  });

  it('falla si falta un campo', () => {
    expect(() => leerConfiguracion({ ...valida, clientId: undefined })).toThrow(/clientId/);
  });

  it('arma el emisor del realm', () => {
    expect(emisor(valida)).toBe('http://localhost:8080/realms/supervision');
    expect(emisor({ keycloakUrl: 'http://localhost:8080/', realm: 'supervision' })).toBe(
      'http://localhost:8080/realms/supervision',
    );
  });
});
