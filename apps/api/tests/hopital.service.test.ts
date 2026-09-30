// P1 — Hopital (EF-03) : regles metier de l'admission, des episodes et des
// demandes d'analyse. Prisma est simule ; on verifie les decisions, pas SQL.
import {
  annulerDemandeAnalyse,
  creerDemandeAnalyse,
  creerEpisode,
  getEpisode,
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
const docteur: JwtPayload = { userId: 'med-1', role: 'MEDECIN', sessionId: 's' } as JwtPayload;

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

  // Addendum du 2026-09-28 : l'accueil oriente, il ne fixe plus l'heure.
  // Avant, il posait une convocation que le medecin subissait sans connaitre
  // son agenda.
  it('passe l episode EN_COURS et designe le medecin, sans creer de rendez-vous', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst
      .mockResolvedValueOnce({ id: 'med-1' })                                   // verification du medecin
      .mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });          // utilisateur du patient
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 0 });

    await orienter(agent, 'ep-1', { idMedecin: 'med-1', service: 'Medecine interne' });

    expect(prisma.episodeSoins.update.mock.calls[0][0].data).toMatchObject({ statut: 'EN_COURS', idResponsable: 'med-1', service: 'Medecine interne' });
    expect(prisma.rendezVous.create).not.toHaveBeenCalled();
    // Aucune heure n'etant fixee, aucun SMS n'annonce de rendez-vous : le
    // patient ne doit pas se deplacer pour un creneau qui n'existe pas.
    expect(envoyerSmsSimule).not.toHaveBeenCalled();
  });

  // Reorienter vers quelqu'un d'autre annule la convocation precedente : un
  // patient ne peut pas etre attendu par deux medecins.
  it('annule le rendez-vous planifie d un autre medecin', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst
      .mockResolvedValueOnce({ id: 'med-2' })
      .mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 1 });

    await orienter(agent, 'ep-1', { idMedecin: 'med-2' });

    expect(prisma.rendezVous.updateMany.mock.calls[0][0]).toMatchObject({
      where: { idEpisode: 'ep-1', statut: 'PLANIFIE', idMedecin: { not: 'med-2' } },
      data: { statut: 'ANNULE' },
    });
  });

  // Le medecin doit savoir qu'il lui revient de poser le creneau.
  it('demande au medecin de fixer le rendez-vous', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst
      .mockResolvedValueOnce({ id: 'med-1' })
      .mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 0 });

    await orienter(agent, 'ep-1', { idMedecin: 'med-1' });

    const pourMedecin = notifierSansBloquer.mock.calls.find((c: unknown[]) =>
      (c[0] as { idUtilisateur: string }).idUtilisateur === 'med-1'
    );
    expect(pourMedecin![0].contenu).toMatch(/rendez-vous/i);
  });

  // Le defaut constate en usage : l'orientation s'ecrivait bien, mais personne
  // ne prevenait le medecin. Le patient etait envoye vers quelqu'un qui ne le
  // voyait pas arriver. Ce test verrouille l'avertissement.
  it('previent le medecin, avec le lien vers ses orientations', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst
      .mockResolvedValueOnce({ id: 'med-1' })
      .mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.create.mockResolvedValue({});
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 1 });

    await orienter(agent, 'ep-1', { idMedecin: 'med-1', prevuLe: '2026-09-22T09:00:00+00:00' });

    const pourMedecin = notifierSansBloquer.mock.calls.find((c: unknown[]) =>
      (c[0] as { idUtilisateur: string }).idUtilisateur === 'med-1'
    );
    expect(pourMedecin).toBeDefined();
    expect(pourMedecin![0]).toMatchObject({
      idUtilisateur: 'med-1',
      type: 'ORIENTATION',
      // Sans ce lien, le medecin est prevenu mais ne sait pas ou regarder.
      lienAction: '/medecin/orientations',
    });
    // Le patient reste prevenu de son cote : les deux notifications coexistent.
    expect(notifierSansBloquer.mock.calls.some((c: unknown[]) =>
      (c[0] as { idUtilisateur: string }).idUtilisateur === 'pat-u'
    )).toBe(true);
  });

  // Orienter vers un service sans nommer de medecin reste possible : il n'y a
  // alors personne a prevenir, et cela ne doit pas echouer.
  it('n envoie pas de notification medecin quand aucun medecin n est designe', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(episodeRow);
    prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'pat-u', telephone: '620000000' });
    prisma.episodeSoins.update.mockResolvedValue(episodeRow);
    prisma.rendezVous.updateMany.mockResolvedValue({ count: 0 });

    await orienter(agent, 'ep-1', { service: 'Medecine interne' });

    expect(notifierSansBloquer.mock.calls.every((c: unknown[]) =>
      (c[0] as { idUtilisateur: string }).idUtilisateur !== 'med-1'
    )).toBe(true);
  });
});

