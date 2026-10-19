// Délivrer, substituer, refuser — et savoir qui l'a fait (EF-07-03/04/05/07).
//
// **Ce que la base ne savait pas.** `delivrerLigneOrdonnance` recevait une
// `quantiteDelivree`, la renvoyait à l'appelant et ne l'écrivait nulle part.
// Une officine qui n'avait que trois boîtes sur dix en remettait trois, la
// ligne passait à `DELIVREE`, le reste ne pouvait plus jamais être servi, et
// l'ordonnance s'annonçait servie. La délivrance partielle (EF-07-07) était
// dans le contrat, dans la signature de la fonction, et nulle part en base.
//
// Les invariants structurels — quantité qui suit le type, montant cohérent,
// motif exigé, jamais plus que le prescrit — vivent en base et ont été
// prouvés sur une base jetable en regardant chaque garde refuser. Ce fichier
// couvre ce qui est décidé en TypeScript.
import {
  delivrerLigneOrdonnance,
  refuserLigneOrdonnance,
  substituerLigneOrdonnance,
} from '../src/services/pharmacien.service';
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    ordonnance: { findUnique: jest.fn(), update: jest.fn() },
    ligneOrdonnance: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    stock: { findFirst: jest.fn(), updateMany: jest.fn() },
    lotStock: { findMany: jest.fn(), update: jest.fn() },
    acteDelivrance: { create: jest.fn(), aggregate: jest.fn() },
    mouvementStock: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({ notifierSansBloquer: jest.fn() }));
jest.mock('../src/utils/password.utils', () => ({ hashPassword: jest.fn() }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    ordonnance: { findUnique: M; update: M };
    ligneOrdonnance: { findUnique: M; findFirst: M; update: M };
    stock: { findFirst: M; updateMany: M };
    lotStock: { findMany: M; update: M };
    acteDelivrance: { create: M; aggregate: M };
    mouvementStock: { create: M };
    $transaction: M;
  };
};
const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as {
  getValeursParametres: M;
};
const { notifierSansBloquer } = jest.requireMock('../src/services/notification.service') as {
  notifierSansBloquer: M;
};

const PRESCRIT = { id: 'm-1', libelle: 'Doliprane 500mg', prixUnitaireGnf: 1000, estReglemente: false };
const EQUIVALENT = { id: 'm-2', libelle: 'Paracetamol Generique 500mg', prixUnitaireGnf: 800 };

/** Dix unités prescrites, document signé et valable. */
const LIGNE = {
  id: 'l1',
  quantite: 10,
  statut: 'EN_ATTENTE',
  idMedicament: 'm-1',
  idOrdonnance: 'o1',
  medicament: PRESCRIT,
  ordonnance: {
    id: 'o1',
    numero: 'OR-2026-000001',
    statut: 'EN_ATTENTE',
    signePar: 'u-med',
    signeLe: new Date('2026-10-01'),
    valideJusquau: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    renouvellementsAutorises: 0,
    renouvellementsUtilises: 0,
  },
};

const actesEcrits: Array<{ quantite: number; type: string; motif?: string; idMedicamentDelivre: string }> = [];

beforeEach(() => {
  jest.clearAllMocks();
  actesEcrits.length = 0;

  prisma.utilisateur.findUnique.mockResolvedValue({
    id: 'ph-u', idStructure: 'pharma-1',
    structure: { id: 'pharma-1', nom: 'Pharmacie Pricemou', type: 'PHARMACIE', prefecture: 'Conakry' },
    pharmacienProfile: {},
  });
  getValeursParametres.mockResolvedValue({
    prescription: {
      dureeValiditeJours: 90, longueurCodeVerification: 6, signatureObligatoire: true,
      dureeValiditeReglementeJours: 28, renouvellementsMax: 6,
    },
    facturation: { margePct: 15 },
  });
  prisma.ligneOrdonnance.findUnique.mockResolvedValue(LIGNE);
  prisma.ligneOrdonnance.findFirst.mockResolvedValue(null);
  prisma.ligneOrdonnance.update.mockResolvedValue({});
  prisma.ordonnance.findUnique.mockResolvedValue({
    numero: 'OR-2026-000001', statut: 'EN_ATTENTE', lignes: [{ statut: 'EN_ATTENTE' }],
    signePar: 'u-med',
    consultation: { idMedecinValideur: 'u-med', patient: { idUtilisateur: 'u-pat' } },
  });
  prisma.ordonnance.update.mockResolvedValue({});

  // Le stock de l'officine : la marge s'ajoute au prix national de reference.
  prisma.stock.findFirst.mockImplementation(async (args: { where: { idMedicament: string } }) => ({
    id: 's1', quantite: 500, margeGnf: 200,
    medicament: { prixUnitaireGnf: args.where.idMedicament === 'm-2' ? 800 : 1000 },
  }));
  prisma.stock.updateMany.mockResolvedValue({ count: 1 });
  prisma.lotStock.findMany.mockResolvedValue([
    { id: 'lot-1', quantite: 1000, datePeremption: new Date('2030-01-01') },
  ]);
  prisma.lotStock.update.mockResolvedValue({ idStock: 's1' });
  prisma.mouvementStock.create.mockResolvedValue({});

  prisma.acteDelivrance.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    actesEcrits.push(args.data as never);
    return {
      id: 'acte-1', ...args.data,
      medicamentDelivre: args.data['idMedicamentDelivre'] === 'm-2' ? EQUIVALENT : PRESCRIT,
    };
  });
  prisma.acteDelivrance.aggregate.mockImplementation(async () => ({
    _sum: { quantite: actesEcrits.reduce((t, a) => t + a.quantite, 0) },
  }));

  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
});

