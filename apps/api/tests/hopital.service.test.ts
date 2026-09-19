// P1 — Hopital (EF-03) : regles metier de l'admission, des episodes et des
// demandes d'analyse. Prisma est simule ; on verifie les decisions, pas SQL.
import {
  annulerDemandeAnalyse,
  creerDemandeAnalyse,
  creerEpisode,
  orienter,
  rechercherPatients,
} from '../src/services/hopital.service';
import { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), findFirst: jest.fn() },
    patientProfile: { findMany: jest.fn(), findUnique: jest.fn() },
    episodeSoins: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    structureSante: { findFirst: jest.fn() },
    examen: { findMany: jest.fn() },
    demandeAnalyse: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    rendezVous: { create: jest.fn(), updateMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  // Une transaction execute le callback avec le meme client simule.
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn().mockResolvedValue(undefined),
  envoyerSmsSimule: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/parametres.service', () => ({
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nom: 'KÈNÈYA', nomCourt: 'KENEYA', copyright: '©', logoUrl: '', telephone: '', emailContact: '' }),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M; findFirst: M };
    patientProfile: { findMany: M; findUnique: M };
    episodeSoins: { findFirst: M; create: M; update: M };
    structureSante: { findFirst: M };
    examen: { findMany: M };
    demandeAnalyse: { create: M; findFirst: M; update: M };
    rendezVous: { create: M; updateMany: M };
    $queryRaw: M;
    $transaction: M;
  };
};
const { notifierSansBloquer, envoyerSmsSimule } = jest.requireMock('../src/services/notification.service') as { notifierSansBloquer: M; envoyerSmsSimule: M };
const { getIdentitePlateforme } = jest.requireMock('../src/services/parametres.service') as { getIdentitePlateforme: M };

const agent: JwtPayload = { userId: 'agent-1', role: 'AGENT_ACCUEIL', sessionId: 's' } as JwtPayload;

const episodeRow = {
  id: 'ep-1', numero: 'EP-2026-000001', motif: 'Douleurs abdominales', service: null, statut: 'OUVERT', notes: null,
  ouvertLe: new Date(), closLe: null, idPatient: 'pat-1', idStructure: 'struct-A',
  patient: { id: 'pat-1', sexe: 'F', dateNaissance: new Date('1974-01-01'), utilisateur: { prenom: 'Awa', nom: 'Diallo', telephone: '620000000' } },
  structure: { id: 'struct-A', nom: 'Hopital de Kindia', type: 'HOPITAL_PREF', prefecture: 'Kindia' },
  ouvertPar: { id: 'agent-1', prenom: 'Kadiatou', nom: 'Toure', role: 'AGENT_ACCUEIL' },
  responsable: null, demandesAnalyse: [], rendezVous: [], _count: { consultations: 0, demandesAnalyse: 0 },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-A', medecinProfile: null });
  prisma.$queryRaw.mockResolvedValue([{ valeur: 7 }]);
  notifierSansBloquer.mockResolvedValue(undefined);
  envoyerSmsSimule.mockResolvedValue(undefined);
  getIdentitePlateforme.mockResolvedValue({ nom: 'KÈNÈYA', nomCourt: 'KENEYA', copyright: '©', logoUrl: '', telephone: '', emailContact: '' });
});

