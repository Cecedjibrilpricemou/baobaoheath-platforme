// L'espace de l'assureur (EF-09, addendum du 2026-09-28, point 5.2).
//
// Deux choses sont a prouver ici, et elles ne se rattrapent pas en recette :
//
//   1. **Un assureur ne lit aucun dossier medical.** S'il voyait ce qu'on
//      soigne, il pourrait refuser un contrat dessus. La frontiere ne tient
//      pas a la bonne volonte de l'ecran : elle tient a ce que le service
//      selectionne.
//   2. **Un assureur ne voit que sa compagnie.** Elle se deduit de sa
//      structure ; aucune route ne prend d'identifiant de compagnie, sans quoi
//      un agent lirait la situation d'un concurrent en changeant un chiffre
//      dans l'URL.
import {
  assureurDe,
  enregistrerReglement,
  mesAssures,
  mesPharmacies,
} from '../src/services/assurance.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: jest.fn() },
    assureur: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    contratAssurance: { findMany: jest.fn(), count: jest.fn() },
    venteComptoir: { groupBy: jest.fn() },
    reglementAssureur: { groupBy: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    structureSante: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M };
    assureur: { findUnique: M; findUniqueOrThrow: M };
    contratAssurance: { findMany: M; count: M };
    venteComptoir: { groupBy: M };
    reglementAssureur: { groupBy: M; create: M; findMany: M };
    structureSante: { findMany: M; findUnique: M };
  };
};

const AGENT = { userId: 'u-sonag', role: 'ASSUREUR' } as unknown as JwtPayload;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: 'str-sonag' });
  prisma.assureur.findUnique.mockResolvedValue({ id: 'ass-sonag' });
});

describe('assureurDe', () => {
  // La compagnie se deduit de la structure. C'est ce qui empeche un agent
  // d'en designer une autre.
  it('resout la compagnie par la structure du compte', async () => {
    const r = await assureurDe(AGENT);
    expect(prisma.assureur.findUnique).toHaveBeenCalledWith({
      where: { idStructure: 'str-sonag' },
      select: { id: true },
    });
    expect(r.id).toBe('ass-sonag');
  });

  it('refuse un agent sans structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(assureurDe(AGENT)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // Erreur de configuration, pas de droits : le dire evite de chercher au
  // mauvais endroit.
  it("le dit quand la structure n'est rattachee a aucune compagnie", async () => {
    prisma.assureur.findUnique.mockResolvedValue(null);
    await expect(assureurDe(AGENT)).rejects.toThrow(/compagnie/i);
  });
});

describe('mesAssures', () => {
  const CONTRAT = {
    id: 'c-1', numeroPolice: 'SON-1', statut: 'ACTIF', tauxBasePourcent: 80,
    plafondAnnuelGnf: 0, franchiseGnf: 0, dateEffet: new Date('2026-01-01'), dateFin: null,
    patient: { utilisateur: { prenom: 'Maomou', nom: 'Conde' } },
  };

  beforeEach(() => {
    prisma.contratAssurance.findMany.mockResolvedValue([CONTRAT]);
    prisma.venteComptoir.groupBy.mockResolvedValue([
      { idContratAssurance: 'c-1', _sum: { montantAssureGnf: 120000 }, _count: { _all: 3 } },
    ]);
  });

  it('ne lit que les contrats de sa propre compagnie', async () => {
    await mesAssures(AGENT);
    expect(prisma.contratAssurance.findMany.mock.calls[0]![0].where)
      .toEqual({ idAssureur: 'ass-sonag' });
  });

  // **La frontiere.** L'assureur connait deja ses assures par leur contrat ;
  // leur dossier ne le regarde pas.
  it('ne rend que le nom du patient, rien de son dossier', async () => {
    const [a] = await mesAssures(AGENT);
    expect(Object.keys(a!.patient).sort()).toEqual(['nom', 'prenom']);
  });

  it("ne demande ni telephone, ni date de naissance, ni adresse", async () => {
    await mesAssures(AGENT);
    const select = JSON.stringify(prisma.contratAssurance.findMany.mock.calls[0]![0].select);
    for (const champ of ['telephone', 'dateNaissance', 'prefecture', 'email', 'qrCode']) {
      expect(select).not.toContain(champ);
    }
  });

  it("ne demande aucune ligne de vente ni ordonnance", async () => {
    await mesAssures(AGENT);
    const tout = JSON.stringify(prisma.venteComptoir.groupBy.mock.calls[0]![0]);
    for (const champ of ['lignes', 'ordonnance', 'idOrdonnance', 'medicament']) {
      expect(tout).not.toContain(champ);
    }
  });

  it('rapporte ce qui a ete pris en charge cette annee, et le nombre de passages', async () => {
    const [a] = await mesAssures(AGENT);
    expect(a!.consommeAnneeGnf).toBe(120000);
    expect(a!.nombrePassages).toBe(3);
  });

  // Les ventes annulees ne doivent pas entamer le plafond d'un assure.
  it('ne compte que les ventes payees', async () => {
    await mesAssures(AGENT);
    expect(prisma.venteComptoir.groupBy.mock.calls[0]![0].where.statut).toBe('PAYEE');
  });

  it('rend zero pour un assure qui n a jamais rien consomme', async () => {
    prisma.venteComptoir.groupBy.mockResolvedValue([]);
    const [a] = await mesAssures(AGENT);
    expect(a!.consommeAnneeGnf).toBe(0);
    expect(a!.nombrePassages).toBe(0);
  });

  // Mille assures ne doivent pas faire mille requetes.
  it('agrege en une seule requete, quel que soit le nombre de contrats', async () => {
    prisma.contratAssurance.findMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({ ...CONTRAT, id: `c-${i}` })),
    );
    await mesAssures(AGENT);
    expect(prisma.venteComptoir.groupBy).toHaveBeenCalledTimes(1);
  });

  it('ne demande rien du tout sans aucun contrat', async () => {
    prisma.contratAssurance.findMany.mockResolvedValue([]);
    expect(await mesAssures(AGENT)).toEqual([]);
    expect(prisma.venteComptoir.groupBy).not.toHaveBeenCalled();
  });
});

