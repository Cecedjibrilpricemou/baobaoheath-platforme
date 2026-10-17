// Import des referentiels (EF-12-03).
//
// Deux parties a ne pas se tromper :
//
//   1. **l'analyse du CSV** — un fichier reel arrive d'Excel, avec son BOM,
//      ses points-virgules et ses guillemets ;
//   2. **la normalisation des DCI** — `trouverInteraction` normalise ses
//      arguments avant d'interroger. Une paire stockee telle quelle ne serait
//      jamais trouvee, et l'alerte d'interaction resterait inerte apres un
//      import en apparence reussi.
//
// Et la regle qui gouverne le reste : « un import qui echoue en silence sur
// trois lignes est pire que pas d'import ».
import {
  analyserCsv,
  colonnesAttendues,
  importerReferentiel,
} from '../src/services/referentiel.service';
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    examen: { findUnique: jest.fn(), upsert: jest.fn() },
    interactionMedicament: { findUnique: jest.fn(), upsert: jest.fn() },
    medicament: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    examen: { findUnique: M; upsert: M };
    interactionMedicament: { findUnique: M; upsert: M };
    medicament: { findFirst: M; update: M; create: M };
  };
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.examen.findUnique.mockResolvedValue(null);
  prisma.interactionMedicament.findUnique.mockResolvedValue(null);
  prisma.medicament.findFirst.mockResolvedValue(null);
});

// ── L'analyse du CSV ─────────────────────────────────────────────────

describe('analyserCsv', () => {
  it('lit un CSV a virgules', () => {
    const csv = analyserCsv('code,libelle\nA,Alpha\nB,Beta');
    expect(csv.separateur).toBe(',');
    expect(csv.entetes).toEqual(['code', 'libelle']);
    expect(csv.lignes).toEqual([
      { numero: 2, champs: { code: 'A', libelle: 'Alpha' } },
      { numero: 3, champs: { code: 'B', libelle: 'Beta' } },
    ]);
  });

  // Excel en francais exporte en point-virgule : c'est le cas courant ici.
  it('deduit le point-virgule de la ligne d en-tete', () => {
    const csv = analyserCsv('code;libelle\nA;Alpha');
    expect(csv.separateur).toBe(';');
    expect(csv.lignes[0]?.champs).toEqual({ code: 'A', libelle: 'Alpha' });
  });

  // En JavaScript, U+FEFF compte comme une espace : le `trim()` des en-tetes
  // le retire. Un nettoyage explicite du BOM serait du code mort — un sabotage
  // l'a montre, en ne faisant echouer aucun test, et il a ete retire. Tant
  // qu'un `trim()` rognait aussi le texte entier, la protection etait double
  // et ce test ne pouvait pas tomber ; ce `trim()` global a disparu avec la
  // correction de la numerotation, donc ce test verrouille maintenant seul.
  it('retire le BOM qu Excel ajoute en tete de fichier', () => {
    const csv = analyserCsv('﻿code;libelle\nA;Alpha');
    expect(csv.entetes).toEqual(['code', 'libelle']);
    expect(csv.lignes[0]?.champs['code']).toBe('A');
  });

  it('accepte les fins de ligne Windows', () => {
    const csv = analyserCsv('code;libelle\r\nA;Alpha\r\nB;Beta');
    expect(csv.lignes).toHaveLength(2);
  });

  it('respecte un separateur a l interieur de guillemets', () => {
    const csv = analyserCsv('code;libelle\nA;"Alpha; avec point-virgule"');
    expect(csv.lignes[0]?.champs['libelle']).toBe('Alpha; avec point-virgule');
  });

  it('comprend un guillemet double comme un guillemet', () => {
    const csv = analyserCsv('code;libelle\nA;"dit ""Alpha"" ici"');
    expect(csv.lignes[0]?.champs['libelle']).toBe('dit "Alpha" ici');
  });

  it('accepte un retour a la ligne dans un champ entre guillemets', () => {
    const csv = analyserCsv('code;libelle\nA;"deux\nlignes"');
    expect(csv.lignes).toHaveLength(1);
    expect(csv.lignes[0]?.champs['libelle']).toBe('deux\nlignes');
  });

  // Excel laisse souvent une ligne vide a la fin.
  it('ignore les lignes entierement vides', () => {
    const csv = analyserCsv('code;libelle\nA;Alpha\n;\n\nB;Beta\n');
    expect(csv.lignes.map((l) => l.champs['code'])).toEqual(['A', 'B']);
  });

  it('rend une chaine vide pour une colonne absente de la ligne', () => {
    const csv = analyserCsv('code;libelle;unite\nA;Alpha');
    expect(csv.lignes[0]?.champs).toEqual({ code: 'A', libelle: 'Alpha', unite: '' });
  });

  // ── Le rang rendu a l'operateur ──────────────────────────────────
  //
  // Decouvert le 2026-10-03 en interrogeant l'API reelle, pas par les tests :
  // le rapport numerotait les lignes par leur position dans le tableau apres
  // filtrage. Une seule ligne vide, et l'operateur etait renvoye a la ligne
  // precedant la fautive — donc il corrigeait une ligne saine.
  it('numerote la premiere donnee 2 : la ligne 1 est l en-tete', () => {
    const csv = analyserCsv('code;libelle\nA;Alpha\nB;Beta');
    expect(csv.lignes.map((l) => l.numero)).toEqual([2, 3]);
  });

  it('ne reattribue pas le rang d une ligne vide a la suivante', () => {
    const csv = analyserCsv('code;libelle\nA;Alpha\n\nB;Beta');
    expect(csv.lignes.map((l) => [l.numero, l.champs['code']])).toEqual([
      [2, 'A'],
      [4, 'B'],
    ]);
  });

  it('compte plusieurs trous consecutifs', () => {
    const csv = analyserCsv('code;libelle\nA;Alpha\n;\n\n\nB;Beta\n');
    expect(csv.lignes.map((l) => l.numero)).toEqual([2, 6]);
  });

  // Un champ entre guillemets qui occupe trois lignes decale de trois ce qui
  // suit : dans le tableur, c'est bien la ligne 5 qu'on lit.
  it('compte les lignes avalees par un champ entre guillemets', () => {
    const csv = analyserCsv('code;libelle\nA;"sur\ntrois\nlignes"\nB;Beta');
    expect(csv.lignes.map((l) => [l.numero, l.champs['code']])).toEqual([
      [2, 'A'],
      [5, 'B'],
    ]);
  });

  // Rogner le texte en tete supprimerait ces lignes et decalerait tout.
  it('garde les numeros justes malgre des lignes vides en tete de fichier', () => {
    const csv = analyserCsv('\n\ncode;libelle\nA;Alpha');
    expect(csv.entetes).toEqual(['code', 'libelle']);
    expect(csv.lignes.map((l) => l.numero)).toEqual([4]);
  });
  it('normalise les en-tetes en minuscules et sans espaces', () => {
    const csv = analyserCsv('  CodeLoinc ;  Libelle\n1;x');
    expect(csv.entetes).toEqual(['codeloinc', 'libelle']);
  });

  it('refuse un fichier vide', () => {
    expect(() => analyserCsv('')).toThrow(ValidationError);
    expect(() => analyserCsv('   \n  ')).toThrow(ValidationError);
  });
});