describe('rechercherPatients (EF-03-01)', () => {
  it('exige au moins 3 caracteres', async () => {
    await expect(rechercherPatients(agent, 'Di')).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un agent sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null, medecinProfile: null });
    await expect(rechercherPatients(agent, 'Diallo')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('masque le telephone et signale un episode deja ouvert', async () => {
    prisma.patientProfile.findMany.mockResolvedValue([{
      id: 'pat-1', sexe: 'F', dateNaissance: new Date('1974-01-01'), prefecture: 'Kindia',
      utilisateur: { prenom: 'Awa', nom: 'Diallo', telephone: '620123456' },
      episodes: [{ id: 'ep-1', numero: 'EP-2026-000001' }],
    }]);
    const [r] = await rechercherPatients(agent, 'Diallo');
    expect(r.telephoneMasque).toBe('••••••456');
    expect(r.episodeOuvert?.numero).toBe('EP-2026-000001');
    // La recherche ne concerne que les episodes de la structure de l'agent.
    const where = prisma.patientProfile.findMany.mock.calls[0][0].select.episodes.where;
    expect(where.idStructure).toBe('struct-A');
  });
});

describe('creerEpisode (EF-03-02)', () => {
  it('404 si le patient est inconnu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(creerEpisode(agent, { idPatient: 'x', motif: 'Fievre' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuse un second episode ouvert pour le meme patient dans la structure', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'pat-1', utilisateur: { id: 'u', telephone: '6', prenom: 'Awa' } });
    prisma.episodeSoins.findFirst.mockResolvedValue({ numero: 'EP-2026-000001' });
    await expect(creerEpisode(agent, { idPatient: 'pat-1', motif: 'Fievre' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('numerote l episode, le rattache a la structure de l agent et previent le patient sans detail medical', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'pat-1', utilisateur: { id: 'pat-u', telephone: '6', prenom: 'Awa' } });
    prisma.episodeSoins.findFirst.mockResolvedValue(null);
    prisma.episodeSoins.create.mockResolvedValue(episodeRow);

    const vue = await creerEpisode(agent, { idPatient: 'pat-1', motif: 'Douleurs abdominales' });

    const data = prisma.episodeSoins.create.mock.calls[0][0].data;
    expect(data.numero).toBe('EP-2026-000007');
    expect(data.idStructure).toBe('struct-A');
    expect(data.idOuvertPar).toBe('agent-1');
    expect(vue.patient.nom).toBe('Diallo');
    const notif = notifierSansBloquer.mock.calls[0][0];
    expect(notif.idUtilisateur).toBe('pat-u');
    expect(notif.type).toBe('EPISODE_OUVERT');
    expect(notif.contenu).not.toContain('Douleurs');
  });
});

