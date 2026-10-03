// Suspendre et reactiver un compte (EF-12-01).
//
// « Immediate » est le mot du cahier des charges, et il engage trois portes :
// le compte ferme, les sessions supprimees, les connexions temps reel
// coupees. Le troisieme point etait un trou — un socket n'est authentifie
// qu'a la poignee de main, donc un compte suspendu continuait de recevoir les
// notifications de ses patients alors que la moindre requete HTTP lui etait
// refusee.
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    session: { deleteMany: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/realtime/socket.server', () => ({ deconnecterUtilisateur: jest.fn() }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M; findMany: M; count: M; updateMany: M };
    session: { deleteMany: M };
  };
};
const { deconnecterUtilisateur } = jest.requireMock('../src/realtime/socket.server') as {
  deconnecterUtilisateur: M;
};

import { motifDeRefus, reactiver, suspendre } from '../src/services/compte.service';

const ADMIN = { userId: 'admin-1', role: 'SUPER_ADMIN' as const };
const NATIONAL = { userId: 'nat-1', role: 'ADMIN_NATIONAL' as const };
const MOTIF = 'Acces repetes a des dossiers hors de son service';

const CIBLE = { id: 'u-1', role: 'MEDECIN' as const, estActif: true, prenom: 'David', nom: 'Camara' };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue(CIBLE);
  prisma.utilisateur.count.mockResolvedValue(3);
  prisma.utilisateur.updateMany.mockResolvedValue({ count: 1 });
  prisma.session.deleteMany.mockResolvedValue({ count: 2 });
  deconnecterUtilisateur.mockResolvedValue(1);
});

// ── Les garde-fous, eprouves sans base ───────────────────────────────

describe('motifDeRefus', () => {
  it('laisse passer une suspension ordinaire', () => {
    expect(motifDeRefus(ADMIN, CIBLE, 3)).toBeNull();
  });

  // Se suspendre soi-meme enferme dehors immediatement, et personne ne peut
  // forcement rouvrir.
  it('refuse de se suspendre soi-meme', () => {
    expect(motifDeRefus(ADMIN, { ...CIBLE, id: ADMIN.userId }, 3)).toMatch(/votre propre compte/);
  });

  it('refuse un compte deja ferme', () => {
    expect(motifDeRefus(ADMIN, { ...CIBLE, estActif: false }, 3)).toMatch(/deja ferme/);
  });

  // La hierarchie ne s'inverse pas.
  it('refuse qu un admin national suspende un super administrateur', () => {
    expect(motifDeRefus(NATIONAL, { ...CIBLE, role: 'SUPER_ADMIN' }, 3))
      .toMatch(/super administrateur/);
  });

  it('autorise un super administrateur a en suspendre un autre', () => {
    expect(motifDeRefus(ADMIN, { ...CIBLE, role: 'SUPER_ADMIN' }, 2)).toBeNull();
  });

  // **Le garde-fou qui compte.** La base de demonstration ne porte qu'un seul
  // SUPER_ADMIN actif : le suspendre laisserait la plateforme sans
  // administration, sans moyen de revenir en arriere.
  it('refuse de suspendre le dernier super administrateur actif', () => {
    expect(motifDeRefus(ADMIN, { ...CIBLE, role: 'SUPER_ADMIN' }, 0))
      .toMatch(/dernier super administrateur/);
  });

  it('ne compte les autres administrateurs que pour un super administrateur', () => {
    // Un medecin peut etre suspendu meme s'il est le dernier de son role.
    expect(motifDeRefus(ADMIN, CIBLE, 0)).toBeNull();
  });
});

// ── Le motif ─────────────────────────────────────────────────────────

describe('suspendre : le motif', () => {
  it.each(['', '   ', 'non', 'rgpd', 'abus'])('refuse le motif « %s »', async (motif) => {
    await expect(suspendre(ADMIN, 'u-1', motif)).rejects.toThrow(ValidationError);
  });

  it('dit pourquoi un motif court est refuse', async () => {
    await expect(suspendre(ADMIN, 'u-1', 'abus')).rejects.toThrow(/contestee/);
  });

  it('nettoie les espaces de bord avant d enregistrer', async () => {
    await suspendre(ADMIN, 'u-1', `   ${MOTIF}   `);
    const [args] = prisma.utilisateur.updateMany.mock.calls[0] as [{ data: { motifSuspension: string } }];
    expect(args.data.motifSuspension).toBe(MOTIF);
  });

  it('ne lit rien en base quand le motif est refuse', async () => {
    await expect(suspendre(ADMIN, 'u-1', 'non')).rejects.toThrow();
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });
});

// ── Les trois portes ─────────────────────────────────────────────────

