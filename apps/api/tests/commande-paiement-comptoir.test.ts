// Payer le panier d'une commande — par la passerelle, ou au comptoir.
//
// **Deux chemins menent a une facture payee**, et seul le premier etait
// branche. `appliquerStatutPasserelle` recevait les rappels de la passerelle
// et faisait avancer la commande ; `confirmerPaiement` ecrivait `PAYEE`
// directement, sans rien faire avancer. Une commande reglee en especes serait
// donc restee bloquee a « a payer » pour toujours, alors que l'argent etait
// dans le tiroir. En Guinee les especes sont le moyen dominant : ce n'etait
// pas un cas de bord, c'etait le cas courant.
//
// Et son controle d'acces ne regardait que `consultation.asc.idStructure` :
// pour une facture de commande il valait `undefined`, donc la comparaison
// echouait toujours et **personne hors administration** ne pouvait encaisser.
import {
  confirmerPaiement,
  encaisserCommandeAuComptoir,
  initierPaiementCommande,
} from '../src/services/paiement.service';
import { ForbiddenError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    commande: { findUnique: jest.fn(), update: jest.fn() },
    facture: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    utilisateur: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/payment-provider.service', () => ({
  initierPaiementSimule: jest.fn().mockResolvedValue({ referenceOperateur: 'SIM-1' }),
}));
// Les trois moyens actifs : `assertModePaiementActif` les lit ici, et un
// objet vide le faisait planter sur `facturation.paiementEspeces`.
jest.mock('../src/services/parametres.service', () => ({
  getValeursParametres: jest.fn().mockResolvedValue({
    facturation: { paiementEspeces: true, paiementOrangeMoney: true, paiementMomo: true },
  }),
}));
jest.mock('../src/services/notification.service', () => ({ notifierSansBloquer: jest.fn() }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
// La passerelle declaree absente : ces tests portent sur le comptoir.
jest.mock('../src/services/chapchap.service', () => ({
  chapchapEstConfigure: () => false,
  creerOperation: jest.fn(),
  lireOperation: jest.fn(),
  estPaye: (s: string) => s === 'success',
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    commande: { findUnique: M; update: M };
    facture: { findUnique: M; create: M; update: M };
    utilisateur: { findUnique: M; findMany: M };
  };
};

const qui = (userId: string, role: string) => ({ userId, role, sessionId: 's' }) as never;

const COMMANDE = {
  id: 'c1',
  statut: 'A_PAYER',
  montantTotalGnf: 5400,
  numero: 'CM-1',
  idPharmacie: 'ph1',
  facture: null as { id: string; statut: string } | null,
  ordonnance: {
    numero: 'ORD-1',
    signePar: 'u-med',
    consultation: { idMedecinValideur: 'u-med', patient: { id: 'p1', idUtilisateur: 'u-pat' } },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.utilisateur.findMany.mockResolvedValue([]);
  prisma.facture.update.mockResolvedValue({ id: 'f1' });
  prisma.commande.update.mockResolvedValue({});
});

describe('ouvrir le paiement d une commande', () => {
  it('prend le montant en base, jamais celui du client', async () => {
    prisma.commande.findUnique.mockResolvedValue(COMMANDE);
    prisma.facture.create.mockResolvedValue({ id: 'f1', montantGnf: 5400 });

    await initierPaiementCommande('u-pat', 'c1', { modePaiement: 'ESPECES' } as never);

    const cree = prisma.facture.create.mock.calls[0]?.[0] as {
      data: { montantGnf: number; idCommande: string };
    };
    expect(cree.data.montantGnf).toBe(5400);
    expect(cree.data.idCommande).toBe('c1');
  });

  it('refuse le paiement d une commande qui n est pas la sienne', async () => {
    prisma.commande.findUnique.mockResolvedValue(COMMANDE);
    await expect(initierPaiementCommande('un-autre', 'c1', { modePaiement: 'ESPECES' } as never))
      .rejects.toThrow(ForbiddenError);
  });

  it('refuse tant que la pharmacie n a pas chiffre', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      ...COMMANDE, statut: 'PRISE_EN_CHARGE', montantTotalGnf: null,
    });
    await expect(initierPaiementCommande('u-pat', 'c1', { modePaiement: 'ESPECES' } as never))
      .rejects.toThrow(ValidationError);
  });
});

