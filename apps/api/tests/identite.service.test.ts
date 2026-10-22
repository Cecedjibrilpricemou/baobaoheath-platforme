// Vérifier l'identité d'un patient au comptoir (EF-01-04/10).
//
// **Ce que vérifier veut dire ici** : un agent déclare avoir vu une pièce et
// enregistre laquelle. Ce n'est pas une authentification informatique, c'est
// une personne qui engage sa responsabilité.
//
// **Ce que cela ouvre, et rien de plus** : le tiers payant. Les soins ne
// dépendent pas du niveau d'identité — un patient provisoire est consulté,
// suivi et prescrit normalement. Un ASC qui enregistre quelqu'un en brousse
// n'a pas de pièce à vérifier, et lui refuser le dossier reviendrait à lui
// refuser les soins.
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: { patientProfile: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { patientProfile: { findUnique: M; findMany: M; update: M } };
};

import { masquerNumero, noterTraits, rechercher, verifier } from '../src/services/identite.service';

const AGENT = { userId: 'agent-1', role: 'AGENT_ACCUEIL' as const, sessionId: 's1' };
const MAINTENANT = new Date('2026-10-04T10:00:00.000Z');

const LIGNE = {
  id: 'p1',
  dateNaissance: new Date('1990-05-12'),
  sexe: 'F',
  prefecture: 'Conakry',
  lieuNaissance: null,
  nomMere: null,
  niveauIdentite: 'PROVISOIRE',
  typePiece: null,
  numeroPiece: null,
  identiteVerifieeLe: null,
  utilisateur: { prenom: 'Maomou', nom: 'Conde', telephone: '620100010' },
  verifiePar: null,
};

const DTO = {
  typePiece: 'CARTE_NATIONALE' as const,
  numeroPiece: 'GN-AB-1234567',
  lieuNaissance: 'Conakry',
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1', niveauIdentite: 'PROVISOIRE' });
  prisma.patientProfile.findMany.mockResolvedValue([LIGNE]);
  prisma.patientProfile.update.mockResolvedValue({
    ...LIGNE, niveauIdentite: 'VERIFIEE', typePiece: 'CARTE_NATIONALE',
    numeroPiece: 'GN-AB-1234567', lieuNaissance: 'Conakry',
    identiteVerifieeLe: MAINTENANT, verifiePar: { prenom: 'Fatoumata', nom: 'Keita' },
  });
});

// ── Le numéro de pièce ne s'affiche pas en entier ────────────────────

describe('masquerNumero', () => {
  // Le numéro sert à prouver qu'une pièce a été vue, pas à être recopié.
  // L'afficher en entier sur un écran de comptoir, devant la file d'attente,
  // serait une fuite gratuite. Les quatre derniers suffisent à reconnaître
  // la pièce qu'on tient en main.
  it.each([
    ['GN-AB-1234567', '•••••••••4567'],
    ['AB1234', '••1234'],
    ['12345', '•2345'],
  ])('%s -> %s', (numero, attendu) => {
    expect(masquerNumero(numero)).toBe(attendu);
  });

  // Un numéro très court ne doit pas se retrouver affiché en clair par
  // l'effet d'un `slice` négatif.
  it.each(['1234', '12', 'A'])('masque entièrement un numéro court (%s)', (numero) => {
    expect(masquerNumero(numero)).toBe('•'.repeat(numero.length));
    expect(masquerNumero(numero)).not.toContain(numero[0]);
  });

  it('rend null quand il n y a pas de pièce', () => {
    expect(masquerNumero(null)).toBeNull();
  });
});

// ── Ce que la vérification exige ─────────────────────────────────────

describe('verifier : ce qui est exigé', () => {
  it.each(['', '  ', 'AB'])('refuse le numéro de pièce « %s »', async (numeroPiece) => {
    await expect(verifier(AGENT, 'p1', { ...DTO, numeroPiece }, MAINTENANT))
      .rejects.toThrow(ValidationError);
  });

  it('dit pourquoi le numéro est exigé', async () => {
    await expect(verifier(AGENT, 'p1', { ...DTO, numeroPiece: 'A' }, MAINTENANT))
      .rejects.toThrow(/contestable/);
  });

  it.each(['', ' ', 'K'])('refuse le lieu de naissance « %s »', async (lieuNaissance) => {
    await expect(verifier(AGENT, 'p1', { ...DTO, lieuNaissance }, MAINTENANT))
      .rejects.toThrow(/lieu de naissance/i);
  });

  it('ne touche à rien quand la saisie est refusée', async () => {
    await expect(verifier(AGENT, 'p1', { ...DTO, numeroPiece: 'A' }, MAINTENANT)).rejects.toThrow();
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  it('refuse un patient inconnu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(verifier(AGENT, 'inconnu', DTO, MAINTENANT)).rejects.toThrow(NotFoundError);
  });
});

// ── Ce qu'elle enregistre ────────────────────────────────────────────

describe('verifier : ce qui est enregistré', () => {
  it('enregistre la pièce, son numéro, la date et l agent', async () => {
    await verifier(AGENT, 'p1', DTO, MAINTENANT);
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({
      niveauIdentite: 'VERIFIEE',
      typePiece: 'CARTE_NATIONALE',
      numeroPiece: 'GN-AB-1234567',
      lieuNaissance: 'Conakry',
      identiteVerifieeLe: MAINTENANT,
      idVerifiePar: AGENT.userId,
    });
  });

  it('nettoie les espaces de bord', async () => {
    await verifier(AGENT, 'p1', { ...DTO, numeroPiece: '  GN-AB-1234567  ', lieuNaissance: ' Kankan ' }, MAINTENANT);
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, string> }];
    expect(args.data['numeroPiece']).toBe('GN-AB-1234567');
    expect(args.data['lieuNaissance']).toBe('Kankan');
  });

  // Le nom de la mère ne figure pas sur un passeport : l'exiger ferait
  // échouer une vérification parfaitement valide.
  it('accepte une vérification sans nom de mère', async () => {
    await expect(verifier(AGENT, 'p1', DTO, MAINTENANT)).resolves.toBeDefined();
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).not.toHaveProperty('nomMere');
  });

  // Et il ne doit pas écraser un nom de mère déjà recueilli si l'agent ne le
  // ressaisit pas : l'information serait perdue pour la détection de doublons.
  it.each(['', '   ', undefined])('n écrase pas le nom de mère pour « %s »', async (nomMere) => {
    await verifier(AGENT, 'p1', { ...DTO, nomMere }, MAINTENANT);
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).not.toHaveProperty('nomMere');
  });

  it('enregistre le nom de mère quand il est donné', async () => {
    await verifier(AGENT, 'p1', { ...DTO, nomMere: ' Fatoumata Conde ' }, MAINTENANT);
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, string> }];
    expect(args.data['nomMere']).toBe('Fatoumata Conde');
  });

  it('rend le numéro masqué, jamais en clair', async () => {
    const vue = await verifier(AGENT, 'p1', DTO, MAINTENANT);
    expect(vue.numeroPieceMasque).toBe('•••••••••4567');
    expect(JSON.stringify(vue)).not.toContain('GN-AB-1234567');
  });
});

