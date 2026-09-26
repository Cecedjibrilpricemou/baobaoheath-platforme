// Commande pharmacie (P6 / EF-07) — appel au quartier et attribution.
// Processus : docs/PARCOURS-COMMANDE-LIVRAISON.md
//
// Le point critique est l'attribution. « La première pharmacie qui déclare
// détenir tous les produits prend la commande » n'a de sens que si deux
// pharmacies simultanées donnent un gagnant et un perdant. Toute la mécanique
// repose sur un `updateMany` conditionnel : les tests ci-dessous vérifient
// qu'on ne peut pas passer à côté.
import {
  choisirModeRemise,
  commandesDeLaPharmacie,
  lancerRecherchePharmacie,
  pharmaciesDuQuartier,
  repondreDisponibilite,
  retirerPriseEnCharge,
} from '../src/services/commande.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    structureSante: { findMany: jest.fn() },
    ordonnance: { findUnique: jest.fn() },
    commande: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    reponsePharmacie: { upsert: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({ notifierSansBloquer: jest.fn() }));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: jest.Mock };
    structureSante: { findMany: jest.Mock };
    ordonnance: { findUnique: jest.Mock };
    commande: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    reponsePharmacie: { upsert: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
};
const { prochainNumero } = jest.requireMock('../src/services/numero.service') as { prochainNumero: jest.Mock };
const { notifierSansBloquer } = jest.requireMock('../src/services/notification.service') as { notifierSansBloquer: jest.Mock };

const PHARMACIEN = { userId: 'u-ph', role: 'PHARMACIEN' } as never;
const PATIENT = { userId: 'u-pat', role: 'PATIENT' } as never;

const NOUNIE = {
  id: 'ph-nounie', nom: 'Pharmacie Nounie',
  type: 'PHARMACIE', estActive: true, estPartenaire: true, quartier: 'Kipé',
};

function pharmacienDe(structure: Record<string, unknown> = NOUNIE) {
  prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u-ph', structure });
}

function ordonnanceSignee(etat: Record<string, unknown> = {}) {
  prisma.ordonnance.findUnique.mockResolvedValue({
    id: 'ord-1', numero: 'OR-2026-000001',
    signeLe: new Date('2026-09-20'),
    commande: null,
    lignes: [{ id: 'l1' }],
    consultation: {
      idMedecinValideur: 'u-med',
      patient: { quartier: 'Kipé', utilisateur: { id: 'u-pat' } },
    },
    ...etat,
  });
}

/** La commande telle que `getCommande` la relira en fin d'appel. */
function commandeRelue(etat: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1', numero: 'CM-2026-000001', statut: 'RECHERCHE_PHARMACIE',
    quartierRecherche: 'Kipé', idPharmacie: null, reponses: [],
    ordonnance: { numero: 'OR-2026-000001', signePar: 'u-med', consultation: { idMedecinValideur: 'u-med', patient: { idUtilisateur: 'u-pat' } } },
    ...etat,
  };
}

beforeEach(() => {
  prochainNumero.mockResolvedValue('CM-2026-000001');
  notifierSansBloquer.mockResolvedValue(undefined);
  prisma.commande.create.mockResolvedValue({ id: 'cmd-1', numero: 'CM-2026-000001' });
  prisma.commande.findUnique.mockResolvedValue(commandeRelue());
});
afterEach(() => jest.resetAllMocks());

// ── Périmètre de l'appel ─────────────────────────────────────────────
describe('pharmaciesDuQuartier', () => {
  it('ne retient que les partenaires actives du quartier', async () => {
    prisma.structureSante.findMany.mockResolvedValue([NOUNIE]);

    await pharmaciesDuQuartier('Kipé');

    expect(prisma.structureSante.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: 'PHARMACIE', estActive: true, estPartenaire: true, quartier: 'Kipé' },
    }));
  });

  // Sans quartier, elargir serait deviner : on solliciterait des pharmacies
  // qui n'ont aucune raison d'etre concernees.
  it('ne cherche nulle part quand le patient n a pas de quartier', async () => {
    expect(await pharmaciesDuQuartier(null)).toEqual([]);
    expect(prisma.structureSante.findMany).not.toHaveBeenCalled();
  });
});