describe('colonnesAttendues', () => {
  it.each(['examens', 'interactions', 'medicaments'] as const)('decrit %s', (type) => {
    const c = colonnesAttendues(type);
    expect(c.obligatoires.length).toBeGreaterThan(0);
    expect(Array.isArray(c.facultatives)).toBe(true);
  });
});

// ── Colonnes manquantes : refus avant toute ecriture ─────────────────

describe('colonnes manquantes', () => {
  it('refuse le fichier entier, en nommant les colonnes qui manquent', async () => {
    await expect(importerReferentiel('examens', 'codeloinc;libelle\n1;x'))
      .rejects.toThrow(/categorie, specimen/);
    expect(prisma.examen.upsert).not.toHaveBeenCalled();
  });

  it('refuse un CSV d interactions sans niveau', async () => {
    await expect(importerReferentiel('interactions', 'dcia;dcib;description\na;b;x'))
      .rejects.toThrow(/niveau/);
  });
});

// ── Interactions : le coeur de l'affaire ─────────────────────────────

describe('import des interactions', () => {
  const entete = 'dcia;dcib;niveau;description;conduite;source';

  // Sans normalisation, l'import « reussit » et l'alerte reste inerte : c'est
  // le defaut le plus couteux que ce fichier previent.
  it('normalise les DCI : accents et casse disparaissent', async () => {
    const r = await importerReferentiel('interactions',
      `${entete}\nMéthotrexate;ASPIRINE;CONTRE_INDICATION;Risque hematologique;;Vidal`);

    expect(r.refusees).toBe(0);
    const [args] = prisma.interactionMedicament.upsert.mock.calls[0] as [{ create: { dciA: string; dciB: string } }];
    expect(args.create.dciA).toBe('aspirine');
    expect(args.create.dciB).toBe('methotrexate');
  });

  // Ordonner evite que (A,B) et (B,A) coexistent, ce que la contrainte
  // d'unicite autoriserait — et que `trouverInteraction` trouve alors deux
  // regles pour la meme paire.
  it('ordonne la paire, quel que soit l ordre du fichier', async () => {
    await importerReferentiel('interactions', `${entete}\nAspirine;Methotrexate;PRECAUTION;X;;`);
    const [args] = prisma.interactionMedicament.upsert.mock.calls[0] as [{ create: { dciA: string; dciB: string } }];
    expect([args.create.dciA, args.create.dciB]).toEqual(['aspirine', 'methotrexate']);
  });

  it('refuse un niveau inconnu, en listant ceux qui existent', async () => {
    const r = await importerReferentiel('interactions', `${entete}\na;b;GRAVE;X;;`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/CONTRE_INDICATION/);
  });

  it('accepte un niveau ecrit avec des espaces ou des tirets', async () => {
    const r = await importerReferentiel('interactions',
      `${entete}\na;b;association deconseillee;X;;`);
    expect(r.refusees).toBe(0);
    const [args] = prisma.interactionMedicament.upsert.mock.calls[0] as [{ create: { niveau: string } }];
    expect(args.create.niveau).toBe('ASSOCIATION_DECONSEILLEE');
  });

  it('refuse une paire ou les deux molecules sont la meme', async () => {
    const r = await importerReferentiel('interactions', `${entete}\nAspirine;aspirine;PRECAUTION;X;;`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/meme molecule/);
  });

  it('refuse une description vide : une alerte sans texte n apprend rien', async () => {
    const r = await importerReferentiel('interactions', `${entete}\na;b;PRECAUTION;;;`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/description/);
  });

  it('annonce une mise a jour quand la paire existe deja', async () => {
    prisma.interactionMedicament.findUnique.mockResolvedValue({ id: 'i-1' });
    const r = await importerReferentiel('interactions', `${entete}\na;b;PRECAUTION;X;;`);
    expect(r.creees).toBe(0);
    expect(r.misesAJour).toBe(1);
  });
});