// ── L'accueil ne lit plus de valeurs d'analyse (addendum, point 9) ────
//
// Fermer la route `/demandes-analyse/:id` ne suffisait pas : la fiche
// d'episode porte les memes lignes et leurs resultats, et elle reste ouverte a
// l'accueil — c'est son ecran de travail. Sans masquage, le droit retire d'un
// cote revenait par l'autre.
describe('getEpisode : valeurs masquees pour l accueil', () => {
  const avecResultats = {
    ...episodeRow,
    demandesAnalyse: [{
      id: 'da-1', numero: 'DA-2026-000001', urgence: 'ROUTINE', statut: 'VALIDEE',
      indicationClinique: 'Suspicion d anemie', consignesPatient: null,
      creeLe: new Date(), transmiseLe: new Date(), annuleeLe: null, motifAnnulation: null,
      lieuPrelevement: null, creneauPrelevement: null, recueLe: null, preleveeLe: null,
      valideeLe: new Date(), commentaireBiologiste: 'Anemie moderee',
      commentaireMedecin: 'Rien d inquietant', diffuseePatientLe: new Date(),
      idEpisode: 'ep-1', idPatient: 'pat-1',
      episode: { numero: 'EP-2026-000001' },
      patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } },
      prescripteur: { id: 'med-1', prenom: 'D', nom: 'C', role: 'MEDECIN' },
      laboratoire: { id: 'labo-A', nom: 'Labo Kindia', type: 'LABORATOIRE', prefecture: 'Kindia' },
      valideur: { id: 'bio-1', prenom: 'A', nom: 'C', role: 'BIOLOGISTE' },
      liberePar: { id: 'med-1', prenom: 'D', nom: 'C', role: 'MEDECIN' },
      echantillons: [],
      lignes: [{
        id: 'li-1', commentaire: null,
        examen: { id: 'ex-hb', codeLoinc: '718-7', libelle: 'Hemoglobine', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: 'g/dL', aJeun: false, consignes: null, prixGnf: null, refMin: 12, refMax: 17, refTexte: null, critiqueMin: 7, critiqueMax: 20 },
        resultat: {
          id: 'res-1', valeur: '6', valeurNumerique: 6, unite: 'g/dL', refMin: 12, refMax: 17,
          refTexte: null, interpretation: 'CRITIQUE', commentaire: null, saisiLe: new Date(),
          saisiPar: { id: 'tech-1', prenom: 'S', nom: 'C', role: 'TECHNICIEN_LABO' }, echantillon: null,
        },
      }],
      _count: { alertesCritiques: 0 },
    }],
  };

  it('rend la demande et ses examens, mais aucune valeur', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(avecResultats);

    const vue = await getEpisode(agent, 'ep-1');
    const [d] = vue.demandesAnalyse;

    // Il garde de quoi travailler : le numero, le statut, les examens demandes.
    expect(d!.numero).toBe('DA-2026-000001');
    expect(d!.lignes[0]!.examen.libelle).toBe('Hemoglobine');
    // Mais pas la valeur, ni les conclusions.
    expect(d!.lignes[0]!.resultat).toBeNull();
    expect(d!.commentaireBiologiste).toBeNull();
    expect(d!.commentaireMedecin).toBeNull();
    expect(d!.libereePar).toBeNull();
  });

  it('ne masque rien pour le medecin', async () => {
    prisma.episodeSoins.findFirst.mockResolvedValue(avecResultats);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'struct-A', medecinProfile: null });

    const vue = await getEpisode(docteur, 'ep-1');
    const [d] = vue.demandesAnalyse;

    expect(d!.lignes[0]!.resultat?.valeur).toBe('6');
    expect(d!.commentaireMedecin).toBe('Rien d inquietant');
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
