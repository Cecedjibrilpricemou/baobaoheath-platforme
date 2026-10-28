// Ce qu'un laboratoire sait faire, et qui le medecin peut solliciter (EF-04).
//
// **Le renvoi vers un laboratoire se faisait a l'aveugle.**
// `listerLaboratoires` rendait tous les laboratoires actifs du pays, sans
// filtre sur leur plateau technique ni sur la geographie : le medecin
// prescrivait dans une liste plate, le laboratoire recevait la demande et
// decouvrait qu'il ne realisait pas l'examen. Le patient, lui, s'etait
// deplace.
//
// Et `TYPES_LABO` excluait `CLINIQUE` : adresser un patient a une clinique
// conseillee etait impossible, le filtre s'appliquant a la liste **et** a la
// creation de la demande.
jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    structureSante: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    structureConseillee: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    plateauTechnique: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    examen: { findMany: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    structureSante: { findUnique: M; findFirst: M; findMany: M };
    structureConseillee: { findMany: M; create: M; deleteMany: M };
    plateauTechnique: { findMany: M; deleteMany: M; createMany: M };
    examen: { findMany: M };
    $transaction: M;
  };
};

import {
  conseiller, examensNonCouverts, laboratoiresCandidats, laboratoiresPour, retirerConseil,
  TYPES_RECEVEURS,
} from '../src/services/plateau-technique.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

const qui = (role: string, userId = 'u-1') =>
  ({ userId, role, sessionId: 's' }) as unknown as JwtPayload;

const MEDECIN = qui('MEDECIN', 'u-med');
const ADMIN = qui('ADMIN_STRUCTURE', 'u-adm');

const DONKA = { id: 'donka', nom: 'Hopital Donka', type: 'CHU', prefecture: 'Conakry', estActive: true };
const CECE = { id: 'cece', nom: 'Laboratoire Cece', type: 'LABORATOIRE', prefecture: 'Conakry' };
const KIPE = { id: 'kipe', nom: 'Clinique Kipe', type: 'CLINIQUE', prefecture: 'Conakry' };

const EXAMENS = [
  { id: 'e1', libelle: 'Hemogramme', codeLoinc: '58410-2' },
  { id: 'e2', libelle: 'TPHA', codeLoinc: '22592-7' },
  { id: 'e3', libelle: 'VDRL', codeLoinc: '5292-8' },
];
const IDS = EXAMENS.map((e) => e.id);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'donka', medecinProfile: null });
  prisma.structureSante.findUnique.mockResolvedValue(DONKA);
  prisma.structureSante.findFirst.mockResolvedValue(null); // aucun laboratoire fils
  prisma.structureSante.findMany.mockResolvedValue([]);
  prisma.structureConseillee.findMany.mockResolvedValue([]);
  prisma.plateauTechnique.findMany.mockResolvedValue([]);
  prisma.examen.findMany.mockResolvedValue(EXAMENS);
});

describe('qui peut recevoir une demande d analyse', () => {
  // Son absence rendait impossible le parcours decrit : « le medecin envoie
  // vers le laboratoire de son hopital, ou vers une clinique conseillee ».
  it('inclut la clinique', () => {
    expect(TYPES_RECEVEURS).toContain('CLINIQUE');
  });

  it('et les laboratoires comme les hopitaux', () => {
    for (const t of ['LABORATOIRE', 'CHU', 'HOPITAL_REG', 'HOPITAL_PREF']) {
      expect(TYPES_RECEVEURS).toContain(t);
    }
  });
});

