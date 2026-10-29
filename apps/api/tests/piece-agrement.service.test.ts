// Les pieces d'agrement des structures privees.
//
// **La creation n'exigeait aucune preuve reglementaire.** Les trois portes
// acceptaient un nom, une prefecture et un telephone : une pharmacie sans
// agrement, une clinique sans autorisation d'exploitation entraient comme les
// autres, et rien ne permettait de faire la difference.
//
// Ce fichier tient trois choses que le reste du code ne peut pas garantir :
// que le blocage porte sur les bons types, que ce sont les **octets** qui
// decident d'un PDF, et que le RCCM reste tolerant.
jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn() },
    structureSante: { findUnique: jest.fn() },
    pieceAgrement: { findUnique: jest.fn(), findMany: jest.fn(), createMany: jest.fn(), delete: jest.fn() },
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 contenu')),
  },
}));

import { promises as fs } from 'fs';

import {
  cheminPiece, deposerPieces, dossierDe, exigeDesPieces, lirePiece, normaliserRccm,
  PIECES_REQUISES, piecesRequisesPour, validerIdentifiants, validerPieces,
} from '../src/services/piece-agrement.service';
import { estPdf, TAILLE_MAX_PIECE } from '../src/middlewares/upload.middleware';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    structureSante: { findUnique: M };
    pieceAgrement: { findUnique: M; findMany: M; createMany: M; delete: M };
    $transaction: M;
  };
};

const qui = (role: string, userId = 'u-1') => ({ userId, role, sessionId: 's' }) as unknown as JwtPayload;

const NATIONAL = qui('ADMIN_NATIONAL', 'u-nat');
const ADMIN = qui('ADMIN_STRUCTURE', 'u-adm');

/** Un PDF minimal. C'est la signature de tete qui fait foi. */
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');

const DOSSIER = {
  rccm: 'GN.TCC.2026.A.14724',
  numeroAgrementCreation: 'ARR/2026/MSHP/0123',
  numeroAgrementExploitation: 'ARR/2026/MSHP/0456',
  lieuAutorise: 'Quartier Donka, Dixinn, Conakry',
};

const QUATRE = [
  { fieldname: 'AGREMENT_CREATION', buffer: PDF },
  { fieldname: 'AGREMENT_EXPLOITATION', buffer: PDF },
  { fieldname: 'DIPLOME_RESPONSABLE', buffer: PDF },
  { fieldname: 'INSCRIPTION_ORDRE', buffer: PDF },
];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  (fs.writeFile as unknown as M).mockResolvedValue(undefined);
  (fs.unlink as unknown as M).mockResolvedValue(undefined);
  (fs.readFile as unknown as M).mockResolvedValue(Buffer.from('%PDF-1.7 contenu'));
});

// ── Qui doit produire un dossier ─────────────────────────────────────

describe('qui doit produire un dossier', () => {
  it.each(['PHARMACIE', 'CLINIQUE', 'LABORATOIRE', 'ASSURANCE'])(
    '%s en produit un',
    (type) => {
      expect(exigeDesPieces(type)).toBe(true);
    },
  );

  // **Un CHU n'a pas d'agrement prive a fournir.** Le lui demander serait un
  // obstacle invente, et bloquerait le peuplement de la plateforme.
  it.each(['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU'])(
    'le public (%s) n en produit aucun',
    (type) => {
      expect(exigeDesPieces(type)).toBe(false);
      expect(piecesRequisesPour(type)).toEqual([]);
    },
  );

  // Le defaut va vers l'exemption : un type ajoute a l'enum sans etre pense
  // ici ne doit pas bloquer, il doit passer.
  it('un type inconnu n exige rien', () => {
    expect(exigeDesPieces('TYPE_QUI_N_EXISTE_PAS')).toBe(false);
  });

  it('les trois types sanitaires exigent les quatre memes pieces', () => {
    for (const type of ['PHARMACIE', 'CLINIQUE', 'LABORATOIRE']) {
      expect([...piecesRequisesPour(type)].sort()).toEqual([
        'AGREMENT_CREATION', 'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE',
      ]);
    }
  });

  // L'assureur releve de la Banque Centrale, pas du ministere de la Sante : il
  // n'a ni diplome ni ordre professionnel a produire.
  it('l assureur ne produit que son agrement de la Banque Centrale', () => {
    expect(piecesRequisesPour('ASSURANCE')).toEqual(['AGREMENT_ASSURANCE']);
  });

  it('aucun type public ne figure dans la table', () => {
    for (const type of ['POSTE', 'CENTRE', 'HOPITAL_PREF', 'HOPITAL_REG', 'CHU']) {
      expect(PIECES_REQUISES[type as keyof typeof PIECES_REQUISES]).toBeUndefined();
    }
  });
});