describe('suspendre : ce qui est reellement coupe', () => {
  it('ferme le compte et enregistre qui, quand et pourquoi', async () => {
    await suspendre(ADMIN, 'u-1', MOTIF);
    const [args] = prisma.utilisateur.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> }
    ];
    expect(args.data).toMatchObject({
      estActif: false,
      motifSuspension: MOTIF,
      idSuspenduPar: ADMIN.userId,
    });
    expect(args.data['suspenduLe']).toBeInstanceOf(Date);
  });

  it('supprime les sessions, qui tiendraient sinon jusqu a leur expiration', async () => {
    const vue = await suspendre(ADMIN, 'u-1', MOTIF);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { idUtilisateur: 'u-1' } });
    expect(vue.sessionsFermees).toBe(2);
  });

  // Le trou que ce bloc comble : sans cela, le compte suspendu continuait de
  // recevoir les notifications de ses patients.
  it('coupe les connexions temps reel, en donnant le motif', async () => {
    const vue = await suspendre(ADMIN, 'u-1', MOTIF);
    expect(deconnecterUtilisateur).toHaveBeenCalledWith('u-1', MOTIF);
    expect(vue.socketsFermes).toBe(1);
  });

  // Le compte est deja ferme en base, et chaque requete HTTP le verifie :
  // une panne du temps reel ne doit pas annuler la mesure.
  it('reste effective si la fermeture des sockets echoue', async () => {
    deconnecterUtilisateur.mockRejectedValue(new Error('socket.io absent'));
    const vue = await suspendre(ADMIN, 'u-1', MOTIF);
    expect(vue.estActif).toBe(false);
    expect(vue.socketsFermes).toBe(0);
  });

  it('ferme le compte avant de couper, pour qu une reconnexion soit refusee', async () => {
    const ordre: string[] = [];
    prisma.utilisateur.updateMany.mockImplementation(async () => { ordre.push('compte'); return { count: 1 }; });
    prisma.session.deleteMany.mockImplementation(async () => { ordre.push('sessions'); return { count: 0 }; });
    deconnecterUtilisateur.mockImplementation(async () => { ordre.push('sockets'); return 0; });
    await suspendre(ADMIN, 'u-1', MOTIF);
    expect(ordre).toEqual(['compte', 'sessions', 'sockets']);
  });
});

// ── La concurrence ───────────────────────────────────────────────────

describe('suspendre : deux administrateurs a la fois', () => {
  // La reclamation est conditionnelle : `estActif: true` dans le `where`.
  // Deux suspensions simultanees ne doivent pas produire deux traces
  // contradictoires.
  it('ne reclame le compte que s il est encore actif', async () => {
    await suspendre(ADMIN, 'u-1', MOTIF);
    const [args] = prisma.utilisateur.updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toEqual({ id: 'u-1', estActif: true });
  });

  it('refuse quand quelqu un est passe avant', async () => {
    prisma.utilisateur.updateMany.mockResolvedValue({ count: 0 });
    await expect(suspendre(ADMIN, 'u-1', MOTIF)).rejects.toThrow(/quelqu un d autre/);
  });

  it('ne coupe rien quand la reclamation a echoue', async () => {
    prisma.utilisateur.updateMany.mockResolvedValue({ count: 0 });
    await expect(suspendre(ADMIN, 'u-1', MOTIF)).rejects.toThrow();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(deconnecterUtilisateur).not.toHaveBeenCalled();
  });
});

describe('suspendre : le compte vise', () => {
  it('refuse un compte inconnu', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);
    await expect(suspendre(ADMIN, 'inconnu', MOTIF)).rejects.toThrow(NotFoundError);
  });

  it('compte les autres super administrateurs actifs avant de trancher', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ ...CIBLE, role: 'SUPER_ADMIN' });
    prisma.utilisateur.count.mockResolvedValue(0);
    await expect(suspendre(ADMIN, 'u-1', MOTIF)).rejects.toThrow(ForbiddenError);
    expect(prisma.utilisateur.count).toHaveBeenCalledWith({
      where: { role: 'SUPER_ADMIN', estActif: true, id: { not: 'u-1' } },
    });
  });

  // Une requete de comptage par compte suspendu serait du gaspillage : le cas
  // ne concerne que les super administrateurs.
  it('ne compte pas les administrateurs pour un role ordinaire', async () => {
    await suspendre(ADMIN, 'u-1', MOTIF);
    expect(prisma.utilisateur.count).not.toHaveBeenCalled();
  });
});

// ── La reactivation ──────────────────────────────────────────────────

describe('reactiver', () => {
  const FERME = { ...CIBLE, estActif: false };

  it('rouvre le compte et efface la suspension de la fiche', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(FERME);
    await reactiver(ADMIN, 'u-1');
    const [args] = prisma.utilisateur.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({
      estActif: true, suspenduLe: null, motifSuspension: null, idSuspenduPar: null,
    });
  });

  it('refuse un compte deja actif', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(CIBLE);
    await expect(reactiver(ADMIN, 'u-1')).rejects.toThrow(/deja actif/);
  });

  it('refuse qu un admin national reactive un super administrateur', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ ...FERME, role: 'SUPER_ADMIN' });
    await expect(reactiver(NATIONAL, 'u-1')).rejects.toThrow(ForbiddenError);
  });

  it('refuse un compte inconnu', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(null);
    await expect(reactiver(ADMIN, 'inconnu')).rejects.toThrow(NotFoundError);
  });

  it('ne rouvre que si le compte est encore ferme', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue(FERME);
    await reactiver(ADMIN, 'u-1');
    const [args] = prisma.utilisateur.updateMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toEqual({ id: 'u-1', estActif: false });
  });
});
