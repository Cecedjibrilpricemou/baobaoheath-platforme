// L'ordonnance-document (P3 / EF-05-07, EF-05-08).
//
// Ce qui est protege ici tient en quatre points : un numero n'est jamais
// reattribue, un code n'est pas devinable, une ordonnance non signee n'est pas
// opposable, et le statut du document ne se saisit pas — il se deduit de ses
// lignes.
import {
  appliquerReglesDocument,
  avecExpiration,
  estExpiree,
  genererCodeVerification,
  motifDeRefus,
  ordonnanceEnRedaction,
  recalculerStatut,
  renouvelerOrdonnance,
  renouvellementsRestants,
  signerOrdonnance,
} from '../src/services/ordonnance.service';
import { StatutOrdonnance } from '../src/config/generated/client/client';
import { NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    ordonnance: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    ligneOrdonnance: { findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    ordonnance: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    ligneOrdonnance: { findUnique: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
};
const { prochainNumero } = jest.requireMock('../src/services/numero.service') as { prochainNumero: jest.Mock };
const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as { getValeursParametres: jest.Mock };

const PARAMETRES = {
  prescription: {
    dureeValiditeJours: 90,
    longueurCodeVerification: 6,
    signatureObligatoire: false,
    dureeValiditeReglementeJours: 28,
    renouvellementsMax: 6,
  },
};

const DANS_30_JOURS = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const HIER = new Date(Date.now() - 24 * 3600 * 1000);

beforeEach(() => {
  getValeursParametres.mockResolvedValue(PARAMETRES);
  // Par defaut aucun produit reglemente : chaque test qui en veut un le dit.
  prisma.ligneOrdonnance.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.resetAllMocks());

// ── Code de verification ─────────────────────────────────────────────
describe('genererCodeVerification', () => {
  it('respecte la longueur demandee', () => {
    expect(genererCodeVerification(6)).toHaveLength(6);
    expect(genererCodeVerification(10)).toHaveLength(10);
  });

  // Le code se recopie depuis un papier et se dicte au telephone : 0/O et
  // 1/I/L s'y confondent, et un code mal lu est un refus injustifie au
  // comptoir.
  it('n emploie aucun caractere ambigu a la lecture', () => {
    const codes = Array.from({ length: 200 }, () => genererCodeVerification(8)).join('');
    expect(codes).not.toMatch(/[O0I1L]/);
    expect(codes).toMatch(/^[A-Z2-9]+$/);
  });

  it('ne produit pas deux fois le meme code', () => {
    const codes = new Set(Array.from({ length: 500 }, () => genererCodeVerification(6)));
    // Avec 31^6 combinaisons, 500 tirages identiques signaleraient un
    // generateur constant ou mal seede.
    expect(codes.size).toBeGreaterThan(490);
  });
});

// ── Expiration ───────────────────────────────────────────────────────
describe('expiration', () => {
  it('une ordonnance dont la validite est passee est expiree', () => {
    expect(estExpiree({ valideJusquau: HIER })).toBe(true);
    expect(estExpiree({ valideJusquau: DANS_30_JOURS })).toBe(false);
  });

  it('avecExpiration ajoute le calcul sans toucher au reste', () => {
    const vue = avecExpiration({ id: 'ord-1', numero: 'OR-2026-000001', valideJusquau: HIER });
    expect(vue).toEqual({ id: 'ord-1', numero: 'OR-2026-000001', valideJusquau: HIER, expiree: true });
  });
});

// ── Ouverture du document ────────────────────────────────────────────
describe('ordonnanceEnRedaction', () => {
  it('reutilise l ordonnance non signee de la consultation', async () => {
    const existante = { id: 'ord-1', numero: 'OR-2026-000001' };
    prisma.ordonnance.findFirst.mockResolvedValue(existante);

    const res = await ordonnanceEnRedaction('cons-1');

    expect(res).toBe(existante);
    // Un deuxieme medicament ne doit pas consommer un deuxieme numero.
    expect(prochainNumero).not.toHaveBeenCalled();
    expect(prisma.ordonnance.create).not.toHaveBeenCalled();
  });

  it('ouvre un document numerote, code et date quand il n y en a pas', async () => {
    prisma.ordonnance.findFirst.mockResolvedValue(null);
    prochainNumero.mockResolvedValue('OR-2026-000042');
    prisma.ordonnance.create.mockImplementation(async ({ data }: { data: unknown }) => data);

    const res = await ordonnanceEnRedaction('cons-1') as unknown as {
      numero: string; codeVerification: string; valideJusquau: Date; idConsultation: string;
    };

    expect(prochainNumero).toHaveBeenCalledWith('OR', expect.anything());
    expect(res.numero).toBe('OR-2026-000042');
    expect(res.idConsultation).toBe('cons-1');
    expect(res.codeVerification).toHaveLength(6);

    // La validite vient du parametre systeme, pas d'une constante du code.
    const jours = Math.round((res.valideJusquau.getTime() - Date.now()) / (24 * 3600 * 1000));
    expect(jours).toBe(90);
  });

  it('suit le parametre systeme quand l administrateur change la duree', async () => {
    getValeursParametres.mockResolvedValue({ prescription: { dureeValiditeJours: 30, longueurCodeVerification: 8 } });
    prisma.ordonnance.findFirst.mockResolvedValue(null);
    prochainNumero.mockResolvedValue('OR-2026-000043');
    prisma.ordonnance.create.mockImplementation(async ({ data }: { data: unknown }) => data);

    const res = await ordonnanceEnRedaction('cons-1') as unknown as { codeVerification: string; valideJusquau: Date };

    expect(res.codeVerification).toHaveLength(8);
    expect(Math.round((res.valideJusquau.getTime() - Date.now()) / (24 * 3600 * 1000))).toBe(30);
  });
});

// ── Statut deduit des lignes ─────────────────────────────────────────
describe('recalculerStatut', () => {
  function documentAvec(statut: string, statutsLignes: string[]) {
    prisma.ordonnance.findUnique.mockResolvedValue({
      id: 'ord-1', statut, lignes: statutsLignes.map((s) => ({ statut: s })),
    });
  }

  it('passe a SERVIE quand toutes les lignes sont delivrees', async () => {
    documentAvec('PARTIELLEMENT_SERVIE', ['DELIVREE', 'DELIVREE']);

    await expect(recalculerStatut('ord-1')).resolves.toBe('SERVIE');
    expect(prisma.ordonnance.update).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { statut: 'SERVIE' } });
  });

  it('passe a PARTIELLEMENT_SERVIE des qu une ligne est delivree', async () => {
    documentAvec('EN_ATTENTE', ['DELIVREE', 'EN_ATTENTE']);

    await expect(recalculerStatut('ord-1')).resolves.toBe('PARTIELLEMENT_SERVIE');
  });

  it('reste EN_ATTENTE tant que rien n est delivre', async () => {
    documentAvec('EN_ATTENTE', ['EN_ATTENTE', 'EN_ATTENTE']);

    await expect(recalculerStatut('ord-1')).resolves.toBe('EN_ATTENTE');
    // Rien n'a change : pas d'ecriture inutile.
    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });

  // Une ordonnance annulee ne doit pas « revivre » parce qu'une ligne a ete
  // delivree avant l'annulation.
  it('ne ressuscite pas une ordonnance annulee', async () => {
    documentAvec('ANNULEE', ['DELIVREE', 'DELIVREE']);

    await expect(recalculerStatut('ord-1')).resolves.toBe('ANNULEE');
    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });

  it('ne ressuscite pas une ordonnance expiree', async () => {
    documentAvec('EXPIREE', ['DELIVREE']);

    await expect(recalculerStatut('ord-1')).resolves.toBe('EXPIREE');
    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });

  it('404 sur une ordonnance inconnue', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(null);
    await expect(recalculerStatut('ord-x')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── Signature ────────────────────────────────────────────────────────
describe('signerOrdonnance', () => {
  it('refuse de signer une ordonnance sans medicament', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ id: 'ord-1', signeLe: null, lignes: [] });

    await expect(signerOrdonnance('ord-1', 'med-1')).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });

  it('refuse une seconde signature', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({
      id: 'ord-1', signeLe: new Date('2026-09-01'), lignes: [{ id: 'l1' }],
    });

    await expect(signerOrdonnance('ord-1', 'med-2')).rejects.toBeInstanceOf(ValidationError);
  });

  // La validite court a partir de la signature : une ordonnance redigee par
  // l'ASC puis signee trois jours plus tard ne doit pas perdre ces trois jours.
  it('fait courir la validite depuis la signature', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ id: 'ord-1', signeLe: null, lignes: [{ id: 'l1' }] });
    prisma.ordonnance.update.mockImplementation(async ({ data }: { data: unknown }) => data);

    await signerOrdonnance('ord-1', 'med-1');

    const { data } = prisma.ordonnance.update.mock.calls[0][0];
    expect(data.signePar).toBe('med-1');
    const ecart = Math.round((data.valideJusquau.getTime() - data.signeLe.getTime()) / (24 * 3600 * 1000));
    expect(ecart).toBe(90);
  });
});

