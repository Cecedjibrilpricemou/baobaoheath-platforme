// Rechercher et exporter le journal d'audit (EF-12-05).
//
// C'est le seul endroit de la plateforme ou l'on voit, d'un coup, qui a touche
// au dossier de qui. Une erreur dans le filtre ne se remarque pas : elle rend
// simplement moins de lignes, et l'enquete conclut qu'il ne s'est rien passe.
// D'ou le soin mis ici sur `construireFiltre`, qui est pur.
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    journalAudit: { findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { journalAudit: { findMany: M; count: M } };
};

import { construireFiltre, exporterCsv, MAX_LIGNES_EXPORT, rechercher } from '../src/services/journal.service';
import { analyserCsv } from '../src/services/referentiel.service';

const MAINTENANT = new Date('2026-10-03T12:00:00.000Z');

beforeEach(() => {
  jest.resetAllMocks();
  prisma.journalAudit.findMany.mockResolvedValue([]);
  prisma.journalAudit.count.mockResolvedValue(0);
});

// ── La periode ───────────────────────────────────────────────────────

describe('construireFiltre : la periode', () => {
  // Sans borne, une recherche sans critere balaierait la table entiere — et
  // le journal est la table qui grandit le plus vite de la plateforme.
  it('remonte 30 jours quand aucune date n est donnee', () => {
    const f = construireFiltre({}, MAINTENANT) as { creeLe: { gte: Date } };
    expect(f.creeLe.gte.toISOString()).toBe('2026-09-03T12:00:00.000Z');
  });

  it('respecte une borne basse donnee', () => {
    const f = construireFiltre({ du: '2026-01-01' }, MAINTENANT) as { creeLe: { gte: Date } };
    expect(f.creeLe.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  // « Jusqu'au 3 octobre » veut dire le 3 inclus. Pris a minuit, ce critere
  // exclurait toute la journee du 3 — donc, souvent, exactement ce qu'on
  // cherche.
  it('inclut la journee entiere quand la borne haute est une date seule', () => {
    const f = construireFiltre({ au: '2026-10-03' }, MAINTENANT) as { creeLe: { lte: Date } };
    expect(f.creeLe.lte.toISOString()).toBe('2026-10-03T23:59:59.999Z');
  });

  it('respecte un horodatage complet en borne haute, sans l etendre', () => {
    const f = construireFiltre({ au: '2026-10-03T08:30:00.000Z' }, MAINTENANT) as { creeLe: { lte: Date } };
    expect(f.creeLe.lte.toISOString()).toBe('2026-10-03T08:30:00.000Z');
  });

  // Avec une borne haute seule, on ne plaque pas en plus les 30 jours : celui
  // qui cherche « tout ce qui precede le 1er janvier » le demande vraiment.
  it('n ajoute pas la borne par defaut quand seule la fin est donnee', () => {
    const f = construireFiltre({ au: '2026-10-03' }, MAINTENANT) as { creeLe: Record<string, unknown> };
    expect(f.creeLe['gte']).toBeUndefined();
  });

  it('refuse une date illisible, en la citant', () => {
    expect(() => construireFiltre({ du: 'hier' }, MAINTENANT)).toThrow(ValidationError);
    expect(() => construireFiltre({ du: 'hier' }, MAINTENANT)).toThrow(/hier/);
  });

  // Sans ce refus, la recherche rendrait zero ligne et l'operateur conclurait
  // qu'il ne s'est rien passe.
  it('refuse un intervalle a l envers', () => {
    expect(() => construireFiltre({ du: '2026-10-03', au: '2026-10-01' }, MAINTENANT))
      .toThrow(/posterieure/);
  });
});

// ── Les autres criteres ──────────────────────────────────────────────

describe('construireFiltre : les criteres', () => {
  it('filtre sur l auteur', () => {
    expect(construireFiltre({ idUtilisateur: 'u1' }, MAINTENANT)).toMatchObject({ idUtilisateur: 'u1' });
  });

  it('filtre sur le patient concerne', () => {
    expect(construireFiltre({ idPatient: 'p1' }, MAINTENANT)).toMatchObject({ idPatientConcerne: 'p1' });
  });

  it('filtre sur la ressource', () => {
    expect(construireFiltre({ ressource: 'patients' }, MAINTENANT)).toMatchObject({ ressource: 'patients' });
  });

  it('filtre sur le role de l auteur', () => {
    expect(construireFiltre({ role: 'MEDECIN' }, MAINTENANT)).toMatchObject({ utilisateur: { role: 'MEDECIN' } });
  });

  // Une rafale de 403 sur des dossiers differents est le motif que la
  // detection d'anomalies (EF-12-06) devra reconnaitre. Le prealable est que
  // les refus soient filtrables.
  it('ne garde que les refus quand on le demande', () => {
    expect(construireFiltre({ echecsSeulement: true }, MAINTENANT)).toMatchObject({ statutHttp: { gte: 400 } });
  });

  it('ne pose aucun critere de statut par defaut', () => {
    expect(construireFiltre({}, MAINTENANT)).not.toHaveProperty('statutHttp');
  });

  it('cumule plusieurs criteres', () => {
    const f = construireFiltre(
      { idPatient: 'p1', role: 'PHARMACIEN', ressource: 'pharmacien', echecsSeulement: true },
      MAINTENANT
    );
    expect(f).toMatchObject({
      idPatientConcerne: 'p1',
      ressource: 'pharmacien',
      statutHttp: { gte: 400 },
      utilisateur: { role: 'PHARMACIEN' },
    });
  });

  // « Qui, a part lui, a ouvert ce dossier ? » — la question d'une enquete.
  it('exclut le patient lui-meme avec parTiers', () => {
    const f = construireFiltre({ idPatient: 'p1', parTiers: true }, MAINTENANT) as {
      utilisateur: { patientProfile: { isNot: { id: string } } };
    };
    expect(f.utilisateur.patientProfile.isNot.id).toBe('p1');
  });

  // Sans patient, « par un tiers » ne veut rien dire : tiers de qui ?
  it('ignore parTiers quand aucun patient n est vise', () => {
    expect(construireFiltre({ parTiers: true }, MAINTENANT)).not.toHaveProperty('utilisateur');
  });

  it('conserve le filtre de role en meme temps que parTiers', () => {
    const f = construireFiltre({ idPatient: 'p1', parTiers: true, role: 'MEDECIN' }, MAINTENANT) as {
      utilisateur: { role: string; patientProfile: unknown };
    };
    expect(f.utilisateur.role).toBe('MEDECIN');
    expect(f.utilisateur.patientProfile).toBeDefined();
  });
});

// ── La recherche ─────────────────────────────────────────────────────

const LIGNE = {
  id: 'j1',
  action: 'GET /:id',
  ressource: 'patients',
  idRessource: 'p1',
  statutHttp: 200,
  ipAdresse: '10.0.0.1',
  creeLe: new Date('2026-10-03T10:00:00.000Z'),
  idUtilisateur: 'u1',
  idPatientConcerne: 'p1',
  utilisateur: { prenom: 'David', nom: 'Camara', role: 'MEDECIN' },
  patientConcerne: { utilisateur: { prenom: 'Maomou', nom: 'Conde' } },
};

describe('rechercher', () => {
  it('rend les lignes du plus recent au plus ancien', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    prisma.journalAudit.count.mockResolvedValue(1);
    await rechercher({}, MAINTENANT);
    const [args] = prisma.journalAudit.findMany.mock.calls[0] as [{ orderBy: unknown }];
    expect(args.orderBy).toEqual({ creeLe: 'desc' });
  });

  it('nomme l acteur et le patient', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.acteur).toEqual({ prenom: 'David', nom: 'Camara', role: 'MEDECIN' });
    expect(page.lignes[0]?.patientConcerne).toBe('Maomou Conde');
  });

  it('laisse le patient a null quand l action ne concernait aucun dossier', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([
      { ...LIGNE, idPatientConcerne: null, patientConcerne: null },
    ]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.patientConcerne).toBeNull();
  });

  // Le libelle part en cles, l'ecran d'administration etant bilingue lui
  // aussi — mais ce sont **les cles d'administration**, pas celles du
  // patient : « votre dossier a ete consulte » n'a aucun sens dans une
  // enquete sur le dossier d'un tiers, que la colonne voisine nomme deja.
  // Vu a l'ecran le 2026-10-03.
  it('rend les cles de la redaction d administration, pas celles du patient', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.libelle).toBe('ADMIN.JOURNAL.ACTION_LABEL.READ');
    expect(page.lignes[0]?.libelleObjet).toBe('ADMIN.JOURNAL.ACTION_OBJECT.RECORD');
    expect(page.lignes[0]?.libelle).not.toMatch(/^PATIENT\./);
  });

  // **Un acces refuse n'a rien consulte.** L'ecran affichait « Dossier
  // consulte » a cote d'un 403 : la phrase contredisait le code juste a cote,
  // et c'est exactement ce qu'une enquete ne doit pas lire. Vu a l'ecran le
  // 2026-10-03, pas en relisant le code.
  it('dit « tentative refusee » quand le code est un refus', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([{ ...LIGNE, statutHttp: 403 }]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.libelle).toBe('ADMIN.JOURNAL.ACTION_LABEL.REFUSE');
  });

  it.each([200, 201, 204, 304])('garde la phrase ordinaire pour un code %i', async (statutHttp) => {
    prisma.journalAudit.findMany.mockResolvedValue([{ ...LIGNE, statutHttp }]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.libelle).toBe('ADMIN.JOURNAL.ACTION_LABEL.READ');
  });

  // Les ressources d'administration n'apparaissent jamais dans le journal
  // d'un patient, mais une enquete les voit : « Dossier » pour une tentative
  // sur le journal d'audit serait trompeur.
  it.each([
    ['journal', 'AUDIT_LOG'],
    ['comptes', 'ACCOUNTS'],
    ['referentiels', 'REFERENCE_DATA'],
  ])('nomme la ressource d administration « %s »', async (ressource, attendu) => {
    prisma.journalAudit.findMany.mockResolvedValue([{ ...LIGNE, ressource }]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.libelleObjet).toBe(`ADMIN.JOURNAL.ACTION_OBJECT.${attendu}`);
  });

  it('nomme un scan comme tel, sans objet', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([
      { ...LIGNE, action: 'GET /scan/:qrCode', ressource: 'laboratoire' },
    ]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.libelle).toBe('ADMIN.JOURNAL.ACTION_LABEL.SCAN');
    expect(page.lignes[0]?.libelleObjet).toBe('');
  });

  it('garde la trace technique a cote du libelle', async () => {
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    prisma.journalAudit.count.mockResolvedValue(1);
    const page = await rechercher({}, MAINTENANT);
    expect(page.lignes[0]?.action).toBe('GET /:id');
    expect(page.lignes[0]?.ressource).toBe('patients');
    expect(page.lignes[0]?.ipAdresse).toBe('10.0.0.1');
  });

  it('pagine, et plafonne la taille de page', async () => {
    await rechercher({ page: 3, limit: 5000 }, MAINTENANT);
    const [args] = prisma.journalAudit.findMany.mock.calls[0] as [{ skip: number; take: number }];
    expect(args.take).toBe(200);
    expect(args.skip).toBe(400);
  });

  it('annonce la limite d export, pour que l ecran puisse prevenir', async () => {
    const page = await rechercher({}, MAINTENANT);
    expect(page.maxExport).toBe(MAX_LIGNES_EXPORT);
  });
});

