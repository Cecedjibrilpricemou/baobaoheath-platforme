// Ce qu'un laboratoire sait faire, et qui le medecin peut raisonnablement
// solliciter (EF-04).
//
// **Le renvoi se faisait a l'aveugle.** `listerLaboratoires` rendait tous les
// laboratoires actifs du pays, sans filtre sur leur plateau ni sur la
// geographie : le medecin prescrivait dans une liste plate, le laboratoire
// recevait la demande et decouvrait qu'il ne faisait pas l'examen. Le patient,
// lui, s'etait deplace.
//
// La liste rendue ici est l'expression du parcours reel :
//
//   1. chez nous   le laboratoire de l'etablissement, en tete ;
//   2. conseilles  ceux que l'etablissement a declares ;
//   3. les autres  le reste, de sa prefecture par defaut.
//
// Et dans chaque groupe, la couverture des examens demandes -- le compte exact
// et les noms de ceux qui manquent, pas un booleen.
import { Prisma, Role } from '../config/generated/client/client';
import type {
  ChoixLaboratoiresView,
  DeclarerPlateauDto,
  LaboratoireChoixView,
  LignePlateauView,
  OrigineLaboratoire,
  PlateauTechniqueView,
  StructureConseilleeView,
  StructureRefView,
} from '@baobaoheath/shared-types';
import { prisma } from '../config/prisma';
import type { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';

/**
 * Qui peut recevoir une demande d'analyse.
 *
 * **`CLINIQUE` y a ete ajoute le 28/10/2026.** Son absence rendait impossible
 * le parcours decrit par le porteur du projet -- « le medecin envoie vers le
 * laboratoire de son hopital, ou vers une clinique qu'il conseille ». Le
 * filtre s'appliquant a la liste **et** a la creation de la demande, aucun
 * contournement n'existait, meme en forcant l'identifiant.
 */
export const TYPES_RECEVEURS = [
  'LABORATOIRE', 'CHU', 'HOPITAL_REG', 'HOPITAL_PREF', 'CLINIQUE',
] as const;

const CHOIX_SELECT = {
  id: true, nom: true, type: true, prefecture: true,
} as const;

/** La structure de l'appelant, par son compte ou par son profil. */
async function structureDe(userId: string): Promise<string | null> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: {
      idStructure: true,
      medecinProfile: { select: { idStructure: true } },
    },
  });
  return u?.idStructure ?? u?.medecinProfile?.idStructure ?? null;
}

type Ligne = { id: string; nom: string; type: string; prefecture: string };

/**
 * La couverture d'un laboratoire pour les examens demandes.
 *
 * **Un laboratoire qui n'a rien declare est repute tout savoir faire.** Sans
 * cette regle, toutes les structures existantes disparaitraient des listes le
 * jour du deploiement et le parcours s'arreterait net. Elle s'efface d'elle-
 * meme : des qu'un laboratoire declare un seul examen, sa declaration fait foi.
 */
function couverture(
  structure: Ligne,
  origine: OrigineLaboratoire,
  realises: Set<string> | undefined,
  examens: { id: string; libelle: string; codeLoinc: string }[],
): LaboratoireChoixView {
  const plateauNonDeclare = realises === undefined;
  const nonCouverts = plateauNonDeclare
    ? []
    : examens.filter((e) => !realises.has(e.id));

  return {
    id: structure.id,
    nom: structure.nom,
    type: structure.type,
    prefecture: structure.prefecture,
    origine,
    couverts: examens.length - nonCouverts.length,
    demandes: examens.length,
    nonCouverts,
    plateauNonDeclare,
  };
}

/**
 * Les laboratoires proposes au medecin, groupes et couverture calculee.
 *
 * `idsExamens` peut etre vide : la liste est alors rendue sans couverture, ce
 * qui est le cas a l'ouverture de l'ecran, avant toute selection.
 */
