// Vente au comptoir et tableau de bord d'officine (addendum du 2026-09-28,
// points 1.1 et 1.2).
//
// Trois choses comptent ici et sont testees pour elles-memes : un produit
// reglemente ne sort pas sans ordonnance (EF-05-12), une remise ne depasse pas
// son plafond administrable, et une annulation remet en stock exactement les
// lots qui en sont sortis — sinon le stock derive a chaque erreur de caisse.
import {
  annulerVente,
  creerVente,
  fusionnerLignes,
  getVente,
  produitsExigeantOrdonnance,
  tableauDeBord,
} from '../src/services/vente.service';
import { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    medicament: { findMany: jest.fn() },
    ordonnance: { findUnique: jest.fn() },
    stock: {
      findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
      fields: { seuilAlerte: { __field: 'seuilAlerte' } },
    },
    lotStock: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    venteComptoir: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn(),
    },
    ligneVente: { create: jest.fn(), groupBy: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));
// Le chiffrage de l'assurance est teste pour lui-meme dans
// assurance.service.test.ts : ici on verifie seulement comment la caisse s'en
// sert, et ce qu'elle fige sur la vente.
jest.mock('../src/services/assurance.service', () => ({ chiffrer: jest.fn() }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    medicament: { findMany: M };
    ordonnance: { findUnique: M };
    stock: { findMany: M; findUnique: M; update: M; updateMany: M; fields: unknown };
    lotStock: { findMany: M; update: M; count: M };
    venteComptoir: {
      create: M; findMany: M; findUnique: M; findUniqueOrThrow: M;
      updateMany: M; aggregate: M; groupBy: M;
    };
    ligneVente: { create: M; groupBy: M };
    $transaction: M;
  };
};
const { prochainNumero } = jest.requireMock('../src/services/numero.service') as { prochainNumero: M };
const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as {
  getValeursParametres: M;
};
const { chiffrer } = jest.requireMock('../src/services/assurance.service') as { chiffrer: M };

const pharmacien: JwtPayload = { userId: 'pharma-1', role: 'PHARMACIEN', sessionId: 's' } as JwtPayload;

/** Paracetamol : 1 000 GNF de reference, 200 de marge → 1 200 au comptoir. */
const STOCK_PARA = {
  id: 'st-para', idMedicament: 'm-para', quantite: 500, seuilAlerte: 10, unite: 'boite', margeGnf: 200,
  medicament: {
    id: 'm-para', libelle: 'Doliprane 500mg', categorie: 'MEDICAMENT',
    estReglemente: false, prixUnitaireGnf: 1000,
  },
};

const STOCK_LAIT = {
  id: 'st-lait', idMedicament: 'm-lait', quantite: 60, seuilAlerte: 10, unite: 'boite', margeGnf: 5000,
  medicament: {
    id: 'm-lait', libelle: 'Lait infantile 1er age', categorie: 'LAIT_INFANTILE',
    estReglemente: false, prixUnitaireGnf: 40000,
  },
};

const STOCK_MORPHINE = {
  id: 'st-morph', idMedicament: 'm-morph', quantite: 20, seuilAlerte: 5, unite: 'ampoule', margeGnf: 0,
  medicament: {
    id: 'm-morph', libelle: 'Morphine 10mg', categorie: 'MEDICAMENT',
    estReglemente: true, prixUnitaireGnf: 8000,
  },
};

const venteRow = {
  id: 've-1', numero: 'VE-2026-000001', statut: 'PAYEE',
  montantBrutGnf: 2400, remiseGnf: 0, montantNetGnf: 2400,
  modePaiement: 'ESPECES', numeroOperateur: null, creeLe: new Date('2026-10-02T10:00:00Z'),
  annuleeLe: null, motifAnnulation: null,
  vendeur: { id: 'pharma-1', prenom: 'Ousmane', nom: 'Pricemou' },
  patient: null, ordonnance: null,
  lignes: [{
    id: 'lv-1', quantite: 2, prixUnitaireGnf: 1200, montantGnf: 2400,
    medicament: { id: 'm-para', libelle: 'Doliprane 500mg', categorie: 'MEDICAMENT', dci: 'Paracetamol', nomCommercial: 'Doliprane', dosage: '500mg', forme: 'comprime' },
  }],
};