describe('la delivrance est nominative (EF-07-03)', () => {
  it('ecrit qui a remis, pas seulement quelle officine', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 4 });
    const acte = prisma.acteDelivrance.create.mock.calls[0]?.[0] as {
      data: { idPharmacien: string; idStructure: string };
    };
    expect(acte.data.idPharmacien).toBe('ph-u');
    expect(acte.data.idStructure).toBe('pharma-1');
  });

  it('fige le prix de l officine : reference plus marge', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 4 });
    const acte = prisma.acteDelivrance.create.mock.calls[0]?.[0] as {
      data: { prixUnitaireGnf: number; montantGnf: number };
    };
    expect(acte.data.prixUnitaireGnf).toBe(1200);
    expect(acte.data.montantGnf).toBe(4800);
  });
});

describe('la delivrance partielle (EF-07-07)', () => {
  it('enregistre la quantite reellement remise', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 3 });
    const acte = prisma.acteDelivrance.create.mock.calls[0]?.[0] as { data: { quantite: number } };
    expect(acte.data.quantite).toBe(3);
  });

  // **Le defaut d'origine.** Trois sur dix fermaient la ligne.
  it('laisse la ligne partiellement servie, pas delivree', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 3 });
    const maj = prisma.ligneOrdonnance.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('PARTIELLEMENT_SERVIE');
  });

  it('ferme la ligne quand la derniere unite sort', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 10 });
    const maj = prisma.ligneOrdonnance.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('DELIVREE');
  });

  // Le reste se sert ensuite, ici ou ailleurs : c'est tout l'objet du bloc.
  it('laisse servir le reste dans un second geste', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 3 });
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 7 });
    const dernier = prisma.ligneOrdonnance.update.mock.calls[1]?.[0] as { data: { statut: string } };
    expect(dernier.data.statut).toBe('DELIVREE');
  });

  it('refuse de depasser ce qui reste, en disant combien il reste', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 8 });
    await expect(delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 5 }))
      .rejects.toThrow(/ne reste que 2/);
  });

  it('sert tout le reste quand aucune quantite n est donnee', async () => {
    await delivrerLigneOrdonnance('l1', 'ph-u', { quantiteDelivree: 6 });
    await delivrerLigneOrdonnance('l1', 'ph-u', {});
    expect(actesEcrits[1]?.quantite).toBe(4);
  });

  // **Les lignes fermees par l'ancien code n'ont aucun acte.** S'en remettre
  // a la seule somme les rendrait delivrables une seconde fois.
  it.each(['DELIVREE', 'SERVIE', 'ANNULEE', 'EXPIREE'])(
    'refuse une ligne deja %s, meme sans acte enregistre',
    async (statut) => {
      prisma.ligneOrdonnance.findUnique.mockResolvedValue({ ...LIGNE, statut });
      await expect(delivrerLigneOrdonnance('l1', 'ph-u', {})).rejects.toThrow(ValidationError);
      expect(prisma.acteDelivrance.create).not.toHaveBeenCalled();
    },
  );
});