describe('confirmer un paiement au guichet', () => {
  // **Le defaut qui bloquait tout.** Pour une facture de commande,
  // `consultation` est nul : le controle comparait `idStructure` a
  // `undefined`, donc il refusait meme la pharmacie qui tient la commande.
  it('laisse la pharmacie qui tient la commande encaisser', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'f1', statut: 'EN_ATTENTE', idCommande: 'c1',
      consultation: null, commande: { idPharmacie: 'ph1' },
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'ph1' });
    prisma.commande.findUnique.mockResolvedValue({ id: 'c1', statut: 'A_PAYER', numero: 'CM-1' });

    await confirmerPaiement(qui('u-ph', 'PHARMACIEN'), 'f1', { referenceOperateur: 'RECU-12' } as never);

    const maj = prisma.facture.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('PAYEE');
  });

  it('refuse une autre pharmacie que celle qui tient la commande', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'f1', statut: 'EN_ATTENTE', idCommande: 'c1',
      consultation: null, commande: { idPharmacie: 'ph1' },
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'une-autre' });

    await expect(
      confirmerPaiement(qui('u-ph', 'PHARMACIEN'), 'f1', { referenceOperateur: 'RECU-12' } as never),
    ).rejects.toThrow(ForbiddenError);
  });

  // **Le second defaut.** `confirmerPaiement` ecrivait `PAYEE` sans rien
  // faire avancer : la commande restait a « a payer », l'argent dans le
  // tiroir, et personne ne pouvait preparer.
  it('fait avancer la commande, comme le ferait la passerelle', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'f1', statut: 'EN_ATTENTE', idCommande: 'c1',
      consultation: null, commande: { idPharmacie: 'ph1' },
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'ph1' });
    prisma.commande.findUnique.mockResolvedValue({
      id: 'c1', statut: 'A_PAYER', numero: 'CM-1',
      ordonnance: COMMANDE.ordonnance,
    });

    await confirmerPaiement(qui('u-ph', 'PHARMACIEN'), 'f1', { referenceOperateur: 'RECU-12' } as never);

    const maj = prisma.commande.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('PAYEE');
  });

  // Une facture de consultation garde son ancien controle : c'est la
  // structure de l'agent qui a fait la consultation.
  it('garde le controle par structure pour une facture de consultation', async () => {
    prisma.facture.findUnique.mockResolvedValue({
      id: 'f2', statut: 'EN_ATTENTE', idCommande: null,
      consultation: { asc: { idStructure: 'hop1' } }, commande: null,
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'hop1' });

    await confirmerPaiement(qui('u-ag', 'ADMIN_STRUCTURE'), 'f2', { referenceOperateur: 'R-1' } as never);
    expect(prisma.facture.update).toHaveBeenCalled();
    // Aucune commande a faire avancer : la facture n'en porte pas.
    expect(prisma.commande.update).not.toHaveBeenCalled();
  });
});

describe('encaisser depuis la commande', () => {
  it('retrouve la facture par la commande : l officine ne manipule aucun identifiant', async () => {
    prisma.commande.findUnique
      .mockResolvedValueOnce({ id: 'c1', idPharmacie: 'ph1', facture: { id: 'f1', statut: 'EN_ATTENTE' } })
      .mockResolvedValue({ id: 'c1', statut: 'A_PAYER', numero: 'CM-1', ordonnance: COMMANDE.ordonnance });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'ph1' });
    prisma.facture.findUnique.mockResolvedValue({
      id: 'f1', statut: 'EN_ATTENTE', idCommande: 'c1',
      consultation: null, commande: { idPharmacie: 'ph1' },
    });

    await encaisserCommandeAuComptoir(qui('u-ph', 'PHARMACIEN'), 'c1', 'RECU-77');
    expect(prisma.facture.update).toHaveBeenCalled();
  });

  it('refuse une commande qui n est pas la sienne', async () => {
    prisma.commande.findUnique.mockResolvedValue({
      id: 'c1', idPharmacie: 'ph1', facture: { id: 'f1', statut: 'EN_ATTENTE' },
    });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'une-autre' });
    await expect(encaisserCommandeAuComptoir(qui('u-ph', 'PHARMACIEN'), 'c1', 'RECU-77'))
      .rejects.toThrow(ForbiddenError);
  });

  // Le patient n'a pas ouvert son paiement : il n'y a rien a encaisser, et le
  // dire vaut mieux que de creer une facture dans son dos.
  it('refuse quand aucune facture n existe encore', async () => {
    prisma.commande.findUnique.mockResolvedValue({ id: 'c1', idPharmacie: 'ph1', facture: null });
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'ph1' });
    await expect(encaisserCommandeAuComptoir(qui('u-ph', 'PHARMACIEN'), 'c1', 'RECU-77'))
      .rejects.toThrow(ValidationError);
  });
});