// ── Ce qui fait foi : les octets ──────────────────────────────────────

describe('la reconnaissance d un PDF', () => {
  it('accepte un vrai PDF', () => {
    expect(estPdf(PDF)).toBe(true);
  });

  // **`Content-Type` est declaratif.** Le filtre de multer lit l'en-tete
  // envoye par le client : un fichier renomme le passe.
  it.each([
    ['du HTML', '<html><script>alert(1)</script></html>'],
    ['un script', '#!/bin/sh\nrm -rf /'],
    ['du texte', 'ceci est mon agrement, promis'],
    ['une signature decalee', 'XX%PDF-1.7'],
    ['un fichier vide', ''],
  ])('refuse %s', (_quoi, contenu) => {
    expect(estPdf(Buffer.from(contenu))).toBe(false);
  });

  it('refuse un fichier qui ne contient que la signature', () => {
    expect(estPdf(Buffer.from('%PDF-'))).toBe(false);
  });
});

// ── Le RCCM ──────────────────────────────────────────────────────────

describe('le numero RCCM', () => {
  // Les deux formes qui circulent reellement en Guinee. Aucun texte officiel
  // n'en fixe le format : une regex serree refuserait l'une des deux.
  it.each([
    'GN.TCC.2026.A.14724',
    'GC-KAL.2017.B.000123',
    'ENTREPRISE/RCCM/GC-KAL.2018.B.009988',
  ])('accepte %s', (valeur) => {
    expect(() => normaliserRccm(valeur)).not.toThrow();
  });

  it('normalise la casse et les espaces', () => {
    expect(normaliserRccm('  gn.tcc.2026.a.14724 ')).toBe('GN.TCC.2026.A.14724');
    expect(normaliserRccm('GN TCC 2026 A 14724')).toBe('GNTCC2026A14724');
  });

  it('refuse un numero trop court', () => {
    expect(() => normaliserRccm('GN.1')).toThrow(ValidationError);
  });

  it('refuse des caracteres qui ne sont pas d un registre', () => {
    expect(() => normaliserRccm('GN.TCC.2026;DROP TABLE')).toThrow(ValidationError);
  });
});

// ── Les identifiants reglementaires ──────────────────────────────────