describe('mesPharmacies (point 5.2)', () => {
  beforeEach(() => {
    prisma.venteComptoir.groupBy.mockResolvedValue([
      { idStructure: 's-1', _sum: { montantAssureGnf: 800000, montantNetGnf: 1000000 }, _count: { _all: 12 } },
    ]);
    prisma.reglementAssureur.groupBy.mockResolvedValue([
      { idStructure: 's-1', _sum: { montantGnf: 500000 }, _max: { creeLe: new Date('2026-10-01') } },
    ]);
    prisma.structureSante.findMany.mockResolvedValue([
      { id: 's-1', nom: 'Pharmacie Pricemou', prefecture: 'Conakry' },
    ]);
  });

  it('ne compte que les ventes couvertes par sa propre compagnie', async () => {
    await mesPharmacies(AGENT);
    expect(prisma.venteComptoir.groupBy.mock.calls[0]![0].where)
      .toMatchObject({ contratAssurance: { idAssureur: 'ass-sonag' }, statut: 'PAYEE' });
    expect(prisma.reglementAssureur.groupBy.mock.calls[0]![0].where)
      .toEqual({ idAssureur: 'ass-sonag' });
  });

  it('rend ce qui est delivre, facture, paye et ce qui reste du', async () => {
    const [p] = await mesPharmacies(AGENT);
    expect(p).toMatchObject({
      nom: 'Pharmacie Pricemou',
      nombreVentes: 12,
      montantDelivreGnf: 1000000,
      montantFactureGnf: 800000,
      montantPayeGnf: 500000,
      resteDuGnf: 300000,
    });
  });

  // Un trop-verse est un ecart aussi : le masquer le rendrait introuvable.
  it('montre un reste du negatif quand la compagnie a trop verse', async () => {
    prisma.reglementAssureur.groupBy.mockResolvedValue([
      { idStructure: 's-1', _sum: { montantGnf: 900000 }, _max: { creeLe: new Date() } },
    ]);
    const [p] = await mesPharmacies(AGENT);
    expect(p!.resteDuGnf).toBe(-100000);
  });

  // Une officine reglee sans vente sur la periode, ou l'inverse : les deux
  // cotes doivent apparaitre, sinon un versement egare resterait invisible.
  it('liste une officine reglee meme sans vente', async () => {
    prisma.venteComptoir.groupBy.mockResolvedValue([]);
    const [p] = await mesPharmacies(AGENT);
    expect(p).toMatchObject({ montantFactureGnf: 0, montantPayeGnf: 500000, resteDuGnf: -500000 });
  });

  it('liste une officine qui a vendu sans avoir ete reglee', async () => {
    prisma.reglementAssureur.groupBy.mockResolvedValue([]);
    const [p] = await mesPharmacies(AGENT);
    expect(p).toMatchObject({ montantPayeGnf: 0, resteDuGnf: 800000 });
    expect(p!.dernierReglementLe).toBeNull();
  });

  // Ce qu'on vient regarder en premier, c'est la dette la plus lourde.
  it('met le plus gros reste du en tete', async () => {
    prisma.venteComptoir.groupBy.mockResolvedValue([
      { idStructure: 's-1', _sum: { montantAssureGnf: 100, montantNetGnf: 100 }, _count: { _all: 1 } },
      { idStructure: 's-2', _sum: { montantAssureGnf: 900, montantNetGnf: 900 }, _count: { _all: 2 } },
    ]);
    prisma.reglementAssureur.groupBy.mockResolvedValue([]);
    prisma.structureSante.findMany.mockResolvedValue([
      { id: 's-1', nom: 'Petite', prefecture: 'Conakry' },
      { id: 's-2', nom: 'Grosse', prefecture: 'Conakry' },
    ]);
    const r = await mesPharmacies(AGENT);
    expect(r.map((p) => p.nom)).toEqual(['Grosse', 'Petite']);
  });

  it('ne demande aucune ligne de vente', async () => {
    await mesPharmacies(AGENT);
    const tout = JSON.stringify(prisma.venteComptoir.groupBy.mock.calls[0]![0]);
    for (const champ of ['lignes', 'ordonnance', 'medicament', 'idPatient']) {
      expect(tout).not.toContain(champ);
    }
  });
});