// ── Refus au comptoir ────────────────────────────────────────────────
describe('motifDeRefus', () => {
  const VALIDE: {
    statut: StatutOrdonnance;
    signeLe: Date | null;
    valideJusquau: Date;
    contientProduitReglemente: boolean;
    renouvellementsRestants: number;
  } = {
    statut: StatutOrdonnance.EN_ATTENTE,
    signeLe: new Date('2026-09-01'),
    valideJusquau: DANS_30_JOURS,
    contientProduitReglemente: false,
    renouvellementsRestants: 0,
  };

  it('laisse passer une ordonnance signee, valide et non servie', () => {
    expect(motifDeRefus(VALIDE)).toBeNull();
  });

  // Decision D2 non tranchee : par defaut un ASC prescrit et la pharmacie
  // delivre. Exiger la signature partout bloquerait les villages sans medecin.
  it('laisse passer une ordonnance non signee tant que la signature n est pas imposee', () => {
    expect(motifDeRefus({ ...VALIDE, signeLe: null })).toBeNull();
  });

  it('refuse une ordonnance non signee quand la signature est imposee', () => {
    expect(motifDeRefus({ ...VALIDE, signeLe: null }, true)).toMatch(/non signee/i);
  });

  it('refuse une ordonnance annulee', () => {
    expect(motifDeRefus({ ...VALIDE, statut: StatutOrdonnance.ANNULEE })).toMatch(/annulee/i);
  });

  it('refuse une ordonnance deja entierement servie', () => {
    expect(motifDeRefus({ ...VALIDE, statut: StatutOrdonnance.SERVIE })).toMatch(/servie/i);
  });

  it('refuse une ordonnance expiree en donnant la date', () => {
    const motif = motifDeRefus({ ...VALIDE, valideJusquau: new Date('2026-01-15') });
    expect(motif).toMatch(/expiree/i);
    // Le pharmacien doit pouvoir dire au patient depuis quand.
    expect(motif).toContain('15/01/2026');
  });

  // Une ordonnance partiellement servie reste servable : le patient revient
  // chercher le reste de son traitement.
  it('laisse passer une ordonnance partiellement servie', () => {
    expect(motifDeRefus({ ...VALIDE, statut: StatutOrdonnance.PARTIELLEMENT_SERVIE })).toBeNull();
  });

  // EF-05-09 : une ordonnance servie n'est pas finie s'il reste un cycle.
  it('laisse passer une ordonnance servie s il reste un renouvellement', () => {
    expect(motifDeRefus({
      ...VALIDE, statut: StatutOrdonnance.SERVIE, renouvellementsRestants: 2,
    })).toBeNull();
  });

  it('refuse une ordonnance servie sans renouvellement restant', () => {
    expect(motifDeRefus({
      ...VALIDE, statut: StatutOrdonnance.SERVIE, renouvellementsRestants: 0,
    })).toMatch(/servie/i);
  });

  // EF-05-12 : un stupefiant ne se delivre pas sur la parole d'un agent
  // communautaire, meme quand la decision D2 n'impose rien au cas general.
  it('exige un medecin pour un produit reglemente, meme sans signature obligatoire', () => {
    const motif = motifDeRefus({ ...VALIDE, signeLe: null, contientProduitReglemente: true });
    expect(motif).toMatch(/reglemente/i);
    expect(motif).toMatch(/medecin/i);
  });

  it('laisse passer un produit reglemente signe par un medecin', () => {
    expect(motifDeRefus({ ...VALIDE, contientProduitReglemente: true })).toBeNull();
  });

  // L'ordre compte : quand la signature est imposee, une ordonnance non signee
  // ET expiree doit d'abord signaler l'absence de signature, qui est le defaut
  // le plus grave.
  it('signale d abord l absence de signature', () => {
    expect(motifDeRefus({ ...VALIDE, signeLe: null, valideJusquau: HIER }, true)).toMatch(/non signee/i);
  });

  // Une ordonnance non signee reste soumise a sa date de validite : ne pas
  // exiger la signature ne doit pas rendre une ordonnance perimee delivrable.
  it('refuse une ordonnance non signee mais expiree, signature non imposee', () => {
    expect(motifDeRefus({ ...VALIDE, signeLe: null, valideJusquau: HIER })).toMatch(/expiree/i);
  });
});

