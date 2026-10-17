// Où un patient peut demander à être reçu.
//
// **On ne prend pas rendez-vous chez un pharmacien.** La liste proposée au
// patient renvoyait toutes les structures actives, tous types confondus : son
// écran offrait « Pharmacie Pricemou », « Laboratoire Cécé » et « Pricemou &
// Frère Assurances » comme lieux de consultation. Et le service acceptait
// l'identifiant sans vérifier le type, donc filtrer l'affichage n'aurait rien
// protégé — un identifiant de pharmacie reste un identifiant valide.
//
// Les six types où l'on est reçu : poste et centre de santé, hôpital
// préfectoral, hôpital régional, CHU, clinique.
import { creerDemande } from '../src/services/demande-rendez-vous.service';
import { getStructuresPubliques } from '../src/services/admin-structure.service';
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    patientProfile: { findUnique: jest.fn() },
    structureSante: { findMany: jest.fn(), findFirst: jest.fn() },
    utilisateur: { findFirst: jest.fn(), findMany: jest.fn() },
    demandeRendezVous: { findFirst: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/numero.service', () => ({ prochainNumero: jest.fn() }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn(),
  envoyerSmsSimule: jest.fn(),
}));
jest.mock('../src/services/parametres.service', () => ({
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nom: 'KENEYA' }),
  getValeursParametres: jest.fn().mockResolvedValue({}),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    patientProfile: { findUnique: M };
    structureSante: { findMany: M; findFirst: M };
    utilisateur: { findFirst: M; findMany: M };
    demandeRendezVous: { findFirst: M; create: M };
  };
};

/** Les six types où l'on est reçu, et les trois où l'on ne l'est pas. */
const SOIN = ['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU', 'CLINIQUE'];
const PAS_SOIN = ['PHARMACIE', 'LABORATOIRE', 'ASSURANCE'];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue({
    id: 'p1', idStructurePreferee: null,
    utilisateur: { id: 'u-pat', prenom: 'Maomou', nom: 'Conde', telephone: '620100010' },
  });
  prisma.demandeRendezVous.findFirst.mockResolvedValue(null);
  prisma.demandeRendezVous.create.mockResolvedValue({
    id: 'd1', motif: 'maux de tete', statut: 'EN_ATTENTE', creeLe: new Date(),
    // `dateNaissance` et `sexe` sont sur le patient, pas sur son compte : la
    // vue les lit la, et une doublure mal etagee echoue dans `versVue`.
    patient: {
      id: 'p1', dateNaissance: new Date('1992-03-17'), sexe: 'F',
      utilisateur: { prenom: 'Maomou', nom: 'Conde', telephone: '620100010' },
    },
    structure: { id: 's1', nom: 'Hopital Donka', prefecture: 'Conakry' },
    medecin: null,
  });
  prisma.utilisateur.findMany.mockResolvedValue([]);
});

describe('la liste proposee au patient', () => {
  it('ne retient que les structures ou l on est recu', async () => {
    prisma.structureSante.findMany.mockResolvedValue([]);
    await getStructuresPubliques();

    const appel = prisma.structureSante.findMany.mock.calls[0]?.[0] as {
      where: { estActive: boolean; type?: { in: string[] } };
    };
    expect(appel.where.estActive).toBe(true);
    expect(appel.where.type?.in?.slice().sort()).toEqual([...SOIN].sort());
  });

  it.each(PAS_SOIN)('et %s n y figure pas', async (type) => {
    prisma.structureSante.findMany.mockResolvedValue([]);
    await getStructuresPubliques();
    const appel = prisma.structureSante.findMany.mock.calls[0]?.[0] as {
      where: { type?: { in: string[] } };
    };
    expect(appel.where.type?.in).not.toContain(type);
  });
});

describe('la demande elle-meme', () => {
  // **Filtrer l'affichage ne protege rien.** L'identifiant d'une pharmacie
  // reste un identifiant valide : la verification doit vivre dans le service.
  it('verifie le type cote serveur, pas seulement dans la liste', async () => {
    prisma.structureSante.findFirst.mockResolvedValue({ id: 's1', nom: 'Hopital Donka' });
    await creerDemande('u-pat', { motif: 'maux de tete depuis trois jours', idStructure: 's1' });

    const appel = prisma.structureSante.findFirst.mock.calls[0]?.[0] as {
      where: { estActive: boolean; type?: { in: string[] } };
    };
    expect(appel.where.type?.in?.slice().sort()).toEqual([...SOIN].sort());
  });

  it('refuse une structure qui ne recoit pas de consultation', async () => {
    // Le filtre de type ne la trouve pas : la requete ne rend rien.
    prisma.structureSante.findFirst.mockResolvedValue(null);
    await expect(
      creerDemande('u-pat', { motif: 'maux de tete depuis trois jours', idStructure: 'pharmacie-1' }),
    ).rejects.toThrow(/ne recevant pas de consultation/);
    expect(prisma.demandeRendezVous.create).not.toHaveBeenCalled();
  });

  it('exige un etablissement quand le patient n en a pas de prefere', async () => {
    await expect(creerDemande('u-pat', { motif: 'maux de tete depuis trois jours' }))
      .rejects.toThrow(ValidationError);
  });

  // Un medecin nomme doit exercer dans l'etablissement choisi : demander un
  // praticien d'un autre hopital n'a pas de sens, et le refus le dit.
  it('refuse un medecin qui n exerce pas dans l etablissement choisi', async () => {
    prisma.structureSante.findFirst.mockResolvedValue({ id: 's1', nom: 'Hopital Donka' });
    prisma.utilisateur.findFirst.mockResolvedValue(null);
    await expect(creerDemande('u-pat', {
      motif: 'maux de tete depuis trois jours', idStructure: 's1', idMedecin: 'med-ailleurs',
    })).rejects.toThrow(/n exerce pas/);
  });

  // Une seule demande en attente a la fois : sinon un patient inquiet en
  // envoie cinq, et cinq episodes s'ouvrent pour la meme plainte.
  it('refuse une seconde demande tant que la premiere attend', async () => {
    prisma.structureSante.findFirst.mockResolvedValue({ id: 's1', nom: 'Hopital Donka' });
    prisma.demandeRendezVous.findFirst.mockResolvedValue({ id: 'deja' });
    await expect(creerDemande('u-pat', {
      motif: 'maux de tete depuis trois jours', idStructure: 's1',
    })).rejects.toThrow(/deja une demande/);
  });
});