describe('le laboratoire « chez nous »', () => {
  // `idStructureParente` sert deja a la pharmacie hospitaliere. Le repli sur
  // la structure elle-meme evite toute migration de donnees tout en rendant le
  // modele propre disponible des qu'un etablissement cree son laboratoire.
  it('est le laboratoire fils quand il existe', async () => {
    const fils = { id: 'labo-donka', nom: 'Laboratoire de Donka', type: 'LABORATOIRE', prefecture: 'Conakry' };
    prisma.structureSante.findFirst.mockResolvedValue(fils);

    const r = await laboratoiresPour(MEDECIN, IDS);
    expect(r.interne.map((l) => l.id)).toEqual(['labo-donka']);
  });

  it('est la structure elle-meme quand elle n a pas de laboratoire fils', async () => {
    const r = await laboratoiresPour(MEDECIN, IDS);
    expect(r.interne.map((l) => l.id)).toEqual(['donka']);
    expect(r.interne[0]?.origine).toBe('INTERNE');
  });

  // Une pharmacie ou un assureur ne recoit pas d'analyse : sa structure ne
  // doit pas se proposer elle-meme.
  it('est vide quand la structure ne recoit pas de demande', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({ ...DONKA, type: 'PHARMACIE' });
    const r = await laboratoiresPour(MEDECIN, IDS);
    expect(r.interne).toEqual([]);
  });
});

describe('la couverture des examens', () => {
  function plateau(idStructure: string, idsRealises: string[]) {
    return idsRealises.map((idExamen) => ({ idStructure, idExamen, actif: true }));
  }

  it('compte exactement, et nomme ce qui manque', async () => {
    prisma.structureSante.findMany.mockResolvedValue([CECE]);
    prisma.plateauTechnique.findMany.mockResolvedValue(plateau('cece', ['e1']));

    const r = await laboratoiresPour(MEDECIN, IDS);
    const cece = r.autres.find((l) => l.id === 'cece')!;
    expect(cece.couverts).toBe(1);
    expect(cece.demandes).toBe(3);
    expect(cece.nonCouverts.map((e) => e.libelle).sort()).toEqual(['TPHA', 'VDRL']);
  });

  // **La regle de transition.** Sans elle, toutes les structures existantes
  // disparaitraient des listes le jour du deploiement.
  it('repute tout realisable quand rien n est declare', async () => {
    prisma.structureSante.findMany.mockResolvedValue([CECE]);
    prisma.plateauTechnique.findMany.mockResolvedValue([]);

    const cece = (await laboratoiresPour(MEDECIN, IDS)).autres[0]!;
    expect(cece.plateauNonDeclare).toBe(true);
    expect(cece.couverts).toBe(3);
    expect(cece.nonCouverts).toEqual([]);
  });

  // **Declarer un plateau qui ne couvre rien n'est pas la meme chose que ne
  // rien declarer.** Les confondre rendrait la regle de transition incoherente.
  it('distingue un plateau declare mais sans aucun des examens demandes', async () => {
    prisma.structureSante.findMany.mockResolvedValue([CECE]);
    prisma.plateauTechnique.findMany.mockResolvedValue(
      [{ idStructure: 'cece', idExamen: 'autre-examen', actif: true }],
    );

    const cece = (await laboratoiresPour(MEDECIN, IDS)).autres[0]!;
    expect(cece.plateauNonDeclare).toBe(false);
    expect(cece.couverts).toBe(0);
    expect(cece.nonCouverts).toHaveLength(3);
  });

  it('ne compte pas une ligne desactivee', async () => {
    prisma.structureSante.findMany.mockResolvedValue([CECE]);
    prisma.plateauTechnique.findMany.mockResolvedValue([
      { idStructure: 'cece', idExamen: 'e1', actif: false },
      { idStructure: 'cece', idExamen: 'e2', actif: true },
    ]);

    const cece = (await laboratoiresPour(MEDECIN, IDS)).autres[0]!;
    expect(cece.couverts).toBe(1);
    expect(cece.nonCouverts.map((e) => e.id).sort()).toEqual(['e1', 'e3']);
  });
});

