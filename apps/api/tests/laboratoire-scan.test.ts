// Scan du QR patient au comptoir du laboratoire.
//
// Le QR est un identifiant, pas une cle du dossier medical. Ces tests
// verrouillent ce que le scan montre — et surtout ce qu'il ne montre pas :
// un laborantin qui scanne ne doit pas se retrouver avec le dossier entier
// entre les mains, ni avec les demandes adressees a un autre laboratoire.
import { scanPatient } from '../src/services/laboratoire.service';
import { NotFoundError, ForbiddenError } from '../src/utils/app-error';
import { JwtPayload } from '../src/types/auth.types';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    demandeAnalyse: { findMany: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn(), envoyerSmsSimule: jest.fn(),
}));
jest.mock('../src/services/parametres.service', () => ({
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nomCourt: 'KENEYA' }),
}));
jest.mock('../src/services/access-control.service', () => ({
  buildPatientWhereForUser: jest.fn().mockResolvedValue({}),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    patientProfile: { findUnique: M };
    demandeAnalyse: { findMany: M };
  };
};

const laborantin: JwtPayload = { userId: 'tech-1', role: 'TECHNICIEN_LABO', sessionId: 's' } as JwtPayload;

const patientRow = {
  id: 'pat-1',
  dateNaissance: new Date('1992-03-17'),
  sexe: 'F',
  utilisateur: { prenom: 'Maomou', nom: 'Conde', telephone: '620100010' },
};

const demandeRow = {
  id: 'da-1', numero: 'DA-2026-000001', statut: 'TRANSMISE', urgence: 'ROUTINE',
  consignesPatient: 'Venir a jeun.', creeLe: new Date('2026-09-29T08:00:00Z'),
  lignes: [
    { examen: { libelle: 'Glycemie a jeun', aJeun: true } },
    { examen: { libelle: 'Hemoglobine', aJeun: false } },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'labo-A' });
});

describe('scanPatient (laboratoire)', () => {
  it('refuse un compte sans laboratoire rattache', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(scanPatient(laborantin, 'QR-X')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rend introuvable un QR inconnu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(scanPatient(laborantin, 'QR-INCONNU')).rejects.toBeInstanceOf(NotFoundError);
  });

  // Le coeur du sujet : le scan ne doit pas devenir un passe-partout.
  it('ne cherche que dans le laboratoire de celui qui scanne', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([]);

    await scanPatient(laborantin, 'DEMO-QR');

    const { where } = prisma.demandeAnalyse.findMany.mock.calls[0][0];
    expect(where.idLaboratoire).toBe('labo-A');
    expect(where.idPatient).toBe('pat-1');
  });

  // Une demande validee est close pour le laboratoire : l'afficher ferait
  // croire qu'il reste un geste a poser.
  it('ne rend que les demandes encore a traiter', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([]);

    await scanPatient(laborantin, 'DEMO-QR');

    const { where } = prisma.demandeAnalyse.findMany.mock.calls[0][0];
    expect(where.statut).toEqual({ in: ['TRANSMISE', 'RECUE', 'PRELEVEE', 'EN_ANALYSE'] });
  });

  it('rend l identite, les examens demandes et le jeune', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([demandeRow]);

    const vue = await scanPatient(laborantin, 'DEMO-QR');

    expect(vue.patient).toEqual(expect.objectContaining({ prenom: 'Maomou', nom: 'Conde', sexe: 'F' }));
    expect(vue.totalDemandes).toBe(1);
    expect(vue.demandes[0]!.examens).toEqual(['Glycemie a jeun', 'Hemoglobine']);
    // Un seul examen a jeun suffit a poser le drapeau : le laborantin doit le
    // savoir avant de prelever.
    expect(vue.demandes[0]!.aJeun).toBe(true);
  });

  it('ne pose pas le drapeau a jeun quand aucun examen ne l exige', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([
      { ...demandeRow, lignes: [{ examen: { libelle: 'Hemoglobine', aJeun: false } }] },
    ]);

    expect((await scanPatient(laborantin, 'DEMO-QR')).demandes[0]!.aJeun).toBe(false);
  });

  // Le scan ouvre une fenetre, pas le dossier. Si un champ sensible
  // apparaissait ici, il partirait a chaque scan sans que personne ne le
  // remarque.
  it('ne demande a la base que les champs de la fenetre', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([demandeRow]);

    await scanPatient(laborantin, 'DEMO-QR');

    const patientSelect = prisma.patientProfile.findUnique.mock.calls[0][0].select;
    expect(Object.keys(patientSelect).sort()).toEqual(['dateNaissance', 'id', 'sexe', 'utilisateur']);
    expect(patientSelect.allergies).toBeUndefined();
    expect(patientSelect.maladiesChroniques).toBeUndefined();

    const demandeSelect = prisma.demandeAnalyse.findMany.mock.calls[0][0].select;
    // Aucun resultat : le comptoir n'est pas l'endroit pour les lire.
    expect(demandeSelect.lignes.select.resultat).toBeUndefined();
    expect(demandeSelect.commentaireLaboratoire).toBeUndefined();
  });

  it('classe par urgence puis par anciennete, comme la file', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(patientRow);
    prisma.demandeAnalyse.findMany.mockResolvedValue([]);

    await scanPatient(laborantin, 'DEMO-QR');

    expect(prisma.demandeAnalyse.findMany.mock.calls[0][0].orderBy)
      .toEqual([{ urgence: 'desc' }, { creeLe: 'asc' }]);
  });
});