// ── L'export ─────────────────────────────────────────────────────────

describe('exporterCsv', () => {
  it('rend un CSV relisible, separe par des points-virgules', async () => {
    prisma.journalAudit.count.mockResolvedValue(1);
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    const csv = await exporterCsv({}, MAINTENANT);
    const relu = analyserCsv(csv);
    expect(relu.separateur).toBe(';');
    expect(relu.lignes).toHaveLength(1);
    expect(relu.lignes[0]?.champs['acteur']).toBe('David Camara');
    expect(relu.lignes[0]?.champs['patient concerne']).toBe('Maomou Conde');
    expect(relu.lignes[0]?.champs['code http']).toBe('200');
  });

  // **Le point de ce fichier.** Un export d'audit ampute sans le dire est
  // pire qu'un export absent : on conclut d'une absence de ligne qu'il ne
  // s'est rien passe.
  it('refuse un export trop large plutot que de le tronquer', async () => {
    prisma.journalAudit.count.mockResolvedValue(MAX_LIGNES_EXPORT + 1);
    await expect(exporterCsv({}, MAINTENANT)).rejects.toThrow(ValidationError);
    await expect(exporterCsv({}, MAINTENANT)).rejects.toThrow(/jamais tronque en silence/);
  });

  it('cite le nombre exact de lignes, pour que l operateur sache de combien resserrer', async () => {
    prisma.journalAudit.count.mockResolvedValue(42_123);
    await expect(exporterCsv({}, MAINTENANT)).rejects.toThrow(/42123/);
  });

  it('ne lit rien quand il refuse', async () => {
    prisma.journalAudit.count.mockResolvedValue(MAX_LIGNES_EXPORT + 1);
    await expect(exporterCsv({}, MAINTENANT)).rejects.toThrow();
    expect(prisma.journalAudit.findMany).not.toHaveBeenCalled();
  });

  it('accepte exactement la limite', async () => {
    prisma.journalAudit.count.mockResolvedValue(MAX_LIGNES_EXPORT);
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    await expect(exporterCsv({}, MAINTENANT)).resolves.toContain('David Camara');
  });

  it('rend un fichier avec ses seuls en-tetes quand rien ne correspond', async () => {
    prisma.journalAudit.count.mockResolvedValue(0);
    prisma.journalAudit.findMany.mockResolvedValue([]);
    const csv = await exporterCsv({}, MAINTENANT);
    expect(csv).toContain('Horodatage');
    expect(() => analyserCsv(csv)).not.toThrow();
  });

  // L'export sert une enquete, pas un ecran : il porte la trace technique et
  // non la phrase redigee pour le patient, qui est une cle de traduction.
  it('porte la trace technique et non une cle de traduction', async () => {
    prisma.journalAudit.count.mockResolvedValue(1);
    prisma.journalAudit.findMany.mockResolvedValue([LIGNE]);
    const csv = await exporterCsv({}, MAINTENANT);
    expect(csv).toContain('GET /:id');
    expect(csv).not.toContain('ACCESS_LABEL');
  });

  it('applique les memes criteres que la recherche', async () => {
    prisma.journalAudit.count.mockResolvedValue(0);
    prisma.journalAudit.findMany.mockResolvedValue([]);
    await exporterCsv({ idPatient: 'p1', echecsSeulement: true }, MAINTENANT);
    const [args] = prisma.journalAudit.findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ idPatientConcerne: 'p1', statutHttp: { gte: 400 } });
  });
});