const PARAMETRES = {
  pharmacie: { remiseMaxPourcent: 20, categoriesExigeantOrdonnance: [] as string[] },
  prescription: { signatureObligatoire: false },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-P', structure: { type: 'PHARMACIE' } });
  prochainNumero.mockResolvedValue('VE-2026-000001');
  getValeursParametres.mockResolvedValue(PARAMETRES);
  prisma.venteComptoir.create.mockResolvedValue({ id: 've-1' });
  prisma.venteComptoir.findUniqueOrThrow.mockResolvedValue(venteRow);
  prisma.lotStock.findMany.mockResolvedValue([
    { id: 'lot-1', quantite: 500, datePeremption: new Date(Date.now() + 200 * 86_400_000), creeLe: new Date() },
  ]);
  prisma.lotStock.update.mockResolvedValue({});
  prisma.stock.update.mockResolvedValue({});
  prisma.ligneVente.create.mockResolvedValue({});
  chiffrer.mockResolvedValue(null);
});

// ── Fonctions pures ──────────────────────────────────────────────────

describe('fusionnerLignes', () => {
  it('additionne les quantites du meme produit : scanner deux fois une boite veut dire deux', () => {
    expect(fusionnerLignes([
      { idMedicament: 'm-para', quantite: 1 },
      { idMedicament: 'm-lait', quantite: 3 },
      { idMedicament: 'm-para', quantite: 2 },
    ])).toEqual([
      { idMedicament: 'm-para', quantite: 3 },
      { idMedicament: 'm-lait', quantite: 3 },
    ]);
  });

  it('refuse une quantite nulle ou negative', () => {
    expect(() => fusionnerLignes([{ idMedicament: 'm-para', quantite: 0 }])).toThrow(ValidationError);
    expect(() => fusionnerLignes([{ idMedicament: 'm-para', quantite: -2 }])).toThrow(ValidationError);
  });

  it('refuse une quantite fractionnaire : on ne vend pas un tiers de boite', () => {
    expect(() => fusionnerLignes([{ idMedicament: 'm-para', quantite: 1.5 }])).toThrow(ValidationError);
  });
});

describe('produitsExigeantOrdonnance', () => {
  const para = { libelle: 'Doliprane', estReglemente: false, categorie: 'MEDICAMENT' };
  const morphine = { libelle: 'Morphine', estReglemente: true, categorie: 'MEDICAMENT' };
  const lait = { libelle: 'Lait', estReglemente: false, categorie: 'LAIT_INFANTILE' };

  it('un produit reglemente en exige une, quels que soient les parametres (EF-05-12)', () => {
    expect(produitsExigeantOrdonnance([para, morphine], [])).toEqual(['Morphine']);
  });

  it('une categorie soumise par les parametres en exige une aussi', () => {
    expect(produitsExigeantOrdonnance([para, lait], ['LAIT_INFANTILE'])).toEqual(['Lait']);
  });

  it('ne retient rien quand aucun produit n est concerne', () => {
    expect(produitsExigeantOrdonnance([para, lait], [])).toEqual([]);
  });
});

// ── Creation d'une vente ─────────────────────────────────────────────

