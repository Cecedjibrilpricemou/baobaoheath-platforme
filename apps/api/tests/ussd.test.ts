// La passerelle USSD : elle repond a un numero de telephone, sans cookie ni
// navigateur. Avant ce fichier, **un numero suffisait** pour lire le nom, le
// code QR, les vaccins, les factures et le motif des rendez-vous d'un patient.
//
// Deux portes ferment desormais l'acces, et ce fichier verifie chacune :
//
// 1. *La passerelle* : seul l'operateur, qui connait le secret partage, peut
//    appeler la route (signature HMAC horodatee, liste d'adresses facultative).
// 2. *Le patient* : un code PIN qu'il a choisi, bloque apres cinq echecs.
//
// Et deux donnees ne sortent plus jamais par USSD : le code QR, qui ouvre le
// dossier a l'accueil, et le motif des rendez-vous, qui est une donnee medicale.
import { createHmac } from 'crypto';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findFirst: jest.fn(), findUnique: jest.fn() },
    patientProfile: { update: jest.fn() },
    ussdSession: { upsert: jest.fn(), update: jest.fn(), count: jest.fn() },
    rendezVous: { findMany: jest.fn() },
    vaccination: { findMany: jest.fn() },
    facture: { findMany: jest.fn() },
  },
}));

jest.mock('../src/services/parametres.service', () => ({
  getValeursParametres: jest.fn().mockResolvedValue({ sync: { ussdTimeoutSecondes: 120 } }),
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nomCourt: 'KENEYA' }),
}));

import { hashPassword } from '../src/utils/password.utils';
import {
  definirPinUssd,
  handleUssdRequest,
  verifierPasserelleUssd,
} from '../src/services/ussd.service';
import { UnauthorizedError, ValidationError } from '../src/utils/app-error';

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findFirst: jest.Mock; findUnique: jest.Mock };
    patientProfile: { update: jest.Mock };
    ussdSession: { upsert: jest.Mock; update: jest.Mock; count: jest.Mock };
    rendezVous: { findMany: jest.Mock };
    vaccination: { findMany: jest.Mock };
    facture: { findMany: jest.Mock };
  };
};

const TEL = '620100010';
const PIN = '4821';
const QR = 'QR-SECRET-0001';
let PIN_HASH = '';
let MDP_HASH = '';

function patient(over: Partial<{ pinUssdHash: string | null; pinUssdEchecs: number; pinUssdBloqueJusqua: Date | null }> = {}) {
  return {
    id: 'u-1',
    prenom: 'Maomou',
    nom: 'Conde',
    telephone: TEL,
    motDePasseHash: MDP_HASH,
    patientProfile: {
      id: 'p-1',
      qrCode: QR,
      prefecture: 'Conakry',
      pinUssdHash: PIN_HASH,
      pinUssdEchecs: 0,
      pinUssdBloqueJusqua: null,
      ...over,
    },
  };
}

function requete(text: string, sessionId = 'sess-1') {
  return { sessionId, phoneNumber: TEL, text };
}

beforeAll(async () => {
  PIN_HASH = await hashPassword(PIN);
  MDP_HASH = await hashPassword('MotDePasse-Patient-1');
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.ussdSession.count.mockResolvedValue(0);
  prisma.ussdSession.upsert.mockResolvedValue({});
  prisma.ussdSession.update.mockResolvedValue({});
  prisma.patientProfile.update.mockResolvedValue({});
  prisma.rendezVous.findMany.mockResolvedValue([]);
  prisma.vaccination.findMany.mockResolvedValue([]);
  prisma.facture.findMany.mockResolvedValue([]);
});

// ─── 1. La passerelle ─────────────────────────────────────────────────────