describe('orienter (EF-03-05)', () => {
  it('exige un medecin ou un service', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    await expect(orienter(agent, 'ep-1', {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un medecin d une autre structure', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst.mockResolvedValue(null);
    await expect(orienter(agent, 'ep-1', { idMedecin: 'med-x' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('cree le rendez-vous medecin, passe l episode EN_COURS et envoie un SMS neutre', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst
      .mockResolvedValueOnce({ id: 'med-1' })                                   // verification du medecin
      .mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });          // utilisateur du patient
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.create.mockResolvedValue({});
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 1 });

    await orienter(agent, 'ep-1', { idMedecin: 'med-1', prevuLe: '2026-09-22T09:00:00+00:00', service: 'Medecine interne' });

    expect(prisma.episodeSoins.update.mock.calls[0][0].data).toMatchObject({ statut: 'EN_COURS', idResponsable: 'med-1', service: 'Medecine interne' });
    // Le rendez-vous encore planifie de l'episode est remplace, pas cumule.
    expect(prisma.rendezVous.updateMany.mock.calls[0][0]).toMatchObject({ where: { idEpisode: 'ep-1', statut: 'PLANIFIE' }, data: { statut: 'ANNULE' } });
    expect(prisma.rendezVous.create.mock.calls[0][0].data).toMatchObject({ idMedecin: 'med-1', idEpisode: 'ep-1', idPatient: 'pat-1', statut: 'PLANIFIE' });
    expect(envoyerSmsSimule).toHaveBeenCalledTimes(1);
    expect(envoyerSmsSimule.mock.calls[0][1]).toMatch(/^KENEYA:/);
    expect(envoyerSmsSimule.mock.calls[0][1]).not.toContain('abdominales');
  });
});

describe('creerDemandeAnalyse (EF-03-03 / EF-03-04)', () => {
  const demandeRow = {
    id: 'da-1', numero: 'DA-2026-000007', urgence: 'ROUTINE', statut: 'TRANSMISE', indicationClinique: null, consignesPatient: 'x',
    creeLe: new Date(), transmiseLe: new Date(), annuleeLe: null, motifAnnulation: null, idEpisode: 'ep-1',
    episode: { numero: 'EP-2026-000001' }, patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } },
    prescripteur: { id: 'agent-1', prenom: 'K', nom: 'T', role: 'AGENT_ACCUEIL' },
    laboratoire: { id: 'labo-1', nom: 'Labo Kindia', type: 'LABORATOIRE', prefecture: 'Kindia' },
    lignes: [], echantillons: [], valideur: null, _count: { alertesCritiques: 0 },
  };

  it('refuse un laboratoire inconnu ou inactif', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.structureSante.findFirst.mockResolvedValue(null);
    await expect(creerDemandeAnalyse(agent, 'ep-1', { idLaboratoire: 'x', examens: [{ idExamen: 'e1' }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un examen hors referentiel', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.structureSante.findFirst.mockResolvedValue({ id: 'labo-1', nom: 'Labo', adresse: null, prefecture: 'Kindia', telephone: null });
    prisma.examen.findMany.mockResolvedValue([]);
    await expect(creerDemandeAnalyse(agent, 'ep-1', { idLaboratoire: 'labo-1', examens: [{ idExamen: 'inconnu' }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it('genere les consignes (a jeun, urines) et transmet au laboratoire', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.structureSante.findFirst.mockResolvedValue({ id: 'labo-1', nom: 'Labo Kindia', adresse: 'Route de Mamou', prefecture: 'Kindia', telephone: '622' });
    prisma.examen.findMany.mockResolvedValue([
      { id: 'e-gly', aJeun: true, consignes: null, specimen: 'SANG' },
      { id: 'e-ecbu', aJeun: false, consignes: 'Urines du matin, milieu du jet.', specimen: 'URINE' },
    ]);
    prisma.demandeAnalyse.create.mockResolvedValue(demandeRow);
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst.mockResolvedValue({ id: 'pat-u', telephone: '620000000' });

    await creerDemandeAnalyse(agent, 'ep-1', { idLaboratoire: 'labo-1', urgence: 'URGENT', examens: [{ idExamen: 'e-gly' }, { idExamen: 'e-ecbu', commentaire: 'controle' }] });

    const data = prisma.demandeAnalyse.create.mock.calls[0][0].data;
    expect(data.numero).toBe('DA-2026-000007');
    expect(data.statut).toBe('TRANSMISE');
    expect(data.urgence).toBe('URGENT');
    expect(data.consignesPatient).toMatch(/a jeun/i);
    expect(data.consignesPatient).toMatch(/urine/i);
    expect(data.consignesPatient).toContain('Urines du matin, milieu du jet.');
    expect(data.lignes.create).toHaveLength(2);
    // L'episode passe EN_COURS des la premiere demande.
    expect(prisma.episodeSoins.update.mock.calls[0][0].data.statut).toBe('EN_COURS');
    // Patient informe du lieu, jamais des examens.
    const notif = notifierSansBloquer.mock.calls[0][0];
    expect(notif.contenu).toContain('Labo Kindia');
    expect(notif.contenu).not.toMatch(/glyc/i);
    expect(envoyerSmsSimule.mock.calls[0][1]).not.toMatch(/ECBU|glyc/i);
  });
});

describe('annulerDemandeAnalyse', () => {
  it('refuse d annuler une demande deja prelevee', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue({ id: 'da-1', statut: 'PRELEVEE' });
    await expect(annulerDemandeAnalyse(agent, 'da-1', 'Erreur')).rejects.toBeInstanceOf(ConflictError);
  });
});
