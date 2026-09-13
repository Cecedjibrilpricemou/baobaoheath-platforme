import { repondreReferencement } from '../src/services/medecin.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    referencement: { findUnique: jest.fn(), update: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
  },
}));

jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/realtime/socket.server', () => ({ emitToUser: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    referencement: { findUnique: jest.Mock; update: jest.Mock };
    utilisateur: { findUnique: jest.Mock };
  };
};
const { notifierSansBloquer } = jest.requireMock('../src/services/notification.service') as {
  notifierSansBloquer: jest.Mock;
};

function makeUser(role: string, userId = 'med-1'): JwtPayload {
  return { userId, role, sessionId: 'sess-1' } as JwtPayload;
}

const enAttente = { id: 'ref-1', statut: 'EN_ATTENTE', idStructureCible: 'struct-A' };

const traite = {
  ...enAttente,
  statut: 'ACCEPTE',
  consultation: {
    id: 'cons-1',
    patient: { utilisateur: { id: 'pat-u', prenom: 'Awa', nom: 'Diallo', telephone: '+224...' } },
    asc: { idUtilisateur: 'asc-u' },
    constantes: null,
    diagnostics: [],
  },
  structureSource: null,
  structureCible: { id: 'struct-A', nom: 'Hôpital de Kindia', type: 'HOPITAL_PREF', prefecture: 'Kindia' },
};

beforeEach(() => {
  notifierSansBloquer.mockResolvedValue(undefined);
});
afterEach(() => jest.resetAllMocks());

describe('repondreReferencement — regles', () => {
  it('404 si le referencement n existe pas', async () => {
    prisma.referencement.findUnique.mockResolvedValue(null);
    await expect(repondreReferencement(makeUser('MEDECIN'), 'ref-x', { statut: 'ACCEPTE' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuse de retraiter un referencement deja traite', async () => {
    prisma.referencement.findUnique.mockResolvedValue({ ...enAttente, statut: 'ACCEPTE' });
    await expect(repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'REFUSE', motifRefus: 'x' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.referencement.update).not.toHaveBeenCalled();
  });

  it('exige un motif pour refuser', async () => {
    prisma.referencement.findUnique.mockResolvedValue(enAttente);
    await expect(repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'REFUSE' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('un medecin d une autre structure ne peut pas repondre', async () => {
    prisma.referencement.findUnique.mockResolvedValue(enAttente);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-B' });
    await expect(repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'ACCEPTE' }))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.referencement.update).not.toHaveBeenCalled();
  });

  it('un admin national passe outre la contrainte de structure', async () => {
    prisma.referencement.findUnique.mockResolvedValue(enAttente);
    prisma.referencement.update.mockResolvedValue(traite);
    await repondreReferencement(makeUser('ADMIN_NATIONAL', 'adm-1'), 'ref-1', { statut: 'ACCEPTE' });
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
    expect(prisma.referencement.update).toHaveBeenCalled();
  });
});

describe('repondreReferencement — effets', () => {
  beforeEach(() => {
    prisma.referencement.findUnique.mockResolvedValue(enAttente);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-A' });
  });

  it('enregistre la reponse avec le medecin valideur et la date', async () => {
    prisma.referencement.update.mockResolvedValue(traite);

    const result = await repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'ACCEPTE' });

    expect(prisma.referencement.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ref-1' },
      data: expect.objectContaining({ statut: 'ACCEPTE', idMedecinValideur: 'med-1', reponduLe: expect.any(Date) }),
    }));
    expect(result).toBe(traite);
  });

  it('notifie le patient ET l ASC referent a l acceptation', async () => {
    prisma.referencement.update.mockResolvedValue(traite);

    await repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'ACCEPTE' });

    expect(notifierSansBloquer).toHaveBeenCalledTimes(2);
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({
      idUtilisateur: 'pat-u', type: 'REFERENCEMENT_ACCEPTE', lienAction: '/patient/dashboard',
    }));
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({
      idUtilisateur: 'asc-u', type: 'REFERENCEMENT_ACCEPTE', lienAction: '/asc/consultations/cons-1',
    }));
  });

  it('transmet le motif de refus dans les notifications', async () => {
    prisma.referencement.update.mockResolvedValue({ ...traite, statut: 'REFUSE', motifRefus: 'Plateau indisponible' });

    await repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'REFUSE', motifRefus: 'Plateau indisponible' });

    const contenus = notifierSansBloquer.mock.calls.map(([dto]) => dto.contenu as string);
    expect(notifierSansBloquer).toHaveBeenCalledTimes(2);
    expect(contenus.every(c => c.includes('Plateau indisponible'))).toBe(true);
    expect(notifierSansBloquer.mock.calls.every(([dto]) => dto.type === 'REFERENCEMENT_REFUSE')).toBe(true);
  });

  it('ne notifie que le patient quand la consultation n a pas d ASC', async () => {
    prisma.referencement.update.mockResolvedValue({ ...traite, consultation: { ...traite.consultation, asc: null } });

    await repondreReferencement(makeUser('MEDECIN'), 'ref-1', { statut: 'ACCEPTE' });

    expect(notifierSansBloquer).toHaveBeenCalledTimes(1);
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({ idUtilisateur: 'pat-u' }));
  });
});