describe('les identifiants exiges', () => {
  it('accepte un dossier sanitaire complet', () => {
    const v = validerIdentifiants('CLINIQUE', DOSSIER);
    expect(v.rccm).toBe('GN.TCC.2026.A.14724');
    expect(v.numeroAgrementExploitation).toBe('ARR/2026/MSHP/0456');
  });

  it.each([
    ['rccm', 'le numéro RCCM'],
    ['lieuAutorise', "le lieu autorisé"],
    ['numeroAgrementCreation', "l'agrément de création"],
    ['numeroAgrementExploitation', "l'agrément d'exploitation"],
  ])('nomme %s quand il manque', (champ, attendu) => {
    const partiel = { ...DOSSIER, [champ]: undefined };
    expect(() => validerIdentifiants('LABORATOIRE', partiel)).toThrow(new RegExp(attendu, 'i'));
  });

  // Une chaine d'espaces n'est pas un numero : sinon le blocage se contourne
  // en tapant une barre d'espace.
  it('ne prend pas des espaces pour un numero', () => {
    expect(() => validerIdentifiants('CLINIQUE', { ...DOSSIER, rccm: '   ' })).toThrow(ValidationError);
  });

  // Il n'y a pas d'arrete d'exploitation distinct a la Banque Centrale : garder
  // la valeur laisserait en base un champ que personne ne saurait interpreter.
  it('l assureur n a qu une reference, et l autre est ecartee', () => {
    const v = validerIdentifiants('ASSURANCE', {
      ...DOSSIER, numeroAgrementCreation: 'D/2009/CAM/LOA/07',
    });
    expect(v.numeroAgrementCreation).toBe('D/2009/CAM/LOA/07');
    expect(v.numeroAgrementExploitation).toBeNull();
  });

  it('une structure publique n a rien a fournir', () => {
    const v = validerIdentifiants('CHU', {});
    expect(v).toEqual({
      rccm: null, numeroAgrementCreation: null, numeroAgrementExploitation: null, lieuAutorise: null,
    });
  });

  // Elle peut quand meme en donner : un hopital public a un RCCM si on le
  // connait. On l'enregistre sans l'exiger.
  it('une structure publique peut en fournir quand meme', () => {
    expect(validerIdentifiants('CHU', { rccm: 'GN.TCC.2020.A.00001' }).rccm)
      .toBe('GN.TCC.2020.A.00001');
  });
});

// ── Les pieces elles-memes ───────────────────────────────────────────