export async function laboratoiresPour(
  user: JwtPayload,
  idsExamens: string[],
  toutLePays = false,
): Promise<ChoixLaboratoiresView> {
  const idStructure = await structureDe(user.userId);

  const [maStructure, examens, conseillees] = await Promise.all([
    idStructure
      ? prisma.structureSante.findUnique({
          where: { id: idStructure },
          select: { ...CHOIX_SELECT, estActive: true },
        })
      : Promise.resolve(null),
    idsExamens.length > 0
      ? prisma.examen.findMany({
          where: { id: { in: idsExamens } },
          select: { id: true, libelle: true, codeLoinc: true },
        })
      : Promise.resolve([]),
    idStructure
      ? prisma.structureConseillee.findMany({
          where: { idStructure },
          select: { idStructureConseillee: true },
        })
      : Promise.resolve([]),
  ]);

  // **Le laboratoire « chez nous » : le fils s'il existe, sinon soi-meme.**
  // `idStructureParente` sert deja a la pharmacie hospitaliere, mais aucun
  // etablissement n'a encore de laboratoire fils. Le repli evite toute
  // migration de donnees tout en rendant le modele propre disponible des
  // qu'un etablissement cree le sien.
  const fils = idStructure
    ? await prisma.structureSante.findFirst({
        where: {
          idStructureParente: idStructure,
          estActive: true,
          type: { in: [...TYPES_RECEVEURS] },
        },
        select: CHOIX_SELECT,
      })
    : null;

  const interne: Ligne[] = fils
    ? [fils]
    : maStructure?.estActive && (TYPES_RECEVEURS as readonly string[]).includes(maStructure.type)
      ? [{ id: maStructure.id, nom: maStructure.nom, type: maStructure.type, prefecture: maStructure.prefecture }]
      : [];

  const idsConseillees = conseillees.map((c) => c.idStructureConseillee);
  const idsInternes = interne.map((i) => i.id);

  const [lignesConseillees, lignesAutres] = await Promise.all([
    idsConseillees.length > 0
      ? prisma.structureSante.findMany({
          where: {
            id: { in: idsConseillees, notIn: idsInternes },
            estActive: true,
            type: { in: [...TYPES_RECEVEURS] },
          },
          select: CHOIX_SELECT,
          orderBy: [{ type: 'asc' }, { nom: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.structureSante.findMany({
      where: {
        estActive: true,
        type: { in: [...TYPES_RECEVEURS] },
        id: { notIn: [...idsInternes, ...idsConseillees] },
        // **Filtre par defaut, jamais verrouille.** Un CHU envoie parfois un
        // prelevement a un laboratoire specialise ailleurs : c'est rare, mais
        // c'est reel, et un verrou le rendrait impossible.
        ...(toutLePays || !maStructure ? {} : { prefecture: maStructure.prefecture }),
      },
      select: CHOIX_SELECT,
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    }),
  ]);

  const toutes = [...interne, ...lignesConseillees, ...lignesAutres];
  const realisesPar = await plateauxDe(toutes.map((l) => l.id), idsExamens);

  const vue = (lignes: Ligne[], origine: OrigineLaboratoire) =>
    lignes.map((l) => couverture(l, origine, realisesPar.get(l.id), examens));

  return {
    interne: vue(interne, 'INTERNE'),
    conseilles: vue(lignesConseillees, 'CONSEILLE'),
    autres: vue(lignesAutres, 'AUTRE'),
    prefecture: maStructure?.prefecture ?? null,
    toutLePays,
  };
}

/**
 * Pour chaque structure, les examens demandes qu'elle realise.
 *
 * Une structure absente de la carte n'a **rien declare** : elle est reputee
 * tout savoir faire. Une structure presente avec un ensemble vide a declare
 * un plateau qui ne couvre aucun des examens demandes -- ce n'est pas la meme
 * chose, et les confondre rendrait la regle de transition incoherente.
 */
async function plateauxDe(
  idsStructures: string[],
  idsExamens: string[],
): Promise<Map<string, Set<string>>> {
  if (idsStructures.length === 0) return new Map();

  const lignes = await prisma.plateauTechnique.findMany({
    where: { idStructure: { in: idsStructures } },
    select: { idStructure: true, idExamen: true, actif: true },
  });

  const carte = new Map<string, Set<string>>();
  for (const l of lignes) {
    // La structure a declare quelque chose : elle entre dans la carte, meme
    // si toutes ses lignes sont inactives.
    if (!carte.has(l.idStructure)) carte.set(l.idStructure, new Set());
    if (l.actif && (idsExamens.length === 0 || idsExamens.includes(l.idExamen))) {
      carte.get(l.idStructure)!.add(l.idExamen);
    }
  }
  return carte;
}

/**
 * Les examens demandes que ce laboratoire ne realise pas.
 *
 * Appelee a la creation d'une demande : elle **n'interdit rien**, elle rend ce
 * qui manque pour que l'ecran puisse le nommer. Meme philosophie que l'alerte
 * d'allergie -- on ne bloque pas, on fait dire qu'on a vu.
 */
export async function examensNonCouverts(
  idLaboratoire: string,
  idsExamens: string[],
): Promise<{ id: string; libelle: string; codeLoinc: string }[]> {
  if (idsExamens.length === 0) return [];
  const carte = await plateauxDe([idLaboratoire], idsExamens);
  const realises = carte.get(idLaboratoire);
  if (realises === undefined) return []; // rien de declare : tout est repute realisable

  const manquants = idsExamens.filter((id) => !realises.has(id));
  if (manquants.length === 0) return [];

  return prisma.examen.findMany({
    where: { id: { in: manquants } },
    select: { id: true, libelle: true, codeLoinc: true },
    orderBy: { libelle: 'asc' },
  });
}

// ── La declaration, par le laboratoire lui-meme ──────────────────────

/** La structure du technicien appelant, ou un refus. */
async function structureDuLaboratoire(user: JwtPayload): Promise<{ id: string; nom: string }> {
  if (user.role !== Role.TECHNICIEN_LABO && user.role !== Role.ADMIN_STRUCTURE) {
    throw new ForbiddenError('Seul le laboratoire declare ce qu il realise');
  }
  const idStructure = await structureDe(user.userId);
  if (!idStructure) throw new ForbiddenError('Compte sans structure rattachee');

  const structure = await prisma.structureSante.findFirst({
    where: { id: idStructure, type: { in: [...TYPES_RECEVEURS] } },
    select: { id: true, nom: true },
  });
  if (!structure) throw new ForbiddenError('Votre structure ne recoit pas de demande d analyse');
  return structure;
}

export async function plateauDeMaStructure(user: JwtPayload): Promise<PlateauTechniqueView> {
  const structure = await structureDuLaboratoire(user);

  const [examens, declares] = await Promise.all([
    prisma.examen.findMany({
      where: { actif: true },
      select: { id: true, codeLoinc: true, libelle: true, categorie: true, prixGnf: true },
      orderBy: [{ categorie: 'asc' }, { libelle: 'asc' }],
    }),
    prisma.plateauTechnique.findMany({
      where: { idStructure: structure.id },
      select: { idExamen: true, actif: true, delaiHeures: true, prixGnf: true },
    }),
  ]);

  const parExamen = new Map(declares.map((d) => [d.idExamen, d]));

  const lignes: LignePlateauView[] = examens.map((e) => {
    const d = parExamen.get(e.id);
    return {
      idExamen: e.id,
      codeLoinc: e.codeLoinc,
      libelle: e.libelle,
      categorie: e.categorie,
      // Rien de declare : tout est repute realisable, et l'ecran le dit.
      realise: d ? d.actif : declares.length === 0,
      delaiHeures: d?.delaiHeures ?? null,
      prixGnf: d?.prixGnf ?? null,
      prixReferenceGnf: e.prixGnf ?? null,
    };
  });

  return {
    idStructure: structure.id,
    nom: structure.nom,
    nonDeclare: declares.length === 0,
    lignes,
  };
}

/**
 * La declaration complete, en un geste.
 *
 * On remplace l'ensemble plutot que de modifier ligne par ligne : un plateau
 * technique se lit comme un tout, et une declaration partielle laisserait des
 * lignes orphelines dont personne ne saurait si elles valent encore.
 */
export async function declarerPlateau(
  user: JwtPayload,
  dto: DeclarerPlateauDto,
): Promise<PlateauTechniqueView> {
  const structure = await structureDuLaboratoire(user);

  const ids = dto.examens.map((e) => e.idExamen);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError('Un examen ne peut figurer deux fois dans la declaration');
  }

  const connus = await prisma.examen.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (connus.length !== ids.length) {
    throw new ValidationError('Un des examens declares n existe pas au referentiel');
  }

  await prisma.$transaction(async (tx) => {
    await tx.plateauTechnique.deleteMany({ where: { idStructure: structure.id } });
    if (dto.examens.length === 0) return;
    await tx.plateauTechnique.createMany({
      data: dto.examens.map((e) => ({
        idStructure: structure.id,
        idExamen: e.idExamen,
        actif: e.realise,
        delaiHeures: e.delaiHeures ?? null,
        prixGnf: e.prixGnf ?? null,
      })),
    });
  });

  return plateauDeMaStructure(user);
}

// ── Le carnet d'adresses de l'etablissement ──────────────────────────

/**
 * **Ce n'est pas un contrat.** L'etablissement qui conseille le declare seul ;
 * celui qui est conseille n'a rien a accepter. La plateforme autorise deja
 * d'adresser une demande a n'importe quel laboratoire : cette declaration ne
 * donne aucun droit, elle exprime une recommandation interne.
 */
async function structureDeLAdmin(user: JwtPayload): Promise<string> {
  if (user.role !== Role.ADMIN_STRUCTURE) {
    throw new ForbiddenError('Seul l administrateur de la structure declare ses partenaires');
  }
  const idStructure = await structureDe(user.userId);
  if (!idStructure) throw new ForbiddenError('Compte sans structure rattachee');
  return idStructure;
}

/**
 * Les structures que cet etablissement peut encore conseiller.
 *
 * Deux exclusions, sinon l'ecran propose des choix que la base refusera :
 * soi-meme (la contrainte `structures_conseillees_pas_soi_meme`) et ce qui est
 * deja conseille (l'index unique). Un formulaire qui offre une erreur
 * garantie n'est pas un formulaire.
 */
export async function laboratoiresCandidats(user: JwtPayload): Promise<StructureRefView[]> {
  const idStructure = await structureDeLAdmin(user);
  const deja = await prisma.structureConseillee.findMany({
    where: { idStructure },
    select: { idStructureConseillee: true },
  });

  return prisma.structureSante.findMany({
    where: {
      estActive: true,
      type: { in: [...TYPES_RECEVEURS] },
      id: { notIn: [idStructure, ...deja.map((d) => d.idStructureConseillee)] },
    },
    select: CHOIX_SELECT,
    orderBy: [{ type: 'asc' }, { nom: 'asc' }],
  });
}

export async function conseillees(user: JwtPayload): Promise<StructureConseilleeView[]> {
  const idStructure = await structureDeLAdmin(user);
  const lignes = await prisma.structureConseillee.findMany({
    where: { idStructure },
    select: {
      id: true, declareLe: true,
      structureConseillee: { select: CHOIX_SELECT },
    },
    orderBy: { declareLe: 'desc' },
  });

  return lignes.map((l) => ({
    id: l.id,
    idStructureConseillee: l.structureConseillee.id,
    nom: l.structureConseillee.nom,
    type: l.structureConseillee.type,
    prefecture: l.structureConseillee.prefecture,
    declareLe: l.declareLe.toISOString(),
  }));
}

export async function conseiller(
  user: JwtPayload,
  idStructureConseillee: string,
): Promise<StructureConseilleeView> {
  const idStructure = await structureDeLAdmin(user);

  if (idStructure === idStructureConseillee) {
    throw new ValidationError(
      'Votre etablissement figure deja en tete de la liste de vos medecins : il ne se conseille pas lui-meme',
    );
  }

  const cible = await prisma.structureSante.findFirst({
    where: { id: idStructureConseillee, estActive: true, type: { in: [...TYPES_RECEVEURS] } },
    select: CHOIX_SELECT,
  });
  if (!cible) throw new NotFoundError('Structure introuvable, inactive, ou ne recevant pas de demande d analyse');

  try {
    const cree = await prisma.structureConseillee.create({
      data: { idStructure, idStructureConseillee, declarePar: user.userId },
      select: { id: true, declareLe: true },
    });
    return {
      id: cree.id,
      idStructureConseillee: cible.id,
      nom: cible.nom,
      type: cible.type,
      prefecture: cible.prefecture,
      declareLe: cree.declareLe.toISOString(),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Cette structure est deja conseillee');
    }
    throw error;
  }
}

export async function retirerConseil(user: JwtPayload, id: string): Promise<void> {
  const idStructure = await structureDeLAdmin(user);
  // Borne a sa propre structure : le `deleteMany` filtre sur les deux, donc un
  // identifiant d'une autre structure ne retire rien plutot que de retirer
  // chez le voisin.
  const supprime = await prisma.structureConseillee.deleteMany({
    where: { id, idStructure },
  });
  if (supprime.count !== 1) throw new NotFoundError('Ce conseil n existe pas chez vous');
}