describe('creerVente', () => {
  it('refuse un panier vide', async () => {
    await expect(creerVente(pharmacien, { lignes: [], modePaiement: 'ESPECES' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un compte rattache a une structure qui n est pas une pharmacie', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-C', structure: { type: 'CENTRE_SANTE' } });
    await expect(creerVente(pharmacien, { lignes: [{ idMedicament: 'm-para', quantite: 1 }], modePaiement: 'ESPECES' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un paiement mobile sans numero d abonne', async () => {
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 1 }], modePaiement: 'ORANGE_MONEY',
    })).rejects.toThrow(/numero de l abonne/i);
  });

  it('refuse un produit absent du stock de cette officine', async () => {
    prisma.stock.findMany.mockResolvedValue([]);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-inconnu', quantite: 1 }], modePaiement: 'ESPECES',
    })).rejects.toThrow(/pas au stock de cette officine/i);
  });

  // EF-05-12. C'est la regle la plus importante de ce service : un stupefiant
  // qui sort sans ordonnance est un probleme reglementaire, pas un bug
  // d'affichage.
  it('refuse un produit reglemente sans ordonnance', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_MORPHINE]);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-morph', quantite: 1 }], modePaiement: 'ESPECES',
    })).rejects.toThrow(/Ordonnance obligatoire pour : Morphine 10mg/);
  });

  it('refuse une categorie que les parametres soumettent a ordonnance', async () => {
    getValeursParametres.mockResolvedValue({
      ...PARAMETRES,
      pharmacie: { remiseMaxPourcent: 20, categoriesExigeantOrdonnance: ['LAIT_INFANTILE'] },
    });
    prisma.stock.findMany.mockResolvedValue([STOCK_LAIT]);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-lait', quantite: 1 }], modePaiement: 'ESPECES',
    })).rejects.toThrow(/Ordonnance obligatoire pour : Lait infantile/);
  });

  it('accepte un produit reglemente avec une ordonnance valide', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_MORPHINE]);
    prisma.ordonnance.findUnique.mockResolvedValue({
      id: 'or-1', statut: 'EN_ATTENTE', signeLe: new Date(), valideJusquau: new Date(Date.now() + 86_400_000),
      renouvellementsAutorises: 0, renouvellementsUtilises: 0,
      lignes: [{ medicament: { estReglemente: true } }],
    });

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-morph', quantite: 1 }], modePaiement: 'ESPECES', idOrdonnance: 'or-1',
    });

    expect(prisma.venteComptoir.create).toHaveBeenCalled();
  });

  it('refuse une ordonnance expiree, comme au guichet de delivrance', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_MORPHINE]);
    prisma.ordonnance.findUnique.mockResolvedValue({
      id: 'or-1', statut: 'EN_ATTENTE', signeLe: new Date(), valideJusquau: new Date(Date.now() - 86_400_000),
      renouvellementsAutorises: 0, renouvellementsUtilises: 0,
      lignes: [{ medicament: { estReglemente: true } }],
    });

    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-morph', quantite: 1 }], modePaiement: 'ESPECES', idOrdonnance: 'or-1',
    })).rejects.toThrow(/Ordonnance refusee/);
  });

  it('404 sur une ordonnance inconnue', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);
    prisma.ordonnance.findUnique.mockResolvedValue(null);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 1 }], modePaiement: 'ESPECES', idOrdonnance: 'or-x',
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('chiffre la ligne au tarif de reference plus la marge de l officine', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
    });

    // 1 000 de reference + 200 de marge = 1 200 ; deux boites = 2 400.
    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montantBrutGnf: 2400, remiseGnf: 0, montantNetGnf: 2400 }),
    }));
    expect(prisma.ligneVente.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ prixUnitaireGnf: 1200, montantGnf: 2400 }),
    }));
  });

  it('deduit la remise du net, sans toucher au brut', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES', remiseGnf: 400,
    });

    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montantBrutGnf: 2400, remiseGnf: 400, montantNetGnf: 2000 }),
    }));
  });

  // Sans plafond, une erreur de frappe ramene une vente a zero.
  it('refuse une remise au-dela du plafond administrable', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES', remiseGnf: 1000,
    })).rejects.toThrow(/plafonnee a 20 %/);
  });

  it('suit le plafond quand les parametres le changent', async () => {
    getValeursParametres.mockResolvedValue({
      ...PARAMETRES,
      pharmacie: { remiseMaxPourcent: 50, categoriesExigeantOrdonnance: [] },
    });
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES', remiseGnf: 1000,
    });

    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montantNetGnf: 1400 }),
    }));
  });

  it('consomme les lots, decremente le stock et garde la trace des lots sortis', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);
    prisma.lotStock.findMany.mockResolvedValue([
      { id: 'lot-proche', quantite: 1, datePeremption: new Date(Date.now() + 10 * 86_400_000), creeLe: new Date() },
      { id: 'lot-lointain', quantite: 50, datePeremption: new Date(Date.now() + 300 * 86_400_000), creeLe: new Date() },
    ]);

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 3 }], modePaiement: 'ESPECES',
    });

    // Le lot le plus proche part d'abord, en entier, puis le suivant.
    expect(prisma.ligneVente.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lotsConsommes: [{ idLot: 'lot-proche', quantite: 1 }, { idLot: 'lot-lointain', quantite: 2 }],
      }),
    }));
    expect(prisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'st-para' },
      data: { quantite: { decrement: 3 } },
    }));
  });

  it('refuse la vente quand les lots non perimes ne suffisent pas', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);
    prisma.lotStock.findMany.mockResolvedValue([
      { id: 'lot-1', quantite: 1, datePeremption: new Date(Date.now() + 10 * 86_400_000), creeLe: new Date() },
    ]);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 5 }], modePaiement: 'ESPECES',
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it('vend sans client : un passant n a pas de dossier', async () => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 1 }], modePaiement: 'ESPECES',
    });

    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idPatient: null }),
    }));
  });
});