// ── Examens ──────────────────────────────────────────────────────────

describe('import des examens', () => {
  const entete = 'codeloinc;libelle;categorie;specimen;unite;refmin;refmax;prixgnf;ajeun';

  it('cree un examen et met les codes en majuscules la ou il faut', async () => {
    const r = await importerReferentiel('examens',
      `${entete}\n718-7;Hemoglobine;hematologie;sang;g/dL;12;16;15000;oui`);

    expect(r.creees).toBe(1);
    const [args] = prisma.examen.upsert.mock.calls[0] as [{ create: Record<string, unknown> }];
    expect(args.create).toMatchObject({
      codeLoinc: '718-7', categorie: 'HEMATOLOGIE', specimen: 'SANG',
      refMin: 12, refMax: 16, prixGnf: 15000, aJeun: true,
    });
  });

  it('accepte la virgule decimale, comme Excel en francais l ecrit', async () => {
    await importerReferentiel('examens', `${entete}\n1;X;BIO;SANG;g;11,5;15,5;;non`);
    const [args] = prisma.examen.upsert.mock.calls[0] as [{ create: { refMin: number; refMax: number } }];
    expect(args.create.refMin).toBe(11.5);
    expect(args.create.refMax).toBe(15.5);
  });

  // Un intervalle inverse rendrait tout resultat anormal, ou aucun.
  it('refuse un intervalle de reference inverse', async () => {
    const r = await importerReferentiel('examens', `${entete}\n1;X;BIO;SANG;g;16;12;;non`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/refMin est superieur a refMax/);
  });

  it('refuse un nombre qui n en est pas un', async () => {
    const r = await importerReferentiel('examens', `${entete}\n1;X;BIO;SANG;g;douze;16;;non`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/refMin/);
  });

  it('refuse une ligne sans code LOINC', async () => {
    const r = await importerReferentiel('examens', `${entete}\n;X;BIO;SANG;;;;;`);
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/codeLoinc manquant/);
  });

  it('considere un examen actif quand la colonne est absente', async () => {
    await importerReferentiel('examens', 'codeloinc;libelle;categorie;specimen\n1;X;BIO;SANG');
    const [args] = prisma.examen.upsert.mock.calls[0] as [{ create: { actif: boolean } }];
    expect(args.create.actif).toBe(true);
  });
});

// ── Catalogue ────────────────────────────────────────────────────────