describe('la validation des pieces', () => {
  it('accepte les quatre pieces attendues', () => {
    expect(validerPieces('CLINIQUE', QUATRE)).toHaveLength(4);
  });

  it('nomme ce qui manque, au lieu de dire « incomplet »', () => {
    expect(() => validerPieces('CLINIQUE', QUATRE.slice(0, 2)))
      .toThrow(/diplôme légalisé du responsable.*inscription à l'ordre/i);
  });

  // Le nom de champ vient du client : jamais accepte tel quel.
  it('refuse un nom de champ qui ne nomme pas une piece', () => {
    expect(() => validerPieces('CLINIQUE', [{ fieldname: '../../etc/passwd', buffer: PDF }]))
      .toThrow(/Pièce inconnue/i);
  });

  it('refuse deux fois la meme piece', () => {
    expect(() => validerPieces('CLINIQUE', [...QUATRE, { fieldname: 'AGREMENT_CREATION', buffer: PDF }]))
      .toThrow(/deux fois/i);
  });

  it('refuse un fichier vide', () => {
    const vide = QUATRE.map((p) => (p.fieldname === 'INSCRIPTION_ORDRE'
      ? { ...p, buffer: Buffer.alloc(0) } : p));
    expect(() => validerPieces('CLINIQUE', vide)).toThrow(/fichier vide/i);
  });

  // La limite de multer s'applique au transport ; celle-ci s'applique au
  // contenu, pour les appels qui ne passent pas par multer.
  it('refuse une piece au-dela de la limite', () => {
    const gros = Buffer.concat([PDF, Buffer.alloc(TAILLE_MAX_PIECE)]);
    expect(() => validerPieces('CLINIQUE', [{ fieldname: 'AGREMENT_CREATION', buffer: gros }]))
      .toThrow(/5 Mo/i);
  });

  // `AUTRE` ne dit rien de lui-meme : sans libelle, la piece est illisible
  // dans la liste du dossier.
  it('refuse une piece complementaire sans libelle', () => {
    expect(() => validerPieces('CHU', [{ fieldname: 'AUTRE', buffer: PDF }]))
      .toThrow(/libellé/i);
  });

  it('accepte plusieurs pieces complementaires, chacune libellee', () => {
    const pieces = [
      { fieldname: 'AUTRE', buffer: PDF },
      { fieldname: 'AUTRE', buffer: PDF },
    ];
    expect(validerPieces('CHU', pieces, { AUTRE: 'Plan architectural' })).toHaveLength(2);
  });
});

// ── Le chemin du fichier ─────────────────────────────────────────────

describe('le chemin d une piece', () => {
  it('accepte un nom genere', () => {
    expect(() => cheminPiece('0191f4aa-2b3c-7d8e-9f01-23456789abcd.pdf')).not.toThrow();
  });

  // Le nom vient de la base : une ecriture directe pourrait y glisser un
  // chemin. La regex est la seconde barriere, apres le CHECK SQL.
  it.each([
    '../../../etc/passwd',
    '../../.env',
    'agrement.pdf.exe',
    'agrement.png',
    'dossier/agrement.pdf',
  ])('refuse %s', (nom) => {
    expect(() => cheminPiece(nom)).toThrow(NotFoundError);
  });
});

// ── Le perimetre de lecture ──────────────────────────────────────────

describe('qui peut lire une piece', () => {
  beforeEach(() => {
    prisma.pieceAgrement.findUnique.mockResolvedValue({
      fichier: 'aaaa-bbbb.pdf', type: 'AGREMENT_CREATION', idStructure: 'donka',
    });
  });

  it('l administration nationale lit tout', async () => {
    const r = await lirePiece(NATIONAL, 'p-1');
    expect(r.fichier).toBe('aaaa-bbbb.pdf');
  });

  it('l administrateur de la structure lit la sienne', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'donka' });
    await expect(lirePiece(ADMIN, 'p-1')).resolves.toBeDefined();
  });

  // **Une piece d'ailleurs se traite comme une piece inconnue** : un 403
  // confirmerait qu'elle existe.
  it('ne dit pas a un administrateur d ailleurs que la piece existe', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'autre-hopital' });
    await expect(lirePiece(ADMIN, 'p-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['MEDECIN', 'PHARMACIEN', 'PATIENT', 'ASSUREUR', 'TECHNICIEN_LABO', 'LIVREUR'])(
    'refuse %s',
    async (role) => {
      await expect(lirePiece(qui(role), 'p-1')).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it('ne lit pas le disque pour une piece inconnue', async () => {
    prisma.pieceAgrement.findUnique.mockResolvedValue(null);
    await expect(lirePiece(NATIONAL, 'p-absente')).rejects.toBeInstanceOf(NotFoundError);
    expect(fs.readFile).not.toHaveBeenCalled();
  });
});

// ── L etat du dossier ────────────────────────────────────────────────

describe('l etat du dossier', () => {
  it('dit complet quand les quatre pieces sont la', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({
      id: 'cl-1', nom: 'Clinique Kipe', type: 'CLINIQUE',
      rccm: 'GN.TCC.2026.A.1', numeroAgrementCreation: 'A', numeroAgrementExploitation: 'B',
      lieuAutorise: 'Kipe',
      piecesAgrement: QUATRE.map((p, i) => ({
        id: `p-${i}`, type: p.fieldname, taille: 1024, libelle: null, deposeLe: new Date(),
      })),
    });

    const d = await dossierDe('cl-1');
    expect(d.complet).toBe(true);
    expect(d.manquantes).toEqual([]);
  });

  it('nomme les pieces absentes', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({
      id: 'cl-1', nom: 'Clinique Kipe', type: 'CLINIQUE',
      rccm: null, numeroAgrementCreation: null, numeroAgrementExploitation: null, lieuAutorise: null,
      piecesAgrement: [{
        id: 'p-0', type: 'AGREMENT_CREATION', taille: 1024, libelle: null, deposeLe: new Date(),
      }],
    });

    const d = await dossierDe('cl-1');
    expect(d.complet).toBe(false);
    expect([...d.manquantes].sort()).toEqual([
      'AGREMENT_EXPLOITATION', 'DIPLOME_RESPONSABLE', 'INSCRIPTION_ORDRE',
    ]);
  });

  // Une structure publique est complete sans rien deposer, et c'est juste.
  it('dit complet pour une structure publique vide', async () => {
    prisma.structureSante.findUnique.mockResolvedValue({
      id: 'chu-1', nom: 'Hopital Donka', type: 'CHU',
      rccm: null, numeroAgrementCreation: null, numeroAgrementExploitation: null, lieuAutorise: null,
      piecesAgrement: [],
    });

    const d = await dossierDe('chu-1');
    expect(d.complet).toBe(true);
    expect(d.exigeDesPieces).toBe(false);
  });
});