// ── Annulation ───────────────────────────────────────────────────────

describe('annulerVente', () => {
  const vendue = {
    id: 've-1', statut: 'PAYEE', idStructure: 'struct-P',
    lignes: [{
      id: 'lv-1', quantite: 3, idMedicament: 'm-para',
      lotsConsommes: [{ idLot: 'lot-proche', quantite: 1 }, { idLot: 'lot-lointain', quantite: 2 }],
    }],
  };

  beforeEach(() => {
    prisma.venteComptoir.findUnique.mockResolvedValue(vendue);
    prisma.venteComptoir.updateMany.mockResolvedValue({ count: 1 });
    prisma.stock.updateMany.mockResolvedValue({ count: 1 });
  });

  it('exige un motif d au moins cinq caracteres', async () => {
    await expect(annulerVente(pharmacien, 've-1', { motif: 'oops' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('404 sur une vente inconnue', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue(null);
    await expect(annulerVente(pharmacien, 've-x', { motif: 'erreur de saisie' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuse la vente d une autre officine', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue({ ...vendue, idStructure: 'struct-AUTRE' });
    await expect(annulerVente(pharmacien, 've-1', { motif: 'erreur de saisie' }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse une vente deja annulee', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue({ ...vendue, statut: 'ANNULEE' });
    await expect(annulerVente(pharmacien, 've-1', { motif: 'erreur de saisie' }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  // Sans remise exacte des lots, chaque erreur de caisse ferait deriver le
  // stock de facon permanente.
  it('remet en stock exactement les lots qui en etaient sortis', async () => {
    await annulerVente(pharmacien, 've-1', { motif: 'erreur de saisie au comptoir' });

    expect(prisma.lotStock.update).toHaveBeenCalledWith({
      where: { id: 'lot-proche' }, data: { quantite: { increment: 1 } },
    });
    expect(prisma.lotStock.update).toHaveBeenCalledWith({
      where: { id: 'lot-lointain' }, data: { quantite: { increment: 2 } },
    });
    expect(prisma.stock.updateMany).toHaveBeenCalledWith({
      where: { idStructure: 'struct-P', idMedicament: 'm-para' },
      data: { quantite: { increment: 3 } },
    });
  });

  it('trace qui a annule, quand et pourquoi', async () => {
    await annulerVente(pharmacien, 've-1', { motif: 'erreur de saisie au comptoir' });

    expect(prisma.venteComptoir.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 've-1', statut: 'PAYEE' },
      data: expect.objectContaining({
        statut: 'ANNULEE',
        motifAnnulation: 'erreur de saisie au comptoir',
        idAnnuleePar: 'pharma-1',
      }),
    }));
  });

  // Prise atomique : le `where` porte le statut, donc deux annulations
  // simultanees donnent une gagnante et une perdante.
  it('perd la course quand quelqu un d autre a annule entre-temps', async () => {
    prisma.venteComptoir.updateMany.mockResolvedValue({ count: 0 });
    await expect(annulerVente(pharmacien, 've-1', { motif: 'erreur de saisie' }))
      .rejects.toBeInstanceOf(ConflictError);
    expect(prisma.lotStock.update).not.toHaveBeenCalled();
  });
});

describe('getVente', () => {
  it('refuse la vente d une autre officine', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue({ ...venteRow, idStructure: 'struct-AUTRE' });
    await expect(getVente(pharmacien, 've-1')).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ── Tableau de bord ──────────────────────────────────────────────────

describe('tableauDeBord', () => {
  beforeEach(() => {
    prisma.venteComptoir.aggregate.mockResolvedValue({ _sum: { montantNetGnf: 24000 }, _count: 4 });
    prisma.venteComptoir.groupBy.mockResolvedValue([
      { modePaiement: 'ESPECES', _sum: { montantNetGnf: 14000 }, _count: 3 },
      { modePaiement: 'ORANGE_MONEY', _sum: { montantNetGnf: 10000 }, _count: 1 },
    ]);
    prisma.ligneVente.groupBy.mockResolvedValue([
      { idMedicament: 'm-para', _sum: { quantite: 42, montantGnf: 50400 } },
    ]);
    prisma.medicament.findMany.mockResolvedValue([
      { id: 'm-para', libelle: 'Doliprane 500mg', categorie: 'MEDICAMENT', dci: 'Paracetamol', nomCommercial: 'Doliprane', dosage: '500mg', forme: 'comprime' },
    ]);
    prisma.stock.findMany.mockResolvedValue([
      { ...STOCK_PARA, quantite: 4, medicament: { id: 'm-para', libelle: 'Doliprane 500mg', categorie: 'MEDICAMENT', dci: 'Paracetamol', nomCommercial: 'Doliprane', dosage: '500mg', forme: 'comprime' } },
    ]);
    prisma.lotStock.count.mockResolvedValue(3);
  });

  it('rend le chiffre du jour, le nombre de ventes et le panier moyen', async () => {
    const t = await tableauDeBord(pharmacien);
    expect(t.chiffreDuJourGnf).toBe(24000);
    expect(t.nombreVentesDuJour).toBe(4);
    expect(t.panierMoyenGnf).toBe(6000);
  });

  it('rend un panier moyen de zero sans vente, plutot qu une division par zero', async () => {
    prisma.venteComptoir.aggregate.mockResolvedValue({ _sum: { montantNetGnf: null }, _count: 0 });
    const t = await tableauDeBord(pharmacien);
    expect(t.chiffreDuJourGnf).toBe(0);
    expect(t.panierMoyenGnf).toBe(0);
  });

  // Une erreur de caisse corrigee ne doit pas gonfler le chiffre d'affaires.
  it('exclut les ventes annulees de tous les agregats', async () => {
    await tableauDeBord(pharmacien);

    for (const appel of [
      prisma.venteComptoir.aggregate.mock.calls[0],
      prisma.venteComptoir.groupBy.mock.calls[0],
    ]) {
      expect(JSON.stringify((appel as [{ where: unknown }])[0].where)).toContain('PAYEE');
    }
    expect(JSON.stringify(prisma.ligneVente.groupBy.mock.calls[0]?.[0])).toContain('PAYEE');
  });

  it('classe les produits les plus vendus sur trente jours', async () => {
    const t = await tableauDeBord(pharmacien);
    expect(t.produitsLesPlusVendus).toEqual([
      { medicament: expect.objectContaining({ libelle: 'Doliprane 500mg' }), quantite: 42, montantGnf: 50400 },
    ]);

    const [args] = prisma.ligneVente.groupBy.mock.calls[0] as [{ where: { vente: { creeLe: { gte: Date } } } }];
    const joursCouverts = Math.round((Date.now() - args.where.vente.creeLe.gte.getTime()) / 86_400_000);
    expect(joursCouverts).toBe(30);
  });

  it('signale les ruptures et les lots a perimer', async () => {
    const t = await tableauDeBord(pharmacien);
    expect(t.ruptures).toEqual([
      { medicament: expect.objectContaining({ libelle: 'Doliprane 500mg' }), quantite: 4, seuilAlerte: 10, unite: 'boite' },
    ]);
    expect(t.lotsAPerimer).toBe(3);
  });

  it('ne compte le jour qu a partir de minuit', async () => {
    await tableauDeBord(pharmacien, new Date('2026-10-02T15:30:00'));
    const [args] = prisma.venteComptoir.aggregate.mock.calls[0] as [{ where: { creeLe: { gte: Date } } }];
    expect(args.where.creeLe.gte.getHours()).toBe(0);
    expect(args.where.creeLe.gte.getMinutes()).toBe(0);
  });
});


// ── Tiers payant au comptoir (EF-09) ─────────────────────────────────
describe('creerVente avec assurance', () => {
  beforeEach(() => {
    prisma.stock.findMany.mockResolvedValue([STOCK_PARA]);
  });

  // On ne couvre pas un passant : sans dossier, il n'y a pas de contrat a
  // opposer a l'assureur.
  it('refuse le tiers payant sans patient', async () => {
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES', avecAssurance: true,
    })).rejects.toThrow(/demande un patient/i);
    expect(chiffrer).not.toHaveBeenCalled();
  });

  // Encaisser le patient a son insu alors qu'il presente une carte serait
  // pire qu'un refus : il croirait etre couvert.
  it('refuse la vente quand aucun contrat n est utilisable', async () => {
    chiffrer.mockResolvedValue(null);
    await expect(creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
      idPatient: 'p-1', avecAssurance: true,
    })).rejects.toThrow(/Aucun contrat/i);
  });

  it('fige la part de l assureur et celle du patient sur la vente', async () => {
    chiffrer.mockResolvedValue({
      idContrat: 'ct-1',
      assureur: { id: 'as-1', nom: 'Pricemou & Frere', code: 'PF' },
      montantAssureGnf: 1_920,
      montantPatientGnf: 480,
      notes: [],
      lignes: [{ idMedicament: 'm-para', libelle: 'Doliprane 500mg', montantGnf: 2_400, couvert: true, tauxAppliquePourcent: 80, montantAssureGnf: 1_920, motifExclusion: null }],
    });

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
      idPatient: 'p-1', avecAssurance: true,
    });

    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        idContratAssurance: 'ct-1',
        montantAssureGnf: 1_920,
        montantPatientGnf: 480,
      }),
    }));
  });

  // « Un reste a charge sans explication se conteste au comptoir. »
  it('fige le detail de couverture sur chaque ligne', async () => {
    chiffrer.mockResolvedValue({
      idContrat: 'ct-1',
      assureur: { id: 'as-1', nom: 'X', code: 'X' },
      montantAssureGnf: 0,
      montantPatientGnf: 2_400,
      notes: [],
      lignes: [{ idMedicament: 'm-para', libelle: 'Doliprane 500mg', montantGnf: 2_400, couvert: false, tauxAppliquePourcent: 0, montantAssureGnf: 0, motifExclusion: 'Categorie MEDICAMENT exclue par l assureur' }],
    });

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
      idPatient: 'p-1', avecAssurance: true,
    });

    expect(prisma.ligneVente.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        couvert: false,
        tauxAppliquePourcent: 0,
        montantAssureGnf: 0,
        motifExclusion: 'Categorie MEDICAMENT exclue par l assureur',
      }),
    }));
  });

  it('chiffre sur le net, remise deduite', async () => {
    chiffrer.mockResolvedValue({
      idContrat: 'ct-1', assureur: { id: 'as-1', nom: 'X', code: 'X' },
      montantAssureGnf: 0, montantPatientGnf: 2_000, notes: [], lignes: [],
    });

    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
      idPatient: 'p-1', avecAssurance: true, remiseGnf: 400,
    });

    const [, , montantNet] = chiffrer.mock.calls[0] as [string, unknown, number];
    expect(montantNet).toBe(2_000);
  });

  it('sans assurance, le patient paie tout et on ne chiffre rien', async () => {
    await creerVente(pharmacien, {
      lignes: [{ idMedicament: 'm-para', quantite: 2 }], modePaiement: 'ESPECES',
    });

    expect(chiffrer).not.toHaveBeenCalled();
    expect(prisma.venteComptoir.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        idContratAssurance: null,
        montantAssureGnf: 0,
        montantPatientGnf: 2_400,
      }),
    }));
  });
});