// ── Lancement ────────────────────────────────────────────────────────
describe('lancerRecherchePharmacie', () => {
  it('notifie chaque pharmacie partenaire du quartier', async () => {
    ordonnanceSignee();
    prisma.structureSante.findMany.mockResolvedValue([NOUNIE, { id: 'ph-2', nom: 'Pharmacie 2' }]);

    await lancerRecherchePharmacie('ord-1');

    expect(prisma.commande.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: 'RECHERCHE_PHARMACIE', quartierRecherche: 'Kipé' }),
    }));
    const destinataires = notifierSansBloquer.mock.calls.map((c) => c[0].idUtilisateur);
    expect(destinataires).toEqual(expect.arrayContaining(['ph-nounie', 'ph-2']));
  });

  // Une ordonnance non signee n'est pas opposable : elle n'a rien a faire en
  // circulation, et aucune pharmacie ne pourrait la servir.
  it('refuse une ordonnance non signee', async () => {
    ordonnanceSignee({ signeLe: null });

    await expect(lancerRecherchePharmacie('ord-1')).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.commande.create).not.toHaveBeenCalled();
  });

  it('refuse une seconde commande sur la meme ordonnance', async () => {
    ordonnanceSignee({ commande: { id: 'cmd-existante' } });

    await expect(lancerRecherchePharmacie('ord-1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('404 sur une ordonnance inconnue', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue(null);
    await expect(lancerRecherchePharmacie('ord-x')).rejects.toBeInstanceOf(NotFoundError);
  });

  // Aucune partenaire dans le quartier : il n'y a personne a interroger. Le
  // resultat est le meme que si nul n'avait repondu.
  it('conclut sans pharmacie quand le quartier n en compte aucune', async () => {
    ordonnanceSignee();
    prisma.structureSante.findMany.mockResolvedValue([]);

    await lancerRecherchePharmacie('ord-1');

    expect(prisma.commande.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statut: 'SANS_PHARMACIE' }),
    }));
    const types = notifierSansBloquer.mock.calls.map((c) => c[0].type);
    expect(types).toContain('COMMANDE_SANS_PHARMACIE');
  });
});

