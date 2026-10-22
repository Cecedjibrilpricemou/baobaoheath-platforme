// La passerelle de paiement Chap Chap Pay (EF-08).
//
// **Deux choses se paient cher si elles sont fausses ici.**
//
// 1. *La signature.* Sans elle, n'importe qui annonce « ce patient a paye » et
//    la facture bascule. Une verification qui accepte tout est pire que pas de
//    verification : elle donne l'illusion du controle.
// 2. *Le sens des statuts.* Seul `success` vaut paiement, et il est definitif.
//    La documentation de ChapChap donne l'exemple d'un `canceled` suivi d'un
//    `success` ; l'inverse arrive aussi, un rappel tardif apres coup. Rien ne
//    doit redescendre un paiement acquis.
import { createHmac } from 'crypto';
import {
  chapchapEstConfigure,
  configurationChapChap,
  estEnCours,
  estPaye,
  verifierSignature,
} from '../src/services/chapchap.service';

jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

const CLE = 'cle-d-encryptage-de-test';
const CORPS = JSON.stringify({
  order_id: 'fac-1',
  operation_id: '2db401d7-cad3-449f-9e3e-ec2cf9e48472',
  amount: 25000,
  status: { code: 'success', description: 'Transaction terminee avec succes' },
});

const signer = (corps: string, cle = CLE) =>
  createHmac('sha256', cle).update(corps).digest('hex');

beforeEach(() => {
  process.env['CHAPCHAP_HMAC_KEY'] = CLE;
  process.env['CHAPCHAP_API_KEY'] = 'a'.repeat(64);
});

describe('configuration', () => {
  it('se lit a chaque appel, pour qu une cle changee soit prise en compte', () => {
    process.env['CHAPCHAP_API_KEY'] = 'b'.repeat(64);
    expect(configurationChapChap().cleApi).toBe('b'.repeat(64));
  });

  it('se sait non configuree sans cle', () => {
    process.env['CHAPCHAP_API_KEY'] = '';
    expect(chapchapEstConfigure()).toBe(false);
  });

  // Un patient a qui l'on annonce « 25 000 » et que la passerelle debite de
  // 25 800 conteste au guichet, avec raison.
  it('fait porter les frais au marchand par defaut', () => {
    delete process.env['CHAPCHAP_FEE_HANDLING'];
    expect(configurationChapChap().fraisPortesPar).toBe('deduct');
  });
});

describe('verifierSignature', () => {
  it('accepte une signature juste', () => {
    expect(verifierSignature(CORPS, signer(CORPS))).toBe(true);
  });

  it('accepte le corps sous forme de Buffer, comme Express le livre', () => {
    expect(verifierSignature(Buffer.from(CORPS, 'utf8'), signer(CORPS))).toBe(true);
  });

  it('ignore la casse de la signature recue', () => {
    expect(verifierSignature(CORPS, signer(CORPS).toUpperCase())).toBe(true);
  });

  // **Le piege que la documentation signale.** Re-serialiser le JSON produit
  // d'autres octets : un espace de plus, et la signature ne vaut plus rien.
  it('refuse un corps modifie, fut-ce d un seul espace', () => {
    expect(verifierSignature(CORPS + ' ', signer(CORPS))).toBe(false);
    expect(verifierSignature(CORPS.replace('{"order_id"', '{ "order_id"'), signer(CORPS))).toBe(false);
  });

  it('refuse une signature calculee avec une autre cle', () => {
    expect(verifierSignature(CORPS, signer(CORPS, 'une-autre-cle'))).toBe(false);
  });

  it.each([
    ['vide', ''],
    ['inventee', 'f'.repeat(64)],
    ['trop courte', signer(CORPS).slice(0, 32)],
    ['trop longue', signer(CORPS) + 'ab'],
    ['non hexadecimale', 'pas-du-tout-une-signature'],
  ])('refuse une signature %s sans lever', (_libelle, signature) => {
    expect(() => verifierSignature(CORPS, signature)).not.toThrow();
    expect(verifierSignature(CORPS, signature)).toBe(false);
  });

  // Sans cle, la seule reponse sure est « non ». Accepter reviendrait a
  // ouvrir la porte des que la configuration est incomplete.
  //
  // **Ce test a d'abord passe pour une mauvaise raison.** Il ne verifiait
  // qu'une signature faite avec la vraie cle — qui ne correspond evidemment
  // pas. Or un attaquant qui sait la cle absente signe **avec la cle vide**,
  // et c'est ce cas-la qui doit etre refuse. Retirer le garde ne cassait rien.
  it('refuse tout quand aucune cle n est configuree', () => {
    process.env['CHAPCHAP_HMAC_KEY'] = '';
    expect(verifierSignature(CORPS, signer(CORPS))).toBe(false);
    expect(verifierSignature(CORPS, signer(CORPS, ''))).toBe(false);
  });

  // Le corps vide est un cas limite reel : une requete sans contenu.
  it('verifie correctement un corps vide', () => {
    expect(verifierSignature('', signer(''))).toBe(true);
    expect(verifierSignature('', signer('x'))).toBe(false);
  });
});

describe('estPaye', () => {
  it('ne reconnait que « success »', () => {
    expect(estPaye('success')).toBe(true);
  });

  it.each(['new', 'pending', 'canceled', 'failed', 'error', 'expired'])(
    'refuse « %s »', (statut) => expect(estPaye(statut)).toBe(false));

  it('refuse un statut absent ou inconnu', () => {
    expect(estPaye(undefined)).toBe(false);
    expect(estPaye('completed')).toBe(false);
    expect(estPaye('SUCCESS')).toBe(false);
  });
});

describe('estEnCours', () => {
  it.each(['new', 'pending'])('« %s » est en cours', (s) => expect(estEnCours(s)).toBe(true));

  // Une issue connue n'est plus une attente, meme quand elle est mauvaise :
  // c'est ce qui permet a l'ecran de cesser de faire patienter le patient.
  it.each(['success', 'canceled', 'failed', 'error', 'expired'])(
    '« %s » ne l est plus', (s) => expect(estEnCours(s)).toBe(false));
});