describe('la portee geographique', () => {
  // Filtre par defaut, jamais verrouille : un CHU envoie parfois un
  // prelevement a un laboratoire specialise ailleurs.
  it('se limite a la prefecture par defaut', async () => {
    await laboratoiresPour(MEDECIN, IDS);
    const autres = prisma.structureSante.findMany.mock.calls.at(-1)?.[0] as { where: { prefecture?: string } };
    expect(autres.where.prefecture).toBe('Conakry');
  });

  it('s elargit quand on le demande', async () => {
    const r = await laboratoiresPour(MEDECIN, IDS, true);
    const autres = prisma.structureSante.findMany.mock.calls.at(-1)?.[0] as { where: { prefecture?: string } };
    expect(autres.where.prefecture).toBeUndefined();
    expect(r.toutLePays).toBe(true);
  });
});

describe('les groupes ne se recoupent pas', () => {
  // Une structure conseillee qui serait aussi « chez nous » apparaitrait deux
  // fois, dans deux groupes qui ne disent pas la meme chose.
  it('exclut l interne et les conseilles du groupe « autres »', async () => {
    prisma.structureConseillee.findMany.mockResolvedValue([{ idStructureConseillee: 'cece' }]);
    prisma.structureSante.findMany.mockResolvedValue([CECE]);

    await laboratoiresPour(MEDECIN, IDS);
    const autres = prisma.structureSante.findMany.mock.calls.at(-1)?.[0] as {
      where: { id: { notIn: string[] } };
    };
    expect(autres.where.id.notIn.sort()).toEqual(['cece', 'donka']);
  });
});

describe('les examens non couverts a la creation', () => {
  // **N'interdit rien.** Rend ce qui manque pour que l'ecran puisse le nommer,
  // comme l'alerte d'allergie : on ne bloque pas, on fait dire qu'on a vu.
  it('nomme les examens que le laboratoire ne realise pas', async () => {
    prisma.plateauTechnique.findMany.mockResolvedValue([
      { idStructure: 'cece', idExamen: 'e1', actif: true },
    ]);
    prisma.examen.findMany.mockResolvedValue([EXAMENS[1], EXAMENS[2]]);

    const manquants = await examensNonCouverts('cece', IDS);
    expect(manquants.map((e) => e.libelle)).toEqual(['TPHA', 'VDRL']);
  });

  it('ne rend rien quand le laboratoire n a rien declare', async () => {
    prisma.plateauTechnique.findMany.mockResolvedValue([]);
    expect(await examensNonCouverts('cece', IDS)).toEqual([]);
    expect(prisma.examen.findMany).not.toHaveBeenCalled();
  });
});

describe('le carnet d adresses', () => {
  beforeEach(() => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'donka', medecinProfile: null });
    prisma.structureSante.findFirst.mockResolvedValue(KIPE);
    prisma.structureConseillee.create.mockResolvedValue({ id: 'sc-1', declareLe: new Date() });
  });

  it('se declare par l administrateur de la structure', async () => {
    const r = await conseiller(ADMIN, 'kipe');
    expect(r.nom).toBe('Clinique Kipe');
    const appel = prisma.structureConseillee.create.mock.calls[0]?.[0] as {
      data: { idStructure: string; declarePar: string };
    };
    expect(appel.data).toMatchObject({ idStructure: 'donka', declarePar: 'u-adm' });
  });

  it.each(['MEDECIN', 'TECHNICIEN_LABO', 'ADMIN_NATIONAL', 'PATIENT'])(
    'refuse %s',
    async (role) => {
      await expect(conseiller(qui(role), 'kipe')).rejects.toThrow(ForbiddenError);
      expect(prisma.structureConseillee.create).not.toHaveBeenCalled();
    },
  );

  // Elle figure deja en tete, au titre du laboratoire « chez nous ».
  it('refuse qu une structure se conseille elle-meme', async () => {
    await expect(conseiller(ADMIN, 'donka')).rejects.toThrow(ValidationError);
    expect(prisma.structureConseillee.create).not.toHaveBeenCalled();
  });

  it('refuse une structure qui ne recoit pas de demande d analyse', async () => {
    prisma.structureSante.findFirst.mockResolvedValue(null);
    await expect(conseiller(ADMIN, 'pharmacie-1')).rejects.toThrow(NotFoundError);
  });

  // Le retrait est borne a sa propre structure : un identifiant d'ailleurs ne
  // retire rien, plutot que de retirer chez le voisin.
  it('ne retire qu un conseil de sa propre structure', async () => {
    prisma.structureConseillee.deleteMany.mockResolvedValue({ count: 1 });
    await retirerConseil(ADMIN, 'sc-1');
    const appel = prisma.structureConseillee.deleteMany.mock.calls[0]?.[0] as {
      where: { id: string; idStructure: string };
    };
    expect(appel.where).toEqual({ id: 'sc-1', idStructure: 'donka' });
  });

  it('refuse un retrait qui ne correspond a rien chez lui', async () => {
    prisma.structureConseillee.deleteMany.mockResolvedValue({ count: 0 });
    await expect(retirerConseil(ADMIN, 'sc-ailleurs')).rejects.toThrow(NotFoundError);
  });
});