// ── Revérifier ───────────────────────────────────────────────────────

describe('verifier : une identité déjà vérifiée', () => {
  beforeEach(() => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1', niveauIdentite: 'VERIFIEE' });
  });

  // Une pièce peut avoir été renouvelée : revérifier n'est pas une erreur.
  // Mais cela doit être un geste conscient, pas un double clic.
  it('refuse sans confirmation explicite', async () => {
    await expect(verifier(AGENT, 'p1', DTO, MAINTENANT)).rejects.toThrow(ForbiddenError);
    await expect(verifier(AGENT, 'p1', DTO, MAINTENANT)).rejects.toThrow(/deja verifiee/i);
  });

  it('accepte avec confirmation', async () => {
    await expect(verifier(AGENT, 'p1', { ...DTO, remplacerPiece: true }, MAINTENANT))
      .resolves.toBeDefined();
  });
});

// ── Les traits, sans vérification ────────────────────────────────────

describe('noterTraits', () => {
  // Au téléphone ou sur déclaration, un agent recueille ces traits sans
  // pièce. Ils servent la détection de doublons, qui n'attend pas une
  // vérification pour être utile.
  it('enregistre le lieu de naissance seul', async () => {
    await noterTraits('p1', { lieuNaissance: 'Kankan' });
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({ lieuNaissance: 'Kankan' });
  });

  it('enregistre le nom de la mère seul', async () => {
    await noterTraits('p1', { nomMere: 'Fatoumata Conde' });
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({ nomMere: 'Fatoumata Conde' });
  });

  // Noter un trait ne vérifie rien : le niveau ne doit pas bouger.
  it('ne change pas le niveau d identité', async () => {
    await noterTraits('p1', { lieuNaissance: 'Kankan', nomMere: 'Fatoumata' });
    const [args] = prisma.patientProfile.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).not.toHaveProperty('niveauIdentite');
    expect(args.data).not.toHaveProperty('typePiece');
  });

  it.each([{}, { lieuNaissance: '  ' }, { nomMere: '' }])('refuse une saisie vide (%j)', async (traits) => {
    await expect(noterTraits('p1', traits)).rejects.toThrow(ValidationError);
  });
});

// ── La recherche ─────────────────────────────────────────────────────

describe('rechercher', () => {
  // Les provisoires d'abord : ce sont eux qu'un agent a à traiter.
  it('met les identités provisoires en tête', async () => {
    await rechercher({});
    const [args] = prisma.patientProfile.findMany.mock.calls[0] as [{ orderBy: unknown }];
    expect(args.orderBy).toEqual([{ niveauIdentite: 'asc' }, { utilisateur: { nom: 'asc' } }]);
  });

  it('filtre par niveau', async () => {
    await rechercher({ niveau: 'PROVISOIRE' });
    const [args] = prisma.patientProfile.findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where['niveauIdentite']).toBe('PROVISOIRE');
  });

  it('cherche par QR, téléphone ou nom', async () => {
    await rechercher({ q: 'Diallo Ma' });
    const [args] = prisma.patientProfile.findMany.mock.calls[0] as [{ where: { OR: unknown[] } }];
    expect(args.where.OR).toHaveLength(3);
  });

  // L'écran s'en sert pour dire à l'agent ce qu'il doit demander au patient,
  // plutôt que de refuser après coup.
  it('annonce les traits qui manquent', async () => {
    const [vue] = await rechercher({});
    expect(vue?.traitsManquants).toEqual(['lieuNaissance', 'nomMere']);
  });

  it('n annonce rien quand les traits sont là', async () => {
    prisma.patientProfile.findMany.mockResolvedValue([
      { ...LIGNE, lieuNaissance: 'Conakry', nomMere: 'Fatoumata' },
    ]);
    const [vue] = await rechercher({});
    expect(vue?.traitsManquants).toEqual([]);
  });
});
