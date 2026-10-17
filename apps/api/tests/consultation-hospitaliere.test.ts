// Le médecin ouvre sa consultation depuis la visite (EF-03, EF-05).
//
// **Jusqu'ici seul un agent de santé communautaire pouvait ouvrir une
// consultation.** `POST /consultations` est réservé à `ASC` : le parcours
// hospitalier — le patient demande un rendez-vous, l'accueil l'oriente, le
// médecin fixe l'heure, le patient arrive — s'arrêtait net. Le médecin avait
// un épisode de soins ouvert et aucun moyen d'y mener la consultation.
//
// L'ASC est une porte d'entrée **communautaire**, pour les zones sans
// médecin, avec un paquet d'actes protocolaire. En faire le seul créateur de
// consultations était une erreur de modèle : la plateforme avait une porte là
// où il en faut deux.
import { ouvrirConsultationDeLEpisode } from '../src/services/hopital.service';
import { NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    episodeSoins: { findFirst: jest.fn(), update: jest.fn() },
    consultation: { findFirst: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn(),
  envoyerSmsSimule: jest.fn(),
}));
jest.mock('../src/services/parametres.service', () => ({
  getValeursParametres: jest.fn().mockResolvedValue({}),
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nom: 'KENEYA' }),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    episodeSoins: { findFirst: M; update: M };
    consultation: { findFirst: M; create: M; findUniqueOrThrow: M };
  };
};

const qui = (userId: string, role: string) => ({ userId, role, sessionId: 's' }) as never;

const EPISODE = {
  id: 'e1',
  numero: 'EP-2026-000001',
  idPatient: 'p1',
  idStructure: 'hop1',
  motif: 'maux de tete depuis trois jours',
  statut: 'OUVERT',
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue({
    idStructure: 'hop1', medecinProfile: { idStructure: 'hop1' },
  });
  prisma.episodeSoins.findFirst.mockResolvedValue(EPISODE);
  prisma.episodeSoins.update.mockResolvedValue({});
  prisma.consultation.findFirst.mockResolvedValue(null);
  prisma.consultation.create.mockResolvedValue({ id: 'c1' });
  prisma.consultation.findUniqueOrThrow.mockResolvedValue({ id: 'c1', statut: 'EN_COURS' });
});

describe('ouvrir la consultation d une visite', () => {
  // **Le patient et le motif viennent de l'episode**, pas du corps de la
  // requete : ils y sont deja, et les redemander ouvrirait la porte a une
  // consultation rattachee a une visite qui parle d'autre chose.
  it('reprend le patient et le motif de la visite', async () => {
    await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1');
    const cree = prisma.consultation.create.mock.calls[0]?.[0] as {
      data: { idPatient: string; idEpisode: string; motifPrincipal: string; statut: string };
    };
    expect(cree.data.idPatient).toBe('p1');
    expect(cree.data.idEpisode).toBe('e1');
    expect(cree.data.motifPrincipal).toBe('maux de tete depuis trois jours');
    expect(cree.data.statut).toBe('EN_COURS');
  });

  it('accepte un motif plus precis que celui de la visite', async () => {
    await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1', {
      motifPrincipal: 'cephalees avec photophobie',
    });
    const cree = prisma.consultation.create.mock.calls[0]?.[0] as {
      data: { motifPrincipal: string };
    };
    expect(cree.data.motifPrincipal).toBe('cephalees avec photophobie');
  });

  // La visite n'est plus seulement ouverte : quelqu'un s'en occupe.
  it('fait passer la visite en cours', async () => {
    await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1');
    const maj = prisma.episodeSoins.update.mock.calls[0]?.[0] as { data: { statut: string } };
    expect(maj.data.statut).toBe('EN_COURS');
  });

  it('ne retouche pas une visite deja en cours', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue({ ...EPISODE, statut: 'EN_COURS' });
    await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1');
    expect(prisma.episodeSoins.update).not.toHaveBeenCalled();
  });

  // **Une consultation ouverte a la fois par visite.** Deux consultations
  // pour une meme venue donneraient deux comptes rendus a signer, et le
  // patient ne saurait pas lequel fait foi.
  it.each(['EN_COURS', 'PLANIFIEE'])(
    'rend celle qui est deja ouverte (%s) au lieu d en creer une seconde',
    async (statut) => {
      prisma.consultation.findFirst.mockResolvedValue({ id: 'deja' });
      prisma.consultation.findUniqueOrThrow.mockResolvedValue({ id: 'deja', statut });
      const r = await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1') as { id: string };
      expect(r.id).toBe('deja');
      expect(prisma.consultation.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['CLOS', /close/i],
    ['ANNULE', /annulee/i],
  ])('refuse de consulter sur une visite %s', async (statut, attendu) => {
    prisma.episodeSoins.findFirst.mockResolvedValue({ ...EPISODE, statut });
    await expect(ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1'))
      .rejects.toThrow(attendu);
    expect(prisma.consultation.create).not.toHaveBeenCalled();
  });

  // **Une visite d'une autre structure n'existe pas pour ce medecin.** La
  // requete la cherche dans sa structure ; ailleurs, elle est introuvable.
  it('refuse une visite qui n est pas de sa structure', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(null);
    await expect(ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'ailleurs'))
      .rejects.toThrow(NotFoundError);
  });

  it('cherche bien la visite dans la structure de l appelant', async () => {
    await ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1');
    const appel = prisma.episodeSoins.findFirst.mock.calls[0]?.[0] as {
      where: { id: string; idStructure: string };
    };
    expect(appel.where).toMatchObject({ id: 'e1', idStructure: 'hop1' });
  });

  // Un motif vide ne decrit rien, et c'est le premier mot du compte rendu.
  it('refuse un motif vide quand la visite n en porte pas', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue({ ...EPISODE, motif: '' });
    await expect(ouvrirConsultationDeLEpisode(qui('u-med', 'MEDECIN'), 'e1'))
      .rejects.toThrow(ValidationError);
  });
});