// **Un formulaire qui offre une erreur garantie n'est pas un formulaire.**
// La base refuse qu'une structure se conseille elle-meme (contrainte
// `structures_conseillees_pas_soi_meme`) et refuse le doublon (index unique).
// La liste de choix doit donc exclure les deux, sinon l'ecran propose des
// options dont l'echec est connu d'avance.
describe('ou l administrateur choisit qui conseiller', () => {
  beforeEach(() => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'donka', medecinProfile: null });
    prisma.structureSante.findMany.mockResolvedValue([CECE, KIPE]);
  });

  it('exclut sa propre structure et celles deja conseillees', async () => {
    prisma.structureConseillee.findMany.mockResolvedValue([{ idStructureConseillee: 'cece' }]);
    await laboratoiresCandidats(ADMIN);

    const appel = prisma.structureSante.findMany.mock.calls[0]?.[0] as {
      where: { estActive: boolean; id: { notIn: string[] }; type: { in: string[] } };
    };
    expect(appel.where.id.notIn.sort()).toEqual(['cece', 'donka']);
    expect(appel.where.estActive).toBe(true);
  });

  it('exclut sa propre structure meme quand rien n est encore conseille', async () => {
    prisma.structureConseillee.findMany.mockResolvedValue([]);
    await laboratoiresCandidats(ADMIN);

    const appel = prisma.structureSante.findMany.mock.calls[0]?.[0] as {
      where: { id: { notIn: string[] } };
    };
    expect(appel.where.id.notIn).toEqual(['donka']);
  });

  // Une pharmacie ou un poste de sante ne recoit pas de demande d'analyse :
  // le proposer serait un choix mort.
  it('ne propose que des structures qui recoivent des demandes', async () => {
    prisma.structureConseillee.findMany.mockResolvedValue([]);
    await laboratoiresCandidats(ADMIN);

    const appel = prisma.structureSante.findMany.mock.calls[0]?.[0] as {
      where: { type: { in: string[] } };
    };
    expect(appel.where.type.in.sort()).toEqual([...TYPES_RECEVEURS].sort());
    expect(appel.where.type.in).not.toContain('PHARMACIE');
  });

  // Le perimetre est celui de l'appelant : seul l'administrateur de structure
  // a un carnet d'adresses a tenir.
  it.each(['MEDECIN', 'TECHNICIEN_LABO', 'ADMIN_NATIONAL', 'PATIENT'])(
    'refuse %s',
    async (role) => {
      await expect(laboratoiresCandidats(qui(role))).rejects.toThrow(ForbiddenError);
      expect(prisma.structureSante.findMany).not.toHaveBeenCalled();
    },
  );
});