describe('verifierPasserelleUssd', () => {
  const CLE = 'cle-hmac-de-test-operateur';
  const corps = { sessionId: 'sess-1', phoneNumber: TEL, text: '1' };
  const maintenant = Date.UTC(2026, 9, 30, 12, 0, 0);
  const horodatage = String(Math.floor(maintenant / 1000));
  const signer = (h: string, c = corps, cle = CLE) =>
    createHmac('sha256', cle).update(`${h}.${c.sessionId}.${c.phoneNumber}.${c.text}`).digest('hex');

  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('refuse tout appel tant que le secret n est pas configure', () => {
    delete process.env['USSD_HMAC_KEY'];
    const r = verifierPasserelleUssd({ horodatage, signature: signer(horodatage), ip: '10.0.0.1', corps, maintenant });
    expect(r).toBe('non-configuree');
  });

  it('accepte une signature valide et recente', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    const r = verifierPasserelleUssd({ horodatage, signature: signer(horodatage), ip: '10.0.0.1', corps, maintenant });
    expect(r).toBe('ok');
  });

  it('refuse une requete sans signature', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    expect(verifierPasserelleUssd({ horodatage, signature: '', ip: '10.0.0.1', corps, maintenant })).toBe('refusee');
  });

  it('refuse une signature faite avec une autre cle', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    const fausse = signer(horodatage, corps, 'une-autre-cle');
    expect(verifierPasserelleUssd({ horodatage, signature: fausse, ip: '10.0.0.1', corps, maintenant })).toBe('refusee');
  });

  it('refuse un corps modifie apres signature (autre numero)', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    const sig = signer(horodatage);
    const falsifie = { ...corps, phoneNumber: '620999999' };
    expect(verifierPasserelleUssd({ horodatage, signature: sig, ip: '10.0.0.1', corps: falsifie, maintenant })).toBe('refusee');
  });

  it('refuse une requete rejouee hors de la fenetre de cinq minutes', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    const ancien = String(Math.floor(maintenant / 1000) - 301);
    expect(verifierPasserelleUssd({ horodatage: ancien, signature: signer(ancien), ip: '10.0.0.1', corps, maintenant })).toBe('refusee');
  });

  it('refuse une adresse absente de la liste quand une liste est fixee', () => {
    process.env['USSD_HMAC_KEY'] = CLE;
    process.env['USSD_ALLOWED_IPS'] = '41.223.10.5, 41.223.10.6';
    const sig = signer(horodatage);
    expect(verifierPasserelleUssd({ horodatage, signature: sig, ip: '10.0.0.1', corps, maintenant })).toBe('refusee');
    expect(verifierPasserelleUssd({ horodatage, signature: sig, ip: '41.223.10.6', corps, maintenant })).toBe('ok');
  });
});

// ─── 2. Le patient ────────────────────────────────────────────────────────

describe('handleUssdRequest — code PIN', () => {
  it('demande le PIN avant toute donnee, sans dire si le numero est connu', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    const connu = await handleUssdRequest(requete(''));
    prisma.utilisateur.findFirst.mockResolvedValue(null);
    const inconnu = await handleUssdRequest(requete('', 'sess-2'));

    expect(connu.end).toBe(false);
    expect(connu.response).toMatch(/PIN/);
    expect(connu.response).not.toContain('Maomou');
    expect(inconnu.response).toBe(connu.response);
  });

  it('un mauvais PIN ne donne rien et compte un echec', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    const r = await handleUssdRequest(requete('0000*1'));

    expect(r.end).toBe(true);
    expect(r.response).not.toContain('Maomou');
    expect(r.response).not.toContain(QR);
    expect(prisma.patientProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pinUssdEchecs: 1 }) }),
    );
  });

  it('un numero inconnu recoit exactement la meme reponse qu un mauvais PIN', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    const mauvais = await handleUssdRequest(requete('0000*1'));
    prisma.utilisateur.findFirst.mockResolvedValue(null);
    const inconnu = await handleUssdRequest(requete('0000*1', 'sess-2'));
    expect(inconnu.response).toBe(mauvais.response);
  });

  it('un patient sans PIN defini n entre pas', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient({ pinUssdHash: null }));
    const r = await handleUssdRequest(requete(`${PIN}*1`));
    expect(r.response).not.toContain('Maomou');
  });

  it('bloque au cinquieme echec', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient({ pinUssdEchecs: 4 }));
    await handleUssdRequest(requete('0000*1'));
    const appel = prisma.patientProfile.update.mock.calls[0]?.[0] as { data: { pinUssdBloqueJusqua?: Date } };
    expect(appel.data.pinUssdBloqueJusqua).toBeInstanceOf(Date);
  });

  it('un compte bloque refuse meme le bon PIN', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(
      patient({ pinUssdEchecs: 5, pinUssdBloqueJusqua: new Date(Date.now() + 10 * 60 * 1000) }),
    );
    const r = await handleUssdRequest(requete(`${PIN}*1`));
    expect(r.response).not.toContain('Maomou');
  });

  it('ne conserve jamais le PIN dans la session enregistree', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    await handleUssdRequest(requete(`${PIN}*1`));
    const enregistre = JSON.stringify(prisma.ussdSession.upsert.mock.calls);
    expect(enregistre).not.toContain(PIN);
  });
});

