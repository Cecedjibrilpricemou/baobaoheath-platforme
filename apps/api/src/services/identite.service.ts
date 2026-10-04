import { NiveauIdentite, TypePieceIdentite } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { JwtPayload } from '../types/auth.types';
import type { IdentitePatientView, VerifierIdentiteDto } from '@baobaoheath/shared-types';

/**
 * Verifier l'identite d'un patient (EF-01-04/10).
 *
 * **Ce que verifier veut dire ici.** Un agent d'accueil declare avoir vu une
 * piece, et enregistre laquelle. Ce n'est pas une authentification
 * informatique : c'est une personne qui engage sa responsabilite. D'ou
 * l'exigence du numero de piece — une verification qui ne peut pas nommer le
 * document sur lequel elle se fonde n'est ni verifiable ni contestable.
 *
 * **Ce que cela ouvre, et rien de plus** : le tiers payant, et plus tard la
 * delivrance de produits reglementes. Les soins, eux, ne dependent pas du
 * niveau d'identite — un patient provisoire est consulte, suivi et prescrit
 * normalement.
 *
 * **Ce que cela ne doit pas devenir** : un filtre a l'entree. Un ASC qui
 * enregistre quelqu'un en brousse n'a pas de piece a verifier, et lui refuser
 * l'ouverture d'un dossier reviendrait a lui refuser les soins.
 */

/** En deca, un numero de piece ne designe rien. La contrainte SQL l'exige aussi. */
const NUMERO_MIN = 3;
const LIEU_MIN = 2;

type Ligne = {
  id: string;
  dateNaissance: Date;
  sexe: string;
  prefecture: string;
  lieuNaissance: string | null;
  nomMere: string | null;
  niveauIdentite: NiveauIdentite;
  typePiece: TypePieceIdentite | null;
  numeroPiece: string | null;
  identiteVerifieeLe: Date | null;
  utilisateur: { prenom: string; nom: string; telephone: string };
  verifiePar: { prenom: string; nom: string } | null;
};

/**
 * Le numero de piece, masque.
 *
 * Il sert a prouver qu'une piece a ete vue, pas a etre recopie. L'afficher en
 * entier sur un ecran de comptoir, devant la file d'attente, serait une fuite
 * gratuite. Les quatre derniers caracteres suffisent a reconnaitre la piece
 * qu'on tient en main.
 */
export function masquerNumero(numero: string | null): string | null {
  if (!numero) return null;
  const propre = numero.trim();
  if (propre.length <= 4) return '•'.repeat(propre.length);
  return '•'.repeat(propre.length - 4) + propre.slice(-4);
}

function enVue(l: Ligne): IdentitePatientView {
  return {
    id: l.id,
    nomComplet: `${l.utilisateur.prenom} ${l.utilisateur.nom}`,
    telephone: l.utilisateur.telephone,
    dateNaissance: l.dateNaissance.toISOString(),
    sexe: l.sexe,
    prefecture: l.prefecture,
    lieuNaissance: l.lieuNaissance,
    nomMere: l.nomMere,
    niveauIdentite: l.niveauIdentite,
    typePiece: l.typePiece,
    numeroPieceMasque: masquerNumero(l.numeroPiece),
    verifieeLe: l.identiteVerifieeLe?.toISOString() ?? null,
    verifieePar: l.verifiePar ? `${l.verifiePar.prenom} ${l.verifiePar.nom}` : null,
    // Ce qui manque pour pouvoir verifier. L'ecran s'en sert pour dire a
    // l'agent ce qu'il doit demander au patient, plutot que de refuser
    // apres coup.
    traitsManquants: [
      ...(l.lieuNaissance ? [] : ['lieuNaissance']),
      ...(l.nomMere ? [] : ['nomMere']),
    ],
  };
}

const SELECTION = {
  id: true, dateNaissance: true, sexe: true, prefecture: true,
  lieuNaissance: true, nomMere: true, niveauIdentite: true,
  typePiece: true, numeroPiece: true, identiteVerifieeLe: true,
  utilisateur: { select: { prenom: true, nom: true, telephone: true } },
  verifiePar: { select: { prenom: true, nom: true } },
};