// ── Renouvellement et produits reglementes (EF-05-09, EF-05-12) ──────
describe('renouvellementsRestants', () => {
  it('compte ce qui reste, jamais en dessous de zero', () => {
    expect(renouvellementsRestants({ renouvellementsAutorises: 3, renouvellementsUtilises: 1 })).toBe(2);
    expect(renouvellementsRestants({ renouvellementsAutorises: 0, renouvellementsUtilises: 0 })).toBe(0);
    // Un compteur incoherent ne doit pas produire un nombre negatif, qui
    // passerait pour « pas de renouvellement » a un endroit et pour un
    // booleen vrai a un autre.
    expect(renouvellementsRestants({ renouvellementsAutorises: 1, renouvellementsUtilises: 4 })).toBe(0);
  });
});

describe('renouvelerOrdonnance', () => {
  const SERVIE = {
    id: 'ord-1', statut: 'SERVIE', valideJusquau: DANS_30_JOURS,
    renouvellementsAutorises: 2, renouvellementsUtilises: 0,
    lignes: [{ id: 'l1', statut: 'DELIVREE' }],
  };

  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        ligneOrdonnance: { updateMany: prisma.ligneOrdonnance.updateMany },
        ordonnance: { update: prisma.ordonnance.update },
      })
    );
  });

  it('rouvre les lignes et avance le compteur, sans changer le numero', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(SERVIE);
    prisma.ordonnance.update.mockResolvedValue({ ...SERVIE, statut: 'EN_ATTENTE', renouvellementsUtilises: 1 });

    await renouvelerOrdonnance('ord-1');

    expect(prisma.ligneOrdonnance.updateMany).toHaveBeenCalledWith({
      where: { idOrdonnance: 'ord-1' }, data: { statut: 'EN_ATTENTE' },
    });
    const { data } = prisma.ordonnance.update.mock.calls[0][0];
    expect(data).toEqual({ statut: 'EN_ATTENTE', renouvellementsUtilises: { increment: 1 } });
    // Le patient represente le meme papier : ni le numero ni le code ne bougent.
    expect(data).not.toHaveProperty('numero');
    expect(data).not.toHaveProperty('codeVerification');
  });

  it('refuse un produit reglemente', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(SERVIE);
    prisma.ligneOrdonnance.findFirst.mockResolvedValue({ id: 'l1' });

    await expect(renouvelerOrdonnance('ord-1')).rejects.toThrow(/reglemente/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse quand il ne reste aucun cycle', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ ...SERVIE, renouvellementsUtilises: 2 });

    await expect(renouvelerOrdonnance('ord-1')).rejects.toThrow(/renouvellement/i);
  });

  // Rouvrir une ordonnance non servie permettrait de delivrer deux fois le
  // meme traitement dans le meme cycle.
  it('refuse une ordonnance qui n est pas entierement servie', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ ...SERVIE, statut: 'PARTIELLEMENT_SERVIE' });

    await expect(renouvelerOrdonnance('ord-1')).rejects.toThrow(/servie/i);
  });

  // Un renouvellement ne prolonge pas une ordonnance perimee.
  it('refuse une ordonnance expiree', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ ...SERVIE, valideJusquau: HIER });

    await expect(renouvelerOrdonnance('ord-1')).rejects.toThrow(/expiree/i);
  });
});