describe('la substitution (EF-07-04)', () => {
  it('enregistre le produit remis, son prix, et le motif', async () => {
    await substituerLigneOrdonnance('l1', 'ph-u', {
      idMedicamentDelivre: 'm-2', quantiteDelivree: 10, motif: 'rupture du princeps',
    });
    const acte = prisma.acteDelivrance.create.mock.calls[0]?.[0] as {
      data: { type: string; idMedicamentDelivre: string; prixUnitaireGnf: number; motif: string };
    };
    expect(acte.data.type).toBe('SUBSTITUE');
    expect(acte.data.idMedicamentDelivre).toBe('m-2');
    // Le prix est celui du produit **remis**, pas du prescrit.
    expect(acte.data.prixUnitaireGnf).toBe(1000);
    expect(acte.data.motif).toBe('rupture du princeps');
  });

  // Une substitution muette est une modification de traitement decidee par
  // quelqu'un qui n'a pas vu le patient.
  it('previent le patient et le prescripteur, en nommant les deux produits', async () => {
    await substituerLigneOrdonnance('l1', 'ph-u', {
      idMedicamentDelivre: 'm-2', quantiteDelivree: 10, motif: 'rupture du princeps',
    });
    const envois = notifierSansBloquer.mock.calls.map((c) => c[0] as {
      idUtilisateur: string; type: string; contenu: string;
    });
    expect(envois.map((e) => e.idUtilisateur).sort()).toEqual(['u-med', 'u-pat']);
    expect(envois[0]?.type).toBe('ORDONNANCE_SUBSTITUTION');
    expect(envois[0]?.contenu).toContain('Doliprane 500mg');
    expect(envois[0]?.contenu).toContain('Paracetamol Generique 500mg');
    expect(envois[0]?.contenu).toContain('rupture du princeps');
  });

  it.each(['', '   ', 'non'])('refuse un motif trop court (%j)', async (motif) => {
    await expect(substituerLigneOrdonnance('l1', 'ph-u', {
      idMedicamentDelivre: 'm-2', motif,
    })).rejects.toThrow(ValidationError);
    expect(prisma.acteDelivrance.create).not.toHaveBeenCalled();
  });

  // Substituer un produit par lui-meme est un mauvais libelle, pas une
  // substitution : le prescripteur recevrait une alerte pour rien.
  it('refuse de substituer le produit prescrit par lui-meme', async () => {
    await expect(substituerLigneOrdonnance('l1', 'ph-u', {
      idMedicamentDelivre: 'm-1', motif: 'un motif assez long',
    })).rejects.toThrow(/prescrit/);
  });

  it('compte dans le total servi : une substitution sert la ligne', async () => {
    await substituerLigneOrdonnance('l1', 'ph-u', {
      idMedicamentDelivre: 'm-2', quantiteDelivree: 10, motif: 'rupture du princeps',
    });
    const maj = prisma.ligneOrdonnance.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('DELIVREE');
  });
});

describe('le refus motive (EF-07-05)', () => {
  it('ne sort rien du stock', async () => {
    await refuserLigneOrdonnance('l1', 'ph-u', { motif: 'rupture, reapprovisionnement jeudi' });
    expect(prisma.stock.updateMany).not.toHaveBeenCalled();
    const acte = prisma.acteDelivrance.create.mock.calls[0]?.[0] as {
      data: { type: string; quantite: number; montantGnf: number };
    };
    expect(acte.data.type).toBe('REFUSE');
    expect(acte.data.quantite).toBe(0);
    expect(acte.data.montantGnf).toBe(0);
  });

  // **La ligne reste a servir.** Un refus dit qu'une officine ne l'a pas
  // servie, pas que l'ordonnance est morte : le patient va ailleurs.
  it('laisse la ligne en attente, servable ailleurs', async () => {
    await refuserLigneOrdonnance('l1', 'ph-u', { motif: 'rupture, reapprovisionnement jeudi' });
    expect(prisma.ligneOrdonnance.update).not.toHaveBeenCalled();
  });

  it('previent le patient et le prescripteur, et dit que l ordonnance reste valable', async () => {
    await refuserLigneOrdonnance('l1', 'ph-u', { motif: 'rupture, reapprovisionnement jeudi' });
    const envois = notifierSansBloquer.mock.calls.map((c) => c[0] as {
      idUtilisateur: string; type: string; contenu: string;
    });
    expect(envois.map((e) => e.idUtilisateur).sort()).toEqual(['u-med', 'u-pat']);
    expect(envois[0]?.type).toBe('ORDONNANCE_LIGNE_REFUSEE');
    expect(envois[0]?.contenu).toContain('rupture, reapprovisionnement jeudi');
    expect(envois[0]?.contenu).toMatch(/reste valable/i);
  });

  it.each(['', '  ', 'non'])('refuse un motif trop court (%j)', async (motif) => {
    await expect(refuserLigneOrdonnance('l1', 'ph-u', { motif })).rejects.toThrow(ValidationError);
    expect(prisma.acteDelivrance.create).not.toHaveBeenCalled();
  });
});
