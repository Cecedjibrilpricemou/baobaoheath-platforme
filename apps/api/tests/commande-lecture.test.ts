// Qui peut lire une commande (P6 / EF-07).
//
// **`GET /commandes/:id` n'avait aucun contrôle.** Ni rôle, ni propriété :
// n'importe quel compte connecté pouvait lire la commande d'un inconnu, avec
// son nom et la liste de ses médicaments. Le défaut datait de la mise en
// place de la route, le 2026-09-26, et rien ne le signalait — il faut
// connaître un identifiant pour l'exploiter, mais un identifiant circule.
//
// Quatre lectures sont légitimes, et seulement quatre.
import { assertPeutLireCommande } from '../src/services/commande.service';
import { ForbiddenError, NotFoundError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    commande: { findUnique: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({ notifierSansBloquer: jest.fn() }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { commande: { findUnique: M }; utilisateur: { findUnique: M } };
};

const COMMANDE = {
  idPharmacie: 'ph-gagnante',
  quartierRecherche: 'Donka',
  statut: 'PRISE_EN_CHARGE',
  ordonnance: {
    signePar: 'u-med',
    consultation: {
      idMedecinValideur: 'u-med',
      patient: { idUtilisateur: 'u-pat' },
    },
  },
};

const qui = (userId: string, role: string) => ({ userId, role, sessionId: 's' }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.commande.findUnique.mockResolvedValue(COMMANDE);
  prisma.utilisateur.findUnique.mockResolvedValue(null);
});

describe('assertPeutLireCommande', () => {
  it('laisse passer le patient concerne', async () => {
    await expect(assertPeutLireCommande(qui('u-pat', 'PATIENT'), 'c-1')).resolves.toBeUndefined();
  });

  it('laisse passer le prescripteur', async () => {
    await expect(assertPeutLireCommande(qui('u-med', 'MEDECIN'), 'c-1')).resolves.toBeUndefined();
  });

  it('laisse passer la pharmacie qui l a prise', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-gagnante',
      structure: { type: 'PHARMACIE', quartier: 'Donka', estPartenaire: true },
    });
    await expect(assertPeutLireCommande(qui('u-ph', 'PHARMACIEN'), 'c-1')).resolves.toBeUndefined();
  });

  it.each(['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN'])(
    'laisse passer %s sans meme lire la commande', async (role) => {
      await expect(assertPeutLireCommande(qui('u-adm', role), 'c-1')).resolves.toBeUndefined();
      expect(prisma.commande.findUnique).not.toHaveBeenCalled();
    });

  // **Le defaut exact.** Un patient qui connaît un identifiant lisait le
  // dossier d'un autre.
  it('refuse un autre patient', async () => {
    await expect(assertPeutLireCommande(qui('u-intrus', 'PATIENT'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse un medecin qui n a ni prescrit ni valide', async () => {
    await expect(assertPeutLireCommande(qui('u-autre-med', 'MEDECIN'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse une pharmacie qui n a pas pris la commande', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-perdante',
      structure: { type: 'PHARMACIE', quartier: 'Donka', estPartenaire: true },
    });
    await expect(assertPeutLireCommande(qui('u-ph2', 'PHARMACIEN'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  // Tant que l'appel court, toute partenaire du quartier doit lire ce qu'on
  // lui demande de servir — c'est le sens meme de l'appel.
  it('laisse passer une partenaire du quartier pendant l appel', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...COMMANDE, idPharmacie: null, statut: 'RECHERCHE_PHARMACIE',
    });
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-voisine',
      structure: { type: 'PHARMACIE', quartier: 'Donka', estPartenaire: true },
    });
    await expect(assertPeutLireCommande(qui('u-ph3', 'PHARMACIEN'), 'c-1')).resolves.toBeUndefined();
  });

  it('refuse une partenaire d un autre quartier', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...COMMANDE, idPharmacie: null, statut: 'RECHERCHE_PHARMACIE',
    });
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-loin',
      structure: { type: 'PHARMACIE', quartier: 'Kipé', estPartenaire: true },
    });
    await expect(assertPeutLireCommande(qui('u-ph4', 'PHARMACIEN'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  // Une officine non partenaire n'est jamais sollicitee : elle n'a rien a
  // lire, meme dans le bon quartier.
  it('refuse une officine non partenaire du bon quartier', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...COMMANDE, idPharmacie: null, statut: 'RECHERCHE_PHARMACIE',
    });
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-hors',
      structure: { type: 'PHARMACIE', quartier: 'Donka', estPartenaire: false },
    });
    await expect(assertPeutLireCommande(qui('u-ph5', 'PHARMACIEN'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  // L'appel est clos : seule celle qui l'a prise lit encore.
  it('refuse une voisine une fois la commande attribuee', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'ph-voisine',
      structure: { type: 'PHARMACIE', quartier: 'Donka', estPartenaire: true },
    });
    await expect(assertPeutLireCommande(qui('u-ph6', 'PHARMACIEN'), 'c-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse un laborantin, un accueil, un livreur', async () => {
    for (const role of ['TECHNICIEN_LABO', 'AGENT_ACCUEIL', 'LIVREUR']) {
      prisma.utilisateur.findUnique.mockResolvedValue({
        idStructure: 's-x', structure: { type: 'CHU', quartier: 'Donka', estPartenaire: false },
      });
      await expect(assertPeutLireCommande(qui('u-x', role), 'c-1'))
        .rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it('404 sur une commande inconnue', async () => {
    prisma.commande.findUnique.mockResolvedValue(null);
    await expect(assertPeutLireCommande(qui('u-pat', 'PATIENT'), 'fantome'))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
