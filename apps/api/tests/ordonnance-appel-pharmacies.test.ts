// L'appel aux pharmacies part dès l'ordonnance prête (addendum 2026-09-28, §1).
//
// Jusqu'au 2026-10-10, **rien ne déclenchait l'appel depuis un écran** : le
// médecin signait, et la commande n'existait que si quelqu'un appelait l'API
// à la main. Le patient devait courir les officines pour savoir laquelle
// détenait tout — exactement ce que le processus devait supprimer.
//
// Ce qui se joue ici : la signature ne doit **jamais** être défaite par un
// appel qui échoue. Une ordonnance signée reste valide et servable au
// comptoir, même sans pharmacie trouvée.
import { validerConsultation } from '../src/services/medecin.service';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    consultation: { findUnique: jest.fn(), update: jest.fn() },
    ordonnance: { updateMany: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
    episodeSoins: { findFirst: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../src/utils/cache', () => ({ withCache: jest.fn(), cacheDel: jest.fn() }));
jest.mock('../src/realtime/socket.server', () => ({ emitToUser: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn(), envoyerSmsSimule: jest.fn(),
}));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));
jest.mock('../src/services/commande.service', () => ({ lancerRecherchePharmacie: jest.fn() }));
jest.mock('../src/services/access-control.service', () => ({
  assertCanAccessConsultation: jest.fn(),
  assertCanAccessPatient: jest.fn(),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    consultation: { findUnique: M; update: M };
    ordonnance: { updateMany: M };
  };
};
const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as {
  getValeursParametres: M;
};
const { lancerRecherchePharmacie } = jest.requireMock('../src/services/commande.service') as {
  lancerRecherchePharmacie: M;
};

const MEDECIN = { userId: 'u-med', role: 'MEDECIN', sessionId: 's-1' } as never;

beforeEach(() => {
  jest.clearAllMocks();
  getValeursParametres.mockResolvedValue({ prescription: { dureeValiditeJours: 30 } });
  prisma.consultation.findUnique.mockResolvedValue({
    id: 'cons-1',
    idMedecinValideur: null,
    ordonnances: [{ id: 'ord-1' }, { id: 'ord-2' }],
    patient: { idUtilisateur: 'u-pat' },
  });
  prisma.consultation.update.mockResolvedValue({ id: 'cons-1' });
  prisma.ordonnance.updateMany.mockResolvedValue({ count: 1 });
  lancerRecherchePharmacie.mockResolvedValue({ id: 'cmd-1' });
});

describe('validerConsultation : appel aux pharmacies', () => {
  it('lance la recherche pour chaque ordonnance signee', async () => {
    await validerConsultation(MEDECIN, 'cons-1', {
      idOrdonnances: ['ord-1', 'ord-2'],
    } as never);

    expect(lancerRecherchePharmacie).toHaveBeenCalledTimes(2);
    expect(lancerRecherchePharmacie).toHaveBeenCalledWith('ord-1');
    expect(lancerRecherchePharmacie).toHaveBeenCalledWith('ord-2');
  });

  // Une consultation validee sans ordonnance n'a rien a faire servir.
  it('ne lance rien quand aucune ordonnance n est signee', async () => {
    await validerConsultation(MEDECIN, 'cons-1', { idOrdonnances: [] } as never);
    expect(lancerRecherchePharmacie).not.toHaveBeenCalled();
  });

  // **Le point qui compte.** Un patient sans quartier renseigne, une
  // recherche deja lancee, une base indisponible : l'ordonnance reste signee
  // et servable au comptoir.
  it('signe quand meme si la recherche echoue', async () => {
    lancerRecherchePharmacie.mockRejectedValue(new Error('Une commande existe deja'));

    await expect(
      validerConsultation(MEDECIN, 'cons-1', { idOrdonnances: ['ord-1'] } as never)
    ).resolves.toBeDefined();

    expect(prisma.ordonnance.updateMany).toHaveBeenCalled();
  });

  // Une ordonnance dont l'appel echoue ne doit pas empecher les suivantes.
  it('poursuit avec les autres ordonnances apres un echec', async () => {
    lancerRecherchePharmacie
      .mockRejectedValueOnce(new Error('quartier inconnu'))
      .mockResolvedValue({ id: 'cmd-2' });

    await validerConsultation(MEDECIN, 'cons-1', {
      idOrdonnances: ['ord-1', 'ord-2'],
    } as never);

    expect(lancerRecherchePharmacie).toHaveBeenCalledTimes(2);
  });

  // L'appel part **apres** la transaction : une recherche lente ne doit pas
  // tenir la base ouverte pendant qu'elle interroge des pharmacies.
  it('n appelle pas les pharmacies avant d avoir signe', async () => {
    const ordre: string[] = [];
    prisma.ordonnance.updateMany.mockImplementation(async () => {
      ordre.push('signature');
      return { count: 1 };
    });
    lancerRecherchePharmacie.mockImplementation(async () => {
      ordre.push('appel');
      return { id: 'cmd-1' };
    });

    await validerConsultation(MEDECIN, 'cons-1', { idOrdonnances: ['ord-1'] } as never);
    expect(ordre).toEqual(['signature', 'appel']);
  });
});