// ── Le schema de la requete, pas seulement le service ────────────────
//
// Les tests ci-dessus appellent le service directement : ils ne traversent
// pas Zod. Or `creerVenteSchema` est `.strict()`, et un champ oublie la fait
// rejeter en 400 alors que le contrat et le service le portent. C'est arrive
// deux fois le 2026-10-02 — pour `prescription` dans les parametres, puis
// pour `avecAssurance` ici.
describe('schema de creation de vente', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { creerVenteSchema } = require('../src/validators/api.schemas');
  const minimal = { lignes: [{ idMedicament: 'm-1', quantite: 1 }], modePaiement: 'ESPECES' };

  it.each(['numeroOperateur', 'remiseGnf', 'idPatient', 'idOrdonnance', 'avecAssurance'])(
    'accepte le champ optionnel %s',
    (champ) => {
      const valeurs: Record<string, unknown> = {
        numeroOperateur: '620000000', remiseGnf: 100,
        idPatient: 'p-1', idOrdonnance: 'or-1', avecAssurance: true,
      };
      const r = creerVenteSchema.safeParse({ ...minimal, [champ]: valeurs[champ] });
      expect({ champ, ok: r.success }).toEqual({ champ, ok: true });
    }
  );

  it('refuse un champ inconnu : le schema reste strict', () => {
    expect(creerVenteSchema.safeParse({ ...minimal, inconnu: 1 }).success).toBe(false);
  });
});
