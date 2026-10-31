// Un serveur injoignable n'est pas un mauvais mot de passe.
//
// En production, nginx relaie /api : une API arretee ne donne pas un statut 0
// mais un 502 (ou 503/504) avec une page HTML. Sans ce cas, la connexion
// affichait « identifiants incorrects » a quelqu'un dont le mot de passe etait
// juste.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { messageErreurConnexion } from './login.component';

const fr = JSON.parse(readFileSync(join(process.cwd(), 'src', 'app', 'shared', 'i18n', 'fr.json'), 'utf8'));
const t = (cle: string) => cle.split('.').reduce<any>((o, k) => o?.[k], fr) ?? cle;
const INJOIGNABLE = fr.AUTH.LOGIN.ERR_SERVEUR_INJOIGNABLE;

describe('message d\'erreur de connexion', () => {
  it('status 0 : serveur injoignable', () => {
    expect(messageErreurConnexion(t, { status: 0 }, 'AUTH.LOGIN.ERR_CREDENTIALS')).toBe(INJOIGNABLE);
  });

  for (const status of [502, 503, 504]) {
    it(`${status} renvoyé par le relais : serveur injoignable, pas « identifiants incorrects »`, () => {
      const err = { status, error: '<html><body>Bad Gateway</body></html>' };
      expect(messageErreurConnexion(t, err, 'AUTH.LOGIN.ERR_CREDENTIALS')).toBe(INJOIGNABLE);
    });
  }

  it('401 : garde le message du serveur', () => {
    const err = { status: 401, error: { error: 'Identifiants invalides' } };
    expect(messageErreurConnexion(t, err, 'AUTH.LOGIN.ERR_CREDENTIALS')).toBe('Identifiants invalides');
  });

  it('429 : trop de tentatives', () => {
    expect(messageErreurConnexion(t, { status: 429, error: 'Too many' }, 'AUTH.LOGIN.ERR_CREDENTIALS'))
      .toBe(fr.AUTH.LOGIN.ERR_TROP_DE_TENTATIVES);
  });
});
