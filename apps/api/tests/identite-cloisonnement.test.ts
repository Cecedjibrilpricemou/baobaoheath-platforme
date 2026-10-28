// Qui voit, et qui touche, le dossier d'identite d'un patient.
//
// **Defaut signale par l'utilisateur le 2026-10-24** : apres avoir cree une
// clinique, il a vu dans son ecran « Identites » des patients d'autres
// hopitaux. Le constat etait juste, et le trou plus large que la liste.
//
// Tout le domaine identite/fusion ignorait le controle d'acces :
// `assertCanAccessPatient` et `buildPatientWhereForUser` n'y etaient meme pas
// importes. Sept portes etaient ouvertes sur n'importe quel patient du pays,
// dont deux ecritures et une fusion de dossiers -- destructive.
//
// Le perimetre correct existait pourtant depuis le debut dans
// `access-control.service` : l'accueil voit les patients ayant un episode
// ouvert chez lui, l'administrateur de structure y ajoute ceux dont c'est
// l'etablissement prefere et ceux qui lui sont adresses.
jest.mock('../src/config/prisma', () => ({
  prisma: {
    patientProfile: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    fusionDossier: { findMany: jest.fn(), findUnique: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
    ascProfile: { findUnique: jest.fn() },
    medecinProfile: { findUnique: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    patientProfile: { findMany: M; findUnique: M; findFirst: M; update: M };
    fusionDossier: { findMany: M; findUnique: M };
    utilisateur: { findUnique: M };
    ascProfile: { findUnique: M };
    medecinProfile: { findUnique: M };
  };
};

import { rechercher, noterTraits, verifier } from '../src/services/identite.service';
import * as fusion from '../src/services/fusion.service';
import { ForbiddenError } from '../src/utils/app-error';

const ACCUEIL = { userId: 'u-acc', role: 'AGENT_ACCUEIL', sessionId: 's' } as never;
const ADMIN_CLINIQUE = { userId: 'u-adm', role: 'ADMIN_STRUCTURE', sessionId: 's' } as never;

/** Le compte, tel que `buildPatientWhereForUser` le lit. */
function compteDe(role: string, idStructure: string | null) {
  prisma.utilisateur.findUnique.mockResolvedValue({
    role, idStructure,
    patientProfile: null, ascProfile: null, medecinProfile: null, pharmacienProfile: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.patientProfile.findMany.mockResolvedValue([]);
  prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-ailleurs', niveauIdentite: 'PROVISOIRE' });
  prisma.patientProfile.update.mockResolvedValue({ id: 'p1', utilisateur: {} });
});

describe('la liste des identites', () => {
  // Le coeur du defaut signale.
  it('ne porte que sur le perimetre de la structure appelante', async () => {
    compteDe('ADMIN_STRUCTURE', 'clinique-neuve');
    await rechercher(ADMIN_CLINIQUE, {});

    const appel = prisma.patientProfile.findMany.mock.calls[0]?.[0] as { where: unknown };
    const json = JSON.stringify(appel.where);
    // Sans filtre, la requete ne nomme la structure nulle part.
    expect(json).toContain('clinique-neuve');
  });

  // **Le perimetre et les criteres sont cumules, jamais alternatifs.** Un `OR`
  // entre les deux laisserait passer tout patient correspondant au terme
  // cherche, quelle que soit sa structure.
  it('cumule le perimetre et les criteres de recherche', async () => {
    compteDe('AGENT_ACCUEIL', 'hop-1');
    await rechercher(ACCUEIL, { q: 'Diallo' });

    const appel = prisma.patientProfile.findMany.mock.calls[0]?.[0] as { where: { AND?: unknown[] } };
    expect(Array.isArray(appel.where.AND)).toBe(true);
    expect(appel.where.AND).toHaveLength(2);
  });

  // Un agent sans structure n'herite pas du pays entier.
  it('ne rend rien a un agent sans structure', async () => {
    compteDe('AGENT_ACCUEIL', null);
    await rechercher(ACCUEIL, {});
    const appel = prisma.patientProfile.findMany.mock.calls[0]?.[0] as { where: unknown };
    expect(JSON.stringify(appel.where)).toContain('__forbidden__');
  });
});

describe('les gestes sur un dossier hors perimetre', () => {
  beforeEach(() => {
    compteDe('ADMIN_STRUCTURE', 'clinique-neuve');
    // Le patient vise n'appartient pas au perimetre : la requete ne le rend pas.
    prisma.patientProfile.findFirst.mockResolvedValue(null);
  });

  it('refuse de noter les traits d identite', async () => {
    await expect(noterTraits(ADMIN_CLINIQUE, 'p-ailleurs', { lieuNaissance: 'Kindia' }))
      .rejects.toThrow(ForbiddenError);
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  it('refuse de declarer une piece vue', async () => {
    await expect(verifier(ADMIN_CLINIQUE, 'p-ailleurs', {
      typePiece: 'CNI', numeroPiece: 'GN-123456', lieuNaissance: 'Kindia',
    } as never)).rejects.toThrow(ForbiddenError);
  });

  it('refuse de lire l historique des fusions', async () => {
    await expect(fusion.pourPatient(ADMIN_CLINIQUE, 'p-ailleurs')).rejects.toThrow(ForbiddenError);
    expect(prisma.fusionDossier.findMany).not.toHaveBeenCalled();
  });

  // **Le geste le plus grave.** Fusionner absorbe un dossier dans un autre.
  it('refuse de fusionner deux dossiers', async () => {
    await expect(fusion.fusionner(ADMIN_CLINIQUE, 'p-ailleurs', 'p-autre', 'doublon evident'))
      .rejects.toThrow(ForbiddenError);
    expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
  });
});

// **Le patient enregistre au guichet, avant tout episode.**
//
// Le premier correctif a failli casser le travail de l'accueil :
// `creerPatientAuComptoir` pose `idStructurePreferee` sur la structure de
// l'agent, mais le perimetre de l'accueil ne couvrait que les episodes
// ouverts. La verification d'identite se fait justement a l'inscription,
// avant qu'un episode existe -- l'agent n'aurait plus trouve le dossier
// qu'il venait d'ouvrir devant lui.
describe('le perimetre de l accueil', () => {
  it('couvre les patients rattaches a sa structure, pas seulement les episodes', async () => {
    compteDe('AGENT_ACCUEIL', 'hop-1');
    await rechercher(ACCUEIL, {});

    const appel = prisma.patientProfile.findMany.mock.calls[0]?.[0] as {
      where: { AND: [{ OR?: unknown[] }, unknown] };
    };
    const perimetre = JSON.stringify(appel.where.AND[0]);
    expect(perimetre).toContain('idStructurePreferee');
    expect(perimetre).toContain('episodes');
  });
});