export async function rechercher(
  filtres: { q?: string; niveau?: NiveauIdentite }
): Promise<IdentitePatientView[]> {
  const where: Record<string, unknown> = {};
  if (filtres.niveau) where['niveauIdentite'] = filtres.niveau;

  const terme = filtres.q?.trim();
  if (terme) {
    const mots = terme.split(/\s+/).filter(Boolean);
    where['OR'] = [
      { qrCode: terme },
      { utilisateur: { telephone: { contains: terme.replace(/\s/g, '') } } },
      // Chaque mot doit apparaitre dans le nom ou le prenom, comme la
      // recherche de l'accueil : « Diallo Ma » trouve Mamadou Diallo.
      {
        AND: mots.map((m) => ({
          utilisateur: {
            OR: [
              { nom: { contains: m, mode: 'insensitive' } },
              { prenom: { contains: m, mode: 'insensitive' } },
            ],
          },
        })),
      },
    ];
  }

  const lignes = await prisma.patientProfile.findMany({
    where,
    select: SELECTION,
    // Les provisoires d'abord : ce sont eux qu'un agent a a traiter.
    orderBy: [{ niveauIdentite: 'asc' }, { utilisateur: { nom: 'asc' } }],
    take: 50,
  });
  return (lignes as Ligne[]).map(enVue);
}

export async function verifier(
  user: JwtPayload,
  idPatient: string,
  dto: VerifierIdentiteDto,
  maintenant = new Date()
): Promise<IdentitePatientView> {
  const numero = dto.numeroPiece.trim();
  const lieu = dto.lieuNaissance.trim();

  if (numero.length < NUMERO_MIN) {
    throw new ValidationError(
      "Le numero de la piece est exige : une verification qui ne peut pas nommer le document sur lequel elle se fonde n'est pas contestable"
    );
  }
  if (lieu.length < LIEU_MIN) {
    throw new ValidationError('Le lieu de naissance est exige : il figure sur la piece que vous avez en main');
  }

  const patient = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    select: { id: true, niveauIdentite: true },
  });
  if (!patient) throw new NotFoundError('Patient non trouve');

  // Reverifier une identite deja verifiee n'est pas une erreur en soi — une
  // piece peut avoir ete renouvelee. Mais cela doit etre un geste conscient,
  // pas un double clic.
  if (patient.niveauIdentite === NiveauIdentite.VERIFIEE && !dto.remplacerPiece) {
    throw new ForbiddenError(
      "Cette identite est deja verifiee. Pour enregistrer une nouvelle piece, confirmez le remplacement."
    );
  }

  const maj = await prisma.patientProfile.update({
    where: { id: idPatient },
    data: {
      niveauIdentite: NiveauIdentite.VERIFIEE,
      typePiece: dto.typePiece,
      numeroPiece: numero,
      lieuNaissance: lieu,
      // Le nom de la mere ne figure pas sur un passeport : on ne l'ecrase pas
      // s'il etait deja connu et que l'agent ne le ressaisit pas.
      ...(dto.nomMere?.trim() ? { nomMere: dto.nomMere.trim() } : {}),
      identiteVerifieeLe: maintenant,
      idVerifiePar: user.userId,
    },
    select: SELECTION,
  });
  return enVue(maj as Ligne);
}

/**
 * Noter un trait distinctif sans verifier l'identite.
 *
 * Un agent peut recueillir le lieu de naissance et le nom de la mere sans
 * avoir de piece sous les yeux — au telephone, ou sur declaration. Ces traits
 * servent a la detection de doublons (EF-01-05), qui n'attend pas une
 * verification pour etre utile.
 */
export async function noterTraits(
  idPatient: string,
  traits: { lieuNaissance?: string; nomMere?: string }
): Promise<IdentitePatientView> {
  const lieu = traits.lieuNaissance?.trim();
  const mere = traits.nomMere?.trim();
  if (!lieu && !mere) throw new ValidationError('Aucun trait a enregistrer');

  const maj = await prisma.patientProfile.update({
    where: { id: idPatient },
    data: {
      ...(lieu ? { lieuNaissance: lieu } : {}),
      ...(mere ? { nomMere: mere } : {}),
    },
    select: SELECTION,
  }).catch(() => { throw new NotFoundError('Patient non trouve'); });

  return enVue(maj as Ligne);
}
