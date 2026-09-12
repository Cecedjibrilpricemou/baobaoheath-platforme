import {
  creerNotification,
  notifierSansBloquer,
  getMesNotifications,
  compterNonLues,
  marquerLue,
  toutMarquerLu,
} from '../src/services/notification.service';
import { NotFoundError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../src/realtime/socket.server', () => ({
  emitToUser: jest.fn(),
}));

jest.mock('../src/config/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    notification: {
      create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock;
      count: jest.Mock; update: jest.Mock; updateMany: jest.Mock;
    };
  };
};
const { emitToUser } = jest.requireMock('../src/realtime/socket.server') as { emitToUser: jest.Mock };
const { logger } = jest.requireMock('../src/config/logger') as { logger: { warn: jest.Mock } };

const creeLe = new Date('2026-09-12T08:00:00Z');
const ligne = {
  id: 'n1',
  type: 'NOUVEAU_MESSAGE',
  titre: 'Nouveau message',
  contenu: 'Bonjour',
  lienAction: '/medecin/messagerie',
  metadonnees: { idMessage: 'm1' },
  luLe: null,
  creeLe,
};

afterEach(() => jest.resetAllMocks());

describe('creerNotification', () => {
  it('persiste la notification puis la pousse sur la room de l utilisateur', async () => {
    prisma.notification.create.mockResolvedValue(ligne);

    const vue = await creerNotification({
      idUtilisateur: 'u1',
      type: 'NOUVEAU_MESSAGE',
      titre: 'Nouveau message',
      contenu: 'Bonjour',
      lienAction: '/medecin/messagerie',
      metadonnees: { idMessage: 'm1' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idUtilisateur: 'u1', type: 'NOUVEAU_MESSAGE' }),
    }));
    expect(emitToUser).toHaveBeenCalledWith('u1', 'notification:new', vue);
    expect(vue).toEqual(ligne);
  });

  it('normalise metadonnees absentes en null (contrat NotificationView)', async () => {
    prisma.notification.create.mockResolvedValue({ ...ligne, metadonnees: undefined });

    const vue = await creerNotification({
      idUtilisateur: 'u1', type: 'ALERTE_STOCK', titre: 't', contenu: 'c',
    });

    expect(vue.metadonnees).toBeNull();
  });
});

describe('notifierSansBloquer', () => {
  it('journalise l echec sans le propager', async () => {
    prisma.notification.create.mockRejectedValue(new Error('db down'));

    await expect(notifierSansBloquer({
      idUtilisateur: 'u1', type: 'ORDONNANCE_SIGNEE', titre: 't', contenu: 'c',
    })).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[NOTIF]'),
      expect.objectContaining({ erreur: 'db down', idUtilisateur: 'u1' }),
    );
    expect(emitToUser).not.toHaveBeenCalled();
  });
});

describe('getMesNotifications', () => {
  it('pagine et filtre sur l utilisateur connecte uniquement', async () => {
    prisma.notification.findMany.mockResolvedValue([ligne]);
    prisma.notification.count.mockResolvedValue(21);

    const page = await getMesNotifications('u1', { page: 2, limit: 20 });

    const where = { idUtilisateur: 'u1' };
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 20, take: 20, orderBy: { creeLe: 'desc' },
    }));
    expect(prisma.notification.count).toHaveBeenCalledWith({ where });
    expect(page).toEqual({ items: [ligne], total: 21, page: 2, limit: 20, totalPages: 2 });
  });

  it('traduit lu=false en luLe: null et lu=true en luLe non nul', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);

    await getMesNotifications('u1', { lu: false });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { idUtilisateur: 'u1', luLe: null },
    }));

    await getMesNotifications('u1', { lu: true });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { idUtilisateur: 'u1', luLe: { not: null } },
    }));
  });
});

describe('compterNonLues', () => {
  it('compte les notifications sans luLe de l utilisateur', async () => {
    prisma.notification.count.mockResolvedValue(3);
    await expect(compterNonLues('u1')).resolves.toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { idUtilisateur: 'u1', luLe: null } });
  });
});

describe('marquerLue', () => {
  it('refuse (404) une notification qui n appartient pas a l utilisateur', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(marquerLue('u2', 'n1')).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'n1', idUtilisateur: 'u2' },
    }));
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('ne modifie pas luLe d une notification deja lue (idempotent)', async () => {
    const dejaLue = new Date('2026-09-10T00:00:00Z');
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1', luLe: dejaLue });
    prisma.notification.update.mockResolvedValue({ ...ligne, luLe: dejaLue });

    await marquerLue('u1', 'n1');

    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { luLe: dejaLue },
    }));
  });
});

describe('toutMarquerLu', () => {
  it('ne touche que les non-lues de l utilisateur et retourne le nombre', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(toutMarquerLu('u1')).resolves.toBe(4);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { idUtilisateur: 'u1', luLe: null },
      data: { luLe: expect.any(Date) },
    });
  });
});