describe('import du catalogue', () => {
  it('cree un article non medicamenteux sans DCI ni dosage', async () => {
    const r = await importerReferentiel('medicaments',
      'libelle;categorie;prixunitairegnf\nLait infantile 400g;LAIT_INFANTILE;45000');
    expect(r.creees).toBe(1);
    const [args] = prisma.medicament.create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toMatchObject({ libelle: 'Lait infantile 400g', categorie: 'LAIT_INFANTILE', dci: null });
  });

  // Le meme invariant que la contrainte SQL, verifie ici pour que
  // l'operateur lise un motif plutot qu'une erreur de base.
  it('refuse un MEDICAMENT sans dci, forme ou dosage', async () => {
    const r = await importerReferentiel('medicaments', 'libelle;categorie\nDoliprane;MEDICAMENT');
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/exige dci, forme et dosage/);
  });

  it('considere MEDICAMENT par defaut quand la categorie est vide', async () => {
    const r = await importerReferentiel('medicaments', 'libelle;categorie\nX;');
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/exige dci/);
  });

  it('refuse une categorie inconnue', async () => {
    const r = await importerReferentiel('medicaments', 'libelle;categorie\nX;CHAUSSURES');
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/CHAUSSURES/);
  });

  it('decoupe les contre-indications sur la barre verticale', async () => {
    await importerReferentiel('medicaments',
      'libelle;categorie;dci;forme;dosage;contreindications\nX;MEDICAMENT;Metformine;comprime;850mg;Insuffisance renale|Grossesse');
    const [args] = prisma.medicament.create.mock.calls[0] as [{ data: { contreIndications: string[] } }];
    expect(args.data.contreIndications).toEqual(['Insuffisance renale', 'Grossesse']);
  });

  it('refuse un prix negatif', async () => {
    const r = await importerReferentiel('medicaments', 'libelle;categorie;prixunitairegnf\nX;HYGIENE;-5');
    expect(r.refusees).toBe(1);
    expect(r.lignes[0]?.motif).toMatch(/negatif/);
  });
});

// ── Le rapport, et la simulation ─────────────────────────────────────

describe('le rapport ne passe aucune ligne sous silence', () => {
  const entete = 'dcia;dcib;niveau;description';

  it('rend un verdict par ligne, avec son numero dans le fichier', async () => {
    const r = await importerReferentiel('interactions',
      `${entete}\na;b;PRECAUTION;Bonne\nc;d;GRAVE;Mauvaise\ne;f;PRECAUTION;Bonne aussi`);

    expect(r.total).toBe(3);
    expect(r.creees).toBe(2);
    expect(r.refusees).toBe(1);
    // La ligne 1 est l'en-tete : la mauvaise est donc la ligne 3 du fichier.
    expect(r.lignes.map((l) => [l.ligne, l.statut])).toEqual([
      [2, 'CREEE'], [3, 'REFUSEE'], [4, 'CREEE'],
    ]);
    expect(r.lignes[1]?.cle).toBe('c / d');
    expect(r.lignes[1]?.motif).toBeTruthy();
  });

  // Le fichier tel qu'Excel l'exporte : une ligne vide au milieu, et un champ
  // entre guillemets sur deux lignes. L'operateur corrige dans son tableur,
  // pas dans un tableau recalcule : le numero doit designer sa ligne.
  it('designe la ligne du tableur, trous et champs multilignes compris', async () => {
    const r = await importerReferentiel('interactions',
      `${entete}\na;b;PRECAUTION;"Bonne\nsur deux lignes"\n\nc;d;GRAVE;Mauvaise`);

    expect(r.total).toBe(2);
    expect(r.lignes.map((l) => [l.ligne, l.statut])).toEqual([
      [2, 'CREEE'],
      // 2 et 3 : le champ entre guillemets. 4 : la ligne vide. Donc 5.
      [5, 'REFUSEE'],
    ]);
  });

  // Rejeter deux mille bonnes lignes pour trois mauvaises serait pire. Mais
  // rien n'est silencieux : les refus figurent au rapport.
  it('applique les lignes valides malgre un refus', async () => {
    await importerReferentiel('interactions', `${entete}\na;b;PRECAUTION;Bonne\nc;d;GRAVE;Mauvaise`);
    expect(prisma.interactionMedicament.upsert).toHaveBeenCalledTimes(1);
  });

  it('un refus porte toujours un motif', async () => {
    const r = await importerReferentiel('interactions', `${entete}\nc;d;GRAVE;X`);
    for (const l of r.lignes.filter((x) => x.statut === 'REFUSEE')) {
      expect(l.motif).toBeTruthy();
    }
  });
});

describe('simulation', () => {
  const entete = 'dcia;dcib;niveau;description';

  it('n ecrit rien, et annonce ce qui serait fait', async () => {
    const r = await importerReferentiel('interactions',
      `${entete}\na;b;PRECAUTION;Bonne\nc;d;GRAVE;Mauvaise`, true);

    expect(r.simulation).toBe(true);
    expect(r.creees).toBe(1);
    expect(r.refusees).toBe(1);
    expect(prisma.interactionMedicament.upsert).not.toHaveBeenCalled();
  });

  it('n ecrit rien non plus pour les examens et le catalogue', async () => {
    await importerReferentiel('examens', 'codeloinc;libelle;categorie;specimen\n1;X;BIO;SANG', true);
    await importerReferentiel('medicaments', 'libelle;categorie\nX;HYGIENE', true);
    expect(prisma.examen.upsert).not.toHaveBeenCalled();
    expect(prisma.medicament.create).not.toHaveBeenCalled();
    expect(prisma.medicament.update).not.toHaveBeenCalled();
  });
});