// ── Le renouvellement ────────────────────────────────────────────────

describe('deposer et remplacer une piece', () => {
  beforeEach(() => {
    // Le meme mock sert deux lectures : le controle d'entree, puis
    // `dossierDe` que `deposerPieces` renvoie en fin de course.
    prisma.structureSante.findUnique.mockResolvedValue({
      id: 'cl-1', type: 'CLINIQUE', nom: 'Clinique Kipe',
      rccm: null, numeroAgrementCreation: null, numeroAgrementExploitation: null, lieuAutorise: null,
      piecesAgrement: [],
    });
    prisma.pieceAgrement.findMany.mockResolvedValue([]);
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'cl-1' });
  });

  // **Un agrement se renouvelle.** Remplacer la piece expiree doit etre un
  // geste, pas une recreation de la structure.
  it('remplace la piece du meme type', async () => {
    prisma.pieceAgrement.findMany.mockResolvedValue([{ id: 'ancienne', fichier: 'vieux.pdf' }]);

    await deposerPieces(ADMIN, 'cl-1', [{ fieldname: 'AGREMENT_EXPLOITATION', buffer: PDF }]);

    expect(prisma.pieceAgrement.delete).toHaveBeenCalledWith({ where: { id: 'ancienne' } });
    expect(prisma.pieceAgrement.createMany).toHaveBeenCalledTimes(1);
  });

  // **L'ancien fichier ne part qu'apres le commit.** Si la transaction avait
  // echoue, la piece en vigueur doit rester lisible.
  it('ne supprime l ancien fichier qu apres le commit', async () => {
    prisma.pieceAgrement.findMany.mockResolvedValue([{ id: 'ancienne', fichier: 'vieux.pdf' }]);
    prisma.$transaction.mockRejectedValue(new Error('base indisponible'));

    await expect(deposerPieces(ADMIN, 'cl-1', [{ fieldname: 'AGREMENT_EXPLOITATION', buffer: PDF }]))
      .rejects.toThrow('base indisponible');

    const supprimes = (fs.unlink as unknown as M).mock.calls.map((c) => String(c[0]));
    expect(supprimes.some((p) => p.endsWith('vieux.pdf'))).toBe(false);
  });

  // Completer piece par piece doit rester possible : exiger les quatre d'un
  // coup empecherait de rattraper un dossier ancien.
  it('n exige pas un dossier complet pour completer', async () => {
    await expect(deposerPieces(ADMIN, 'cl-1', [{ fieldname: 'DIPLOME_RESPONSABLE', buffer: PDF }]))
      .resolves.toBeDefined();
  });

  it('refuse un depot vide', async () => {
    await expect(deposerPieces(ADMIN, 'cl-1', [])).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse un administrateur d une autre structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'autre' });
    await expect(deposerPieces(ADMIN, 'cl-1', [{ fieldname: 'DIPLOME_RESPONSABLE', buffer: PDF }]))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  // Rien ne doit rester d'une transaction qui echoue : ni ligne, ni fichier.
  it('supprime les fichiers ecrits si la transaction echoue', async () => {
    prisma.$transaction.mockRejectedValue(new Error('base indisponible'));

    await expect(deposerPieces(ADMIN, 'cl-1', [{ fieldname: 'DIPLOME_RESPONSABLE', buffer: PDF }]))
      .rejects.toThrow('base indisponible');
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });
});
