import { creerAgent, creerPharmacieAvecPharmacien } from '../src/services/admin-structure.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), create: jest.fn() },
    structureSante: { findUnique: jest.fn(), create: jest.fn() },
    pharmacienProfile: { create: jest.fn() },
    pieceAgrement: { createMany: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
// Les pieces d'agrement s'ecrivent sur le disque : sans ce mock, chaque
// execution deposerait des fichiers dans `stockage-prive/`.
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  promises: { writeFile: jest.fn().mockResolvedValue(undefined), unlink: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../src/utils/password.utils', () => ({ hashPassword: jest.fn().mockResolvedValue('hashed') }));
jest.mock('../src/services/email.service', () => ({
  envoyerEmailAdminStructure: jest.fn(),
  envoyerEmailAgent: jest.fn(),
}));

type Mock = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: Mock; create: Mock };
    structureSante: { findUnique: Mock; create: Mock };
    pharmacienProfile: { create: Mock };
    pieceAgrement: { createMany: Mock; findMany: Mock; delete: Mock };
    $transaction: Mock;
  };
};

/**
 * Le dossier reglementaire d'une officine independante.
 *
 * **Une pharmacie independante ne se cree plus sans lui** (decision du
 * 2026-10-28). Une pharmacie hospitaliere, elle, opere sous l'autorisation de
 * son hopital et n'en produit aucun : c'est pourquoi les tests de parent n'ont
 * pas eu a changer.
 */
const DOSSIER = {
  rccm: 'GN.TCC.2026.A.14724',
  numeroAgrementCreation: 'ARR/2026/MSHP/0123',
  numeroAgrementExploitation: 'ARR/2026/MSHP/0456',
  lieuAutorise: 'Quartier Donka, Dixinn, Conakry',
};

/** Un PDF minimal : c'est la signature de tete qui fait foi, pas l'extension. */
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');

const PIECES = [
  { fieldname: 'AGREMENT_CREATION', buffer: PDF },
  { fieldname: 'AGREMENT_EXPLOITATION', buffer: PDF },
  { fieldname: 'DIPLOME_RESPONSABLE', buffer: PDF },
  { fieldname: 'INSCRIPTION_ORDRE', buffer: PDF },
];

const DTO = {
  nom: 'Pharmacie du CHU',
  prefecture: 'Conakry',
  pharmacien: {
    prenom: 'Aminata',
    nom: 'Diallo',
    telephone: '+224620000001',
  },
};

const SUPER_ADMIN = { userId: 'super-1', role: 'SUPER_ADMIN' } as JwtPayload;
const ADMIN_HOPITAL = { userId: 'admin-h-1', role: 'ADMIN_STRUCTURE' } as JwtPayload;

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue(null);
  prisma.structureSante.findUnique.mockResolvedValue(null);
  prisma.structureSante.create.mockResolvedValue({ id: 'pharmacie-1', type: 'PHARMACIE' });
  prisma.utilisateur.create.mockResolvedValue({
    id: 'pharmacien-1', telephone: DTO.pharmacien.telephone, email: null,
    prenom: DTO.pharmacien.prenom, nom: DTO.pharmacien.nom, role: 'PHARMACIEN',
  });
  prisma.pharmacienProfile.create.mockResolvedValue({});
});