// ── Attribution — le cœur du dispositif ──────────────────────────────
describe('repondreDisponibilite', () => {
  beforeEach(() => {
    pharmacienDe();
    prisma.structureSante.findMany.mockResolvedValue([NOUNIE]);
    prisma.reponsePharmacie.upsert.mockResolvedValue({});
  });

  it('attribue la commande a celle qui declare tout avoir', async () => {
    prisma.commande.updateMany.mockResolvedValue({ count: 1 });

    await repondreDisponibilite(PHARMACIEN, 'cmd-1', true);

    expect(prisma.commande.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      // Le verrou : on ne prend que si personne ne l'a prise.
      where: { id: 'cmd-1', idPharmacie: null, statut: 'RECHERCHE_PHARMACIE' },
    }));
    const types = notifierSansBloquer.mock.calls.map((c) => c[0].type);
    expect(types).toContain('COMMANDE_PRISE_EN_CHARGE');
  });

  // Le cas qui justifie tout le dispositif : deux pharmacies a la meme
  // seconde. `updateMany` ne touche rien pour la seconde — count vaut 0.
  it('refuse la seconde pharmacie quand une autre a ete plus rapide', async () => {
    prisma.commande.updateMany.mockResolvedValue({ count: 0 });

    await expect(repondreDisponibilite(PHARMACIEN, 'cmd-1', true)).rejects.toBeInstanceOf(ConflictError);
    const types = notifierSansBloquer.mock.calls.map((c) => c[0].type);
    expect(types).not.toContain('COMMANDE_PRISE_EN_CHARGE');
  });

  it('refuse d emblee si la commande est deja prise par une autre', async () => {
    prisma.commande.findUnique.mockResolvedValue(commandeRelue({ idPharmacie: 'ph-autre' }));

    await expect(repondreDisponibilite(PHARMACIEN, 'cmd-1', true)).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.commande.updateMany).not.toHaveBeenCalled();
  });

  it('enregistre un refus sans rien attribuer', async () => {
    await repondreDisponibilite(PHARMACIEN, 'cmd-1', false);

    expect(prisma.reponsePharmacie.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { idCommande: 'cmd-1', idStructure: 'ph-nounie', aTousLesProduits: false },
    }));
    expect(prisma.commande.updateMany).not.toHaveBeenCalled();
  });

  // Quand toutes les sollicitees ont refuse, il n'y a plus rien a attendre.
  it('conclut sans pharmacie quand toutes ont refuse', async () => {
    prisma.commande.findUnique.mockResolvedValue(
      commandeRelue({ reponses: [{ aTousLesProduits: false }] })
    );

    await repondreDisponibilite(PHARMACIEN, 'cmd-1', false);

    expect(prisma.commande.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { statut: 'SANS_PHARMACIE' },
    }));
  });

  it('attend encore si une sollicitee n a pas repondu', async () => {
    prisma.structureSante.findMany.mockResolvedValue([NOUNIE, { id: 'ph-2', nom: 'Pharmacie 2' }]);
    prisma.commande.findUnique.mockResolvedValue(
      commandeRelue({ reponses: [{ aTousLesProduits: false }] })
    );

    await repondreDisponibilite(PHARMACIEN, 'cmd-1', false);

    expect(prisma.commande.update).not.toHaveBeenCalled();
  });

  // ── Habilitation ──────────────────────────────────────────────────

  it('refuse une pharmacie d un autre quartier', async () => {
    pharmacienDe({ ...NOUNIE, quartier: 'Matoto' });

    await expect(repondreDisponibilite(PHARMACIEN, 'cmd-1', true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // Seules les conventionnees sont sollicitees : repondre suppose l'etre.
  it('refuse une pharmacie non partenaire', async () => {
    pharmacienDe({ ...NOUNIE, estPartenaire: false });

    await expect(repondreDisponibilite(PHARMACIEN, 'cmd-1', true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse un compte qui n est pas rattache a une pharmacie', async () => {
    pharmacienDe({ ...NOUNIE, type: 'CENTRE' });

    await expect(repondreDisponibilite(PHARMACIEN, 'cmd-1', true)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── Rétractation ─────────────────────────────────────────────────────
describe('retirerPriseEnCharge', () => {
  beforeEach(() => {
    pharmacienDe();
    prisma.structureSante.findMany.mockResolvedValue([NOUNIE]);
    prisma.$transaction.mockResolvedValue([]);
  });

  it('rouvre le verrou pour les autres pharmacies', async () => {
    prisma.commande.findUnique.mockResolvedValue(
      commandeRelue({ idPharmacie: 'ph-nounie', statut: 'PRISE_EN_CHARGE' })
    );

    await retirerPriseEnCharge(PHARMACIEN, 'cmd-1', 'Rupture de stock constatee');

    expect(prisma.commande.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { idPharmacie: null, priseEnChargeLe: null, statut: 'RECHERCHE_PHARMACIE' },
    }));
  });

  it('refuse a une pharmacie qui n a pas la commande', async () => {
    prisma.commande.findUnique.mockResolvedValue(
      commandeRelue({ idPharmacie: 'ph-autre', statut: 'PRISE_EN_CHARGE' })
    );

    await expect(retirerPriseEnCharge(PHARMACIEN, 'cmd-1', 'motif valable')).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ── Mode de remise ───────────────────────────────────────────────────
describe('choisirModeRemise', () => {
  it('laisse le patient choisir le retrait', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...commandeRelue({ statut: 'PRISE_EN_CHARGE' }),
      ordonnance: { consultation: { patient: { idUtilisateur: 'u-pat' } } },
    });

    await choisirModeRemise(PATIENT, 'cmd-1', 'RETRAIT_PHARMACIE' as never);

    expect(prisma.commande.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { modeRemise: 'RETRAIT_PHARMACIE' },
    }));
  });

  // Le mode de remise est une decision personnelle : personne d'autre ne la
  // prend a la place du patient.
  it('refuse a quelqu un d autre que le patient', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...commandeRelue({ statut: 'PRISE_EN_CHARGE' }),
      ordonnance: { consultation: { patient: { idUtilisateur: 'un-autre' } } },
    });

    await expect(choisirModeRemise(PATIENT, 'cmd-1', 'LIVRAISON' as never)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse tant qu aucune pharmacie n a pris la commande', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...commandeRelue({ statut: 'RECHERCHE_PHARMACIE' }),
      ordonnance: { consultation: { patient: { idUtilisateur: 'u-pat' } } },
    });

    await expect(choisirModeRemise(PATIENT, 'cmd-1', 'LIVRAISON' as never)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── File du comptoir ─────────────────────────────────────────────────
describe('commandesDeLaPharmacie', () => {
  it('montre les appels du quartier non refuses, et ce qu elle a pris', async () => {
    pharmacienDe();
    prisma.commande.findMany.mockResolvedValue([]);

    await commandesDeLaPharmacie(PHARMACIEN);

    const { where } = prisma.commande.findMany.mock.calls[0][0];
    expect(where.OR[0]).toEqual(expect.objectContaining({
      statut: 'RECHERCHE_PHARMACIE',
      quartierRecherche: 'Kipé',
      // Une pharmacie qui a deja dit non ne doit pas revoir l'appel.
      reponses: { none: { idStructure: 'ph-nounie', aTousLesProduits: false } },
    }));
    expect(where.OR[1]).toEqual({ idPharmacie: 'ph-nounie' });
  });
});
