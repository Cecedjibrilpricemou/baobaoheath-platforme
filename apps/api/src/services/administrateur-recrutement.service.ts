// Le super administrateur recrute l'encadrement de la plateforme.
//
// **Ces deux roles n'etaient creables par personne.** `ADMIN_REGIONAL` et
// `ADMIN_NATIONAL` figuraient dans l'enumeration, dans les gardes de routes et
// dans les menus, mais aucun schema de l'application ne les acceptait : le
// seul moyen d'en obtenir un etait le jeu de donnees initial ou une insertion
// SQL. En pratique, un unique super administrateur portait toute la
// plateforme — et comme c'est a l'encadrement qu'il revient de recruter les
// livreurs, personne d'autre que lui ne pouvait le faire non plus.
//
// **Aucune region n'est demandee, et ce n'est pas un oubli.** `Utilisateur` ne
// porte aucun champ geographique, et `ADMIN_REGIONAL` fait partie des roles
// que `buildPatientWhereForUser` laisse passer sans filtre : son perimetre est
// aujourd'hui exactement celui du national. Demander une prefecture ici
// afficherait un cloisonnement qui n'existe pas. Le champ viendra le jour ou
// la regle viendra avec lui.
import { Prisma, Role } from '../config/generated/client/client';
import type {
  AdministrateurView,
  CreationAdministrateurView,
  CreerAdministrateurDto,
} from '@baobaoheath/shared-types';
import { prisma } from '../config/prisma';
import type { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError } from '../utils/app-error';
import { hashPassword } from '../utils/password.utils';
import { genererMotDePasseTemp } from './admin-structure.service';

/** Les deux roles que ce service sait creer, et eux seuls. */
const ROLES_ENCADREMENT = [Role.ADMIN_REGIONAL, Role.ADMIN_NATIONAL] as const;

type RoleEncadrement = (typeof ROLES_ENCADREMENT)[number];

/**
 * Seul le super administrateur recrute l'encadrement.
 *
 * Un administrateur national qui pourrait en nommer d'autres se donnerait des
 * pairs sans que personne l'ait decide : la plateforme perdrait la trace de
 * qui tient les cles.
 */
function exigerSuperAdmin(user: JwtPayload): void {
  if (user.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Seul le super administrateur recrute l'encadrement de la plateforme");
  }
}

function estRoleEncadrement(role: string): role is RoleEncadrement {
  return (ROLES_ENCADREMENT as readonly string[]).includes(role);
}

function versAdministrateurView(u: {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  email: string | null;
  role: Role;
  estActif: boolean;
  creeLe: Date;
}): AdministrateurView {
  return {
    id: u.id,
    prenom: u.prenom,
    nom: u.nom,
    telephone: u.telephone,
    // Le schema l'exige a la creation ; la colonne reste nullable pour les
    // patients, d'ou ce repli qui ne devrait jamais servir ici.
    email: u.email ?? '',
    role: u.role as RoleEncadrement,
    estActif: u.estActif,
    creeLe: u.creeLe.toISOString(),
  };
}

const SELECTION = {
  id: true, prenom: true, nom: true, telephone: true,
  email: true, role: true, estActif: true, creeLe: true,
} as const;

export async function creerAdministrateur(
  auteur: JwtPayload,
  dto: CreerAdministrateurDto,
): Promise<CreationAdministrateurView> {
  exigerSuperAdmin(auteur);

  if (!estRoleEncadrement(dto.role)) {
    throw new ForbiddenError('Ce service ne cree que des administrateurs regionaux ou nationaux');
  }

  const email = dto.email.trim().toLowerCase();

  // **Le telephone et l'email sont deux identifiants de connexion.** Les deux
  // sont uniques en base ; on verifie les deux ici pour rendre un refus qui
  // nomme le doublon, plutot qu'une contrainte brute.
  const existant = await prisma.utilisateur.findFirst({
    where: { OR: [{ telephone: dto.telephone }, { email }] },
    select: { telephone: true, email: true },
  });
  if (existant) {
    throw new ConflictError(
      existant.telephone === dto.telephone
        ? 'Ce numero de telephone est deja utilise'
        : 'Cette adresse email est deja utilisee',
    );
  }

  const motDePasseTemporaire = genererMotDePasseTemp();
  const motDePasseHash = await hashPassword(motDePasseTemporaire);

  try {
    const cree = await prisma.utilisateur.create({
      data: {
        telephone: dto.telephone,
        email,
        motDePasseHash,
        prenom: dto.prenom,
        nom: dto.nom,
        role: dto.role as Role,
        // L'encadrement n'appartient a aucun etablissement : son perimetre est
        // la plateforme, pas une structure.
        idStructure: null,
        doitChangerMotDePasse: true,
      },
      select: SELECTION,
    });

    return {
      administrateur: versAdministrateurView(cree),
      motDePasseTemporaire,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Ce numero de telephone ou cette adresse email est deja utilise');
    }
    throw error;
  }
}

/** L'encadrement en place. Le super administrateur n'y figure pas : il ne se gere pas lui-meme. */
export async function listerAdministrateurs(auteur: JwtPayload): Promise<AdministrateurView[]> {
  exigerSuperAdmin(auteur);

  const lignes = await prisma.utilisateur.findMany({
    where: { role: { in: [...ROLES_ENCADREMENT] } },
    select: SELECTION,
    orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  });

  return lignes.map(versAdministrateurView);
}