describe('creerPharmacieAvecPharmacien', () => {
  it('crée une pharmacie fille de l’hôpital de son administrateur', async () => {
    prisma.utilisateur.findUnique.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === ADMIN_HOPITAL.userId
        ? { idStructure: 'hopital-1', structure: { type: 'CHU' } }
        : null,
    );

    const result = await creerPharmacieAvecPharmacien(ADMIN_HOPITAL, DTO);

    expect(prisma.structureSante.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PHARMACIE',
        idStructureParente: 'hopital-1',
      }),
    });
    expect(prisma.utilisateur.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idStructure: 'pharmacie-1', role: 'PHARMACIEN' }),
    });
    expect(prisma.pharmacienProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idUtilisateur: 'pharmacien-1',
        idStructure: 'pharmacie-1',
        roleOfficine: 'TITULAIRE',
      }),
    });
    expect(result.structure).toEqual({ id: 'pharmacie-1', type: 'PHARMACIE' });
  });

  it('refuse à un administrateur hospitalier de choisir un autre parent', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'hopital-1',
      structure: { type: 'CHU' },
    });

    await expect(creerPharmacieAvecPharmacien(ADMIN_HOPITAL, {
      ...DTO,
      idStructureParente: 'hopital-2',
    })).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('refuse la création depuis une structure qui n’est pas un hôpital', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'centre-1',
      structure: { type: 'CENTRE' },
    });

    await expect(creerPharmacieAvecPharmacien(ADMIN_HOPITAL, DTO))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('permet au super-admin de créer une pharmacie indépendante avec son dossier', async () => {
    const result = await creerPharmacieAvecPharmacien(SUPER_ADMIN, { ...DTO, ...DOSSIER }, PIECES);

    expect(prisma.structureSante.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PHARMACIE',
        idStructureParente: null,
        rccm: 'GN.TCC.2026.A.14724',
        lieuAutorise: 'Quartier Donka, Dixinn, Conakry',
      }),
    });
    // Les quatre pieces sont enregistrees avec la structure, dans la meme
    // transaction : une pharmacie a demi documentee n'existe pas.
    expect(prisma.pieceAgrement.createMany).toHaveBeenCalledTimes(1);
    const appel = prisma.pieceAgrement.createMany.mock.calls[0]?.[0] as {
      data: { type: string; idStructure: string }[];
    };
    expect(appel.data.map((p) => p.type).sort()).toEqual([
      'AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE',
    ]);
    expect(result.structure.id).toBe('pharmacie-1');
  });

  // **Le blocage, teste de face.** C'est la decision du 2026-10-28 : une
  // officine independante n'entre pas sur la plateforme sans ses pieces.
  it('refuse une pharmacie indépendante sans aucune pièce', async () => {
    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, { ...DTO, ...DOSSIER }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('refuse une pharmacie indépendante sans identifiants réglementaires', async () => {
    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, DTO, PIECES))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  // Refuser doit rester **sans effet de bord** : le numero de telephone du
  // pharmacien ne doit pas avoir ete consomme, ni aucun fichier ecrit.
  it('refuse avant de toucher au compte du pharmacien', async () => {
    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, DTO))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
    expect(prisma.pieceAgrement.createMany).not.toHaveBeenCalled();
  });

  // Une piece manquante est **nommee** : « dossier incomplet » n'aide personne
  // a savoir ce qu'il doit aller chercher.
  it('nomme la pièce qui manque', async () => {
    await expect(creerPharmacieAvecPharmacien(
      SUPER_ADMIN,
      { ...DTO, ...DOSSIER },
      PIECES.filter((p) => p.fieldname !== 'INSCRIPTION_ORDRE'),
    )).rejects.toThrow(/inscription à l'ordre professionnel/i);
  });

  // **Ce qui fait foi, ce sont les octets.** `Content-Type` est declaratif :
  // un fichier renomme passerait le filtre de multer.
  it('refuse un fichier qui n’est pas un vrai PDF', async () => {
    const faux = PIECES.map((p) => (p.fieldname === 'DIPLOME_RESPONSABLE'
      ? { ...p, buffer: Buffer.from('<html><script>alert(1)</script></html>') }
      : p));

    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, { ...DTO, ...DOSSIER }, faux))
      .rejects.toThrow(/n'est pas un vrai fichier PDF/i);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  // Une pharmacie hospitaliere n'a pas d'agrement propre : elle existe par
  // celui de son hopital. Lui demander un dossier bloquerait l'hopital qui
  // ouvre sa pharmacie interne.
  it('n’exige aucun dossier pour une pharmacie hospitalière', async () => {
    // `Once` et non `mockResolvedValue` : le service appelle deux fois
    // `utilisateur.findUnique` — l'admin, puis l'unicite du telephone. Le
    // second appel doit retomber sur le `null` du beforeEach.
    prisma.utilisateur.findUnique.mockResolvedValueOnce({
      idStructure: 'hopital-1',
      structure: { type: 'CHU' },
    });

    const result = await creerPharmacieAvecPharmacien(ADMIN_HOPITAL, DTO);

    expect(result.structure.id).toBe('pharmacie-1');
    expect(prisma.pieceAgrement.createMany).not.toHaveBeenCalled();
  });

  it('vérifie que le parent fourni par le super-admin est hospitalier', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({ id: 'pharmacie-parent', type: 'PHARMACIE' });

    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, {
      ...DTO,
      idStructureParente: 'pharmacie-parent',
    })).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.structureSante.create).not.toHaveBeenCalled();
  });

  it('signale un parent inexistant', async () => {
    prisma.structureSante.findUnique.mockResolvedValue(null);

    await expect(creerPharmacieAvecPharmacien(SUPER_ADMIN, {
      ...DTO,
      idStructureParente: 'inconnu',
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('empêche un administrateur hospitalier de créer un pharmacien directement sous l’hôpital', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      idStructure: 'hopital-1',
      structure: { type: 'CHU' },
    });

    await expect(creerAgent('admin-h-1', {
      telephone: '+224620000002',
      email: 'mamadou@example.com',
      prenom: 'Mamadou',
      nom: 'Bah',
      role: 'PHARMACIEN',
    })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse un agent professionnel sans email avant toute création', async () => {
    await expect(creerAgent('admin-h-1', {
      telephone: '+224620000003',
      prenom: 'Mamadou',
      nom: 'Bah',
      role: 'MEDECIN',
    })).rejects.toThrow(/adresse email professionnelle est obligatoire/i);
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
  });
});
