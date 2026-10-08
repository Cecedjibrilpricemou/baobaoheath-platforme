// Le comptoir et l'assurance cherchent le patient de la meme facon.
//
// **Le predicat a ete extrait pour etre partage, pas pour etre range.** Si les
// deux chemins divergent, un patient trouvable a l'admission devient
// introuvable quand on lui rattache une police — et la police reste en
// suspens sans que personne ne sache pourquoi.
//
// Les tests existants simulent `findMany` : ils ne regardent jamais le filtre
// produit. C'est exactement ce que ce fichier regarde.
import { filtreRecherchePatient, rechercherPatients } from '../src/services/hopital.service';
import { rechercherPatientsPourContrat } from '../src/services/assurance.service';
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    patientProfile: { findMany: jest.fn() },
  };
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { utilisateur: { findUnique: M }; patientProfile: { findMany: M } };
};

const UN_PATIENT = [{
  id: 'pat-1', sexe: 'F', dateNaissance: new Date('1974-01-01'), prefecture: 'Kindia',
  utilisateur: { prenom: 'Awa', nom: 'Diallo', telephone: '620123456' },
  episodes: [],
}];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.patientProfile.findMany.mockResolvedValue(UN_PATIENT);
  // L'agent du comptoir appartient a une structure ; l'administration non.
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'str-1', medecinProfile: null });
});

describe('filtreRecherchePatient', () => {
  it('cherche le QR tel quel : il est scanne, pas tape', () => {
    const f = filtreRecherchePatient('QR-ABC-123');
    expect(f.OR?.[0]).toEqual({ qrCode: 'QR-ABC-123' });
  });

  // « 620 123 456 » lu sur une carte ne doit pas rater « 620123456 » en base.
  it('retire les espaces du numero', () => {
    const f = filtreRecherchePatient('620 123 456');
    expect(JSON.stringify(f)).toContain('620123456');
  });

  // Chaque mot doit porter : « Diallo Ma » trouve Mamadou Diallo, et non tous
  // les Diallo du pays.
  it('exige que chaque mot apparaisse dans le nom ou le prenom', () => {
    const et = (filtreRecherchePatient('Diallo Ma').OR?.[2] as { AND: unknown[] }).AND;
    expect(et).toHaveLength(2);
    expect(JSON.stringify(et)).toContain('Diallo');
    expect(JSON.stringify(et)).toContain('"Ma"');
  });

  it('ignore la casse : personne ne tape les majuscules au comptoir', () => {
    expect(JSON.stringify(filtreRecherchePatient('diallo'))).toContain('insensitive');
  });
});

describe('les deux chemins cherchent pareil', () => {
  it('le comptoir passe le predicat partage', async () => {
    await rechercherPatients({ userId: 'u-1', role: 'AGENT_ACCUEIL' } as never, 'Diallo');
    expect(prisma.patientProfile.findMany.mock.calls[0]![0].where)
      .toEqual(filtreRecherchePatient('Diallo'));
  });

  it("l'assurance passe le meme", async () => {
    await rechercherPatientsPourContrat('Diallo');
    expect(prisma.patientProfile.findMany.mock.calls[0]![0].where)
      .toEqual(filtreRecherchePatient('Diallo'));
  });

  it('et le meme terme donne le meme filtre des deux cotes', async () => {
    await rechercherPatients({ userId: 'u-1', role: 'AGENT_ACCUEIL' } as never, 'Diallo Ma');
    const cote1 = prisma.patientProfile.findMany.mock.calls[0]![0].where;
    prisma.patientProfile.findMany.mockClear();
    await rechercherPatientsPourContrat('Diallo Ma');
    expect(prisma.patientProfile.findMany.mock.calls[0]![0].where).toEqual(cote1);
  });
});

describe('rechercherPatientsPourContrat', () => {
  it('exige au moins 3 caracteres, comme au comptoir', async () => {
    await expect(rechercherPatientsPourContrat('Di')).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.patientProfile.findMany).not.toHaveBeenCalled();
  });

  it('masque le numero : il sert a distinguer, pas a appeler', async () => {
    const [r] = await rechercherPatientsPourContrat('Diallo');
    expect(r!.telephoneMasque).toBe('••••••456');
  });

  // Une police se rattache a une personne, pas a un passage : l'administration
  // n'appartient a aucune structure et ne doit pas dependre d'un episode.
  it("ne demande aucun episode : l'administration n'a pas de structure", async () => {
    await rechercherPatientsPourContrat('Diallo');
    const select = prisma.patientProfile.findMany.mock.calls[0]![0].select;
    expect(select.episodes).toBeUndefined();
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });

  it('ne laisse filtrer aucune donnee medicale', async () => {
    const [r] = await rechercherPatientsPourContrat('Diallo');
    expect(Object.keys(r!).sort()).toEqual(
      ['dateNaissance', 'id', 'nom', 'prefecture', 'prenom', 'sexe', 'telephoneMasque']);
  });
});