describe('enregistrerReglement', () => {
  const DTO = {
    idStructure: 's-1', montantGnf: 500000,
    periodeDebut: '2026-09-01', periodeFin: '2026-09-30', reference: 'VIR-42',
  };

  beforeEach(() => {
    prisma.structureSante.findUnique.mockResolvedValue({ id: 's-1', nom: 'Pharmacie Pricemou', type: 'PHARMACIE' });
    prisma.reglementAssureur.create.mockResolvedValue({
      id: 'r-1', montantGnf: 500000, periodeDebut: new Date('2026-09-01'),
      periodeFin: new Date('2026-09-30'), reference: 'VIR-42', creeLe: new Date(),
      structure: { id: 's-1', nom: 'Pharmacie Pricemou' },
      saisiPar: { prenom: 'Agent', nom: 'SONAG' },
    });
  });

  it('enregistre le versement au nom de sa propre compagnie', async () => {
    await enregistrerReglement(AGENT, DTO);
    expect(prisma.reglementAssureur.create.mock.calls[0]![0].data)
      .toMatchObject({ idAssureur: 'ass-sonag', idStructure: 's-1', idSaisiPar: 'u-sonag' });
  });

  // On regle une officine, pas un hopital : l'erreur de destinataire fausse
  // la situation des deux cotes, sans rien dire.
  it("refuse une structure qui n'est pas une pharmacie", async () => {
    prisma.structureSante.findUnique.mockResolvedValue({ id: 's-9', nom: 'Hopital Donka', type: 'CHU' });
    await expect(enregistrerReglement(AGENT, { ...DTO, idStructure: 's-9' }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.reglementAssureur.create).not.toHaveBeenCalled();
  });

  it('refuse une periode a l envers', async () => {
    await expect(enregistrerReglement(AGENT, { ...DTO, periodeDebut: '2026-09-30', periodeFin: '2026-09-01' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.reglementAssureur.create).not.toHaveBeenCalled();
  });

  it.each([0, -1])('refuse un montant de %p', async (montant) => {
    await expect(enregistrerReglement(AGENT, { ...DTO, montantGnf: montant }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.reglementAssureur.create).not.toHaveBeenCalled();
  });

  it('accepte une periode d un seul jour', async () => {
    await expect(enregistrerReglement(AGENT, { ...DTO, periodeDebut: '2026-09-15', periodeFin: '2026-09-15' }))
      .resolves.toBeDefined();
  });

  // Une reference faite d'espaces n'est pas une reference.
  it('traite une reference vide comme absente', async () => {
    await enregistrerReglement(AGENT, { ...DTO, reference: '   ' });
    expect(prisma.reglementAssureur.create.mock.calls[0]![0].data.reference).toBeNull();
  });
});
