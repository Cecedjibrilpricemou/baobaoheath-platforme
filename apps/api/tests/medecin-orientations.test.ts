// EF-03-05 — les patients orientés vers un médecin.
//
// Ce fichier existe à cause d'un défaut constaté en usage réel : l'accueil
// orientait un patient vers le Dr David, l'orientation s'écrivait bien en base
// (`EpisodeSoins.idResponsable` posé, rendez-vous créé), mais **aucun écran ni
// aucune notification** ne le disait au médecin. Le patient était envoyé vers
// quelqu'un qui ne le voyait jamais arriver.
//
// Les tests ci-dessous verrouillent les deux bouts : le médecin est prévenu,
// et il retrouve ses orientations.
import { getOrientations } from '../src/services/medecin.service';

jest.mock('../src/config/prisma', () => ({
  prisma: { episodeSoins: { findMany: jest.fn() } },
}));
jest.mock('../src/utils/cache', () => ({ withCache: jest.fn(), cacheDel: jest.fn() }));
jest.mock('../src/realtime/socket.server', () => ({ emitToUser: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({ notifierSansBloquer: jest.fn() }));
jest.mock('../src/services/parametres.service', () => ({ getValeursParametres: jest.fn() }));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { episodeSoins: { findMany: jest.Mock } };
};

function episode(etat: Record<string, unknown> = {}) {
  return {
    id: 'ep-1', numero: 'EP-2026-000001', statut: 'EN_COURS',
    motif: 'Maux de tete', service: 'Medecine generale',
    ouvertLe: new Date('2026-09-26T08:00:00Z'),
    modifieLe: new Date('2026-09-26T09:30:00Z'),
    structure: { id: 's-1', nom: 'Hopital Donka' },
    patient: {
      id: 'p-1', dateNaissance: new Date('1992-03-17'), sexe: 'F',
      utilisateur: { prenom: 'Maomou', nom: 'Conde', telephone: '620100010' },
    },
    rendezVous: [],
    ...etat,
  };
}

afterEach(() => jest.resetAllMocks());

describe('getOrientations', () => {
  it('ne rend que les episodes dont ce medecin est responsable', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([episode()]);

    await getOrientations('u-david');

    expect(prisma.episodeSoins.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { idResponsable: 'u-david', statut: { notIn: ['CLOS', 'ANNULE'] } },
    }));
  });

  it('rend le patient, le motif et la structure', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([episode()]);

    const [o] = await getOrientations('u-david');

    expect(o.numeroEpisode).toBe('EP-2026-000001');
    expect(o.motif).toBe('Maux de tete');
    expect(o.patient).toEqual(expect.objectContaining({ prenom: 'Maomou', nom: 'Conde' }));
    expect(o.structure.nom).toBe('Hopital Donka');
  });

  // L'accueil peut orienter sans proposer de date : l'orientation vaut quand
  // meme, et le medecin doit la voir.
  it('rend une orientation sans rendez-vous', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([episode()]);

    expect((await getOrientations('u-david'))[0].rendezVous).toBeNull();
  });

  it('rend le rendez-vous quand une date a ete proposee', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([
      episode({
        rendezVous: [{ id: 'rdv-1', prevuLe: new Date('2026-09-27T09:00:00Z'), statut: 'PLANIFIE', motif: 'Maux de tete' }],
      }),
    ]);

    const [o] = await getOrientations('u-david');

    expect(o.rendezVous).toEqual(expect.objectContaining({ id: 'rdv-1', statut: 'PLANIFIE' }));
    expect(typeof o.rendezVous?.prevuLe).toBe('string');
  });

  // Un rendez-vous annule ne doit pas remonter : une nouvelle orientation
  // annule la convocation precedente, et l'ancienne n'a plus de sens.
  it('ne retient que le rendez-vous encore planifie', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([episode()]);

    await getOrientations('u-david');

    const { include } = prisma.episodeSoins.findMany.mock.calls[0][0];
    expect(include.rendezVous.where).toEqual({ statut: 'PLANIFIE' });
  });

  // Un episode clos ne demande plus rien au medecin.
  it('ecarte les episodes clos ou annules', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([]);

    await getOrientations('u-david');

    const { where } = prisma.episodeSoins.findMany.mock.calls[0][0];
    expect(where.statut).toEqual({ notIn: ['CLOS', 'ANNULE'] });
  });

  it('rend une liste vide quand rien n est oriente', async () => {
    prisma.episodeSoins.findMany.mockResolvedValue([]);

    expect(await getOrientations('u-david')).toEqual([]);
  });
});