describe('handleUssdRequest — donnees renvoyees', () => {
  beforeEach(() => prisma.utilisateur.findFirst.mockResolvedValue(patient()));

  it('le bon PIN ouvre le menu', async () => {
    const r = await handleUssdRequest(requete(PIN));
    expect(r.end).toBe(false);
    expect(r.response).toMatch(/1\. Mon profil/);
  });

  it('le profil ne contient jamais le code QR', async () => {
    const r = await handleUssdRequest(requete(`${PIN}*1`));
    expect(r.response).toContain('Maomou');
    expect(r.response).not.toContain(QR);
    expect(r.response).not.toMatch(/QR/i);
  });

  it('les rendez-vous ne revelent pas leur motif', async () => {
    prisma.rendezVous.findMany.mockResolvedValue([
      { prevuLe: new Date('2026-11-05T09:30:00Z'), motif: 'Suivi VIH' },
    ]);
    const r = await handleUssdRequest(requete(`${PIN}*2`));
    expect(r.response).not.toContain('VIH');
    expect(r.response).toContain('2026');
  });

  it('remet le compteur d echecs a zero apres un succes', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient({ pinUssdEchecs: 2 }));
    await handleUssdRequest(requete(`${PIN}*1`));
    expect(prisma.patientProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pinUssdEchecs: 0 }) }),
    );
  });
});

describe('handleUssdRequest — debit par numero', () => {
  it('refuse au-dela de dix sessions par quart d heure, sans rien ecrire', async () => {
    prisma.ussdSession.count.mockResolvedValue(10);
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    const r = await handleUssdRequest(requete(`${PIN}*1`, 'sess-nouvelle'));

    expect(r.end).toBe(true);
    expect(r.response).not.toContain('Maomou');
    expect(prisma.ussdSession.upsert).not.toHaveBeenCalled();
  });
});

describe('lecture du hache du PIN', () => {
  it('le client Prisma exclut le hache de toutes les requetes par defaut', () => {
    const { OMISSIONS_GLOBALES } = jest.requireActual('../src/config/prisma') as {
      OMISSIONS_GLOBALES: { patientProfile?: { pinUssdHash?: boolean } };
    };
    expect(OMISSIONS_GLOBALES.patientProfile?.pinUssdHash).toBe(true);
  });

  it('la passerelle demande explicitement le hache, exclu partout ailleurs', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(patient());
    await handleUssdRequest(requete(`${PIN}*1`));
    expect(prisma.utilisateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: { patientProfile: { omit: { pinUssdHash: false } } } }),
    );
  });
});

// ─── 3. Le choix du PIN par le patient ────────────────────────────────────

describe('definirPinUssd', () => {
  beforeEach(() => prisma.utilisateur.findUnique.mockResolvedValue(patient()));

  it('exige le mot de passe du compte', async () => {
    await expect(definirPinUssd('u-1', { pin: '4821', motDePasse: 'faux' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  it.each(['0000', '1111', '1234', '4321', '9876'])('refuse le PIN trivial %s', async (pin) => {
    await expect(definirPinUssd('u-1', { pin, motDePasse: 'MotDePasse-Patient-1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('enregistre un hache, jamais le PIN, et leve un blocage en cours', async () => {
    await definirPinUssd('u-1', { pin: '4821', motDePasse: 'MotDePasse-Patient-1' });
    const appel = prisma.patientProfile.update.mock.calls[0]?.[0] as {
      data: { pinUssdHash: string; pinUssdEchecs: number; pinUssdBloqueJusqua: null };
    };
    expect(appel.data.pinUssdHash).not.toBe('4821');
    expect(appel.data.pinUssdHash).toMatch(/^\$2[aby]\$/);
    expect(appel.data.pinUssdEchecs).toBe(0);
    expect(appel.data.pinUssdBloqueJusqua).toBeNull();
  });
});