describe('appliquerReglesDocument', () => {
  const DOC = {
    id: 'ord-1', signeLe: null, creeLe: new Date(),
    valideJusquau: DANS_30_JOURS, renouvellementsAutorises: 0,
  };

  it('accorde les renouvellements demandes', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(DOC);

    await appliquerReglesDocument('ord-1', 3);

    expect(prisma.ordonnance.update.mock.calls[0][0].data.renouvellementsAutorises).toBe(3);
  });

  // Le plafond vient du parametre systeme, pas d'une constante ni du client.
  it('plafonne au parametre systeme', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(DOC);

    await appliquerReglesDocument('ord-1', 99);

    expect(prisma.ordonnance.update.mock.calls[0][0].data.renouvellementsAutorises).toBe(6);
  });

  // EF-05-12 : le prescripteur ne peut pas rendre renouvelable une ordonnance
  // portant un stupefiant, meme en le demandant explicitement.
  it('ferme le renouvellement des qu un produit reglemente entre dans l ordonnance', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ ...DOC, renouvellementsAutorises: 3 });
    prisma.ligneOrdonnance.findFirst.mockResolvedValue({ id: 'l1' });

    await appliquerReglesDocument('ord-1', 5);

    const { data } = prisma.ordonnance.update.mock.calls[0][0];
    expect(data.renouvellementsAutorises).toBe(0);
  });

  it('raccourcit la validite d une ordonnance reglementee', async () => {
    const creeLe = new Date();
    prisma.ordonnance.findUnique.mockResolvedValue({ ...DOC, creeLe });
    prisma.ligneOrdonnance.findFirst.mockResolvedValue({ id: 'l1' });

    await appliquerReglesDocument('ord-1');

    const { data } = prisma.ordonnance.update.mock.calls[0][0];
    const jours = Math.round((data.valideJusquau.getTime() - creeLe.getTime()) / (24 * 3600 * 1000));
    expect(jours).toBe(28);
  });

  // Sans changement, pas d'ecriture : une ordonnance signee ne doit pas voir
  // sa date glisser parce qu'on a ajoute une ligne.
  it('n ecrit rien quand rien ne change', async () => {
    const creeLe = new Date();
    const valideJusquau = new Date(creeLe);
    valideJusquau.setDate(valideJusquau.getDate() + 90);
    prisma.ordonnance.findUnique.mockResolvedValue({ ...DOC, creeLe, valideJusquau });

    await appliquerReglesDocument('ord-1');

    expect(prisma.ordonnance.update).not.toHaveBeenCalled();
  });
});
