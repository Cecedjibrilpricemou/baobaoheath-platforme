import { Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { ValidationError } from '../utils/app-error';
import { enCsv } from '../utils/csv';
import { libelleAccesAdministration } from './libelle-acces';
import type {
  FiltreJournalDto,
  LigneJournalView,
  PageJournalView,
} from '@baobaoheath/shared-types';

/**
 * Rechercher et exporter le journal d'audit (EF-12-05).
 *
 * Reserve a l'administration nationale. C'est le seul endroit de la
 * plateforme ou l'on voit, d'un coup, qui a touche au dossier de qui — donc
 * **l'ecran le plus sensible du produit**. Trois consequences, portees par ce
 * fichier et par ses routes :
 *
 *   1. **la recherche est elle-meme journalisee** (`/journal` figure dans
 *      `shouldAudit`). Sans cela, le seul endroit d'ou l'on voit tout serait
 *      le seul qu'on ne verrait pas ;
 *   2. **un export trop large est refuse, jamais tronque en silence.** Un
 *      journal d'audit ampute sans le dire est pire qu'un export absent : on
 *      conclut d'une absence de ligne qu'il ne s'est rien passe ;
 *   3. **la periode est bornee par defaut** a 30 jours, pour qu'une recherche
 *      sans critere ne balaye pas la table entiere.
 */

/** Au-dela, l'export est refuse et l'operateur doit resserrer sa recherche. */
export const MAX_LIGNES_EXPORT = 10_000;

/** Quand aucune date n'est donnee, on ne remonte pas plus loin que cela. */
const JOURS_PAR_DEFAUT = 30;

const LIMITE_MAX = 200;

/**
 * Le filtre Prisma.
 *
 * Type nomme explicitement et non deduit de `Parameters<...>` : un `where`
 * trop large degradait l'inference de l'appel entier, et Prisma rendait alors
 * les colonnes scalaires sans les relations — `utilisateur` et
 * `patientConcerne` disparaissaient du type, sans que la requete change.
 */
type Filtre = Prisma.JournalAuditWhereInput;

function dateOuNull(valeur: string | undefined, bout: 'debut' | 'fin'): Date | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`Date invalide : « ${valeur} »`);
  }
  // Une date seule (« 2026-10-03 ») vaut minuit. Prise comme borne de fin,
  // elle exclurait toute la journee : l'operateur qui cherche « jusqu'au 3 »
  // attend le 3 inclus.
  if (bout === 'fin' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

/**
 * Le filtre Prisma correspondant aux criteres.
 *
 * Exporte pour etre eprouve seul : c'est lui qui decide ce qu'une enquete
 * voit, et une erreur ici ne se remarque pas — elle rend simplement moins de
 * lignes.
 */
export function construireFiltre(dto: FiltreJournalDto, maintenant = new Date()): Filtre {
  const du = dateOuNull(dto.du, 'debut');
  const au = dateOuNull(dto.au, 'fin');

  if (du && au && du > au) {
    throw new ValidationError('La date de debut est posterieure a la date de fin');
  }

  // Sans borne basse, on remonte 30 jours : une recherche sans critere ne doit
  // pas balayer la table entiere. L'operateur qui veut plus loin donne `du`.
  const depuis = du ?? (au ? null : new Date(maintenant.getTime() - JOURS_PAR_DEFAUT * 86_400_000));

  const filtre: Record<string, unknown> = {};

  if (depuis || au) {
    filtre['creeLe'] = {
      ...(depuis ? { gte: depuis } : {}),
      ...(au ? { lte: au } : {}),
    };
  }
  if (dto.idUtilisateur) filtre['idUtilisateur'] = dto.idUtilisateur;
  if (dto.idPatient) filtre['idPatientConcerne'] = dto.idPatient;
  if (dto.ressource) filtre['ressource'] = dto.ressource;
  if (dto.role) filtre['utilisateur'] = { role: dto.role };

  // Un refus est une tentative, pas un acces : c'est souvent ce qu'une
  // enquete cherche en premier. Une rafale de 403 sur des dossiers differents
  // est le motif que la detection d'anomalies (EF-12-06) devra reconnaitre.
  if (dto.echecsSeulement) filtre['statutHttp'] = { gte: 400 };

  // « Les acces au dossier d'un patient par quelqu'un d'autre que lui. »
  if (dto.parTiers && dto.idPatient) {
    filtre['utilisateur'] = {
      ...(filtre['utilisateur'] as object | undefined),
      patientProfile: { isNot: { id: dto.idPatient } },
    };
  }

  return filtre as Filtre;
}

/**
 * La seule lecture du journal, partagee par la recherche et l'export.
 *
 * Le type de ligne se deduit de cette fonction, donc il ne peut pas diverger
 * de ce qu'elle lit reellement.
 */
function lire(where: Filtre, options: { skip?: number; take?: number } = {}) {
  return prisma.journalAudit.findMany({
    where,
    // `select` et non `include` : `metadonnees` porte la requete entiere
    // (corps, parametres, chaine de requete) et n'a pas a etre lu pour un
    // tableau de recherche.
    //
    // Si les relations venaient a disparaitre du type rendu, ce n'est pas ce
    // `select` qu'il faut mettre en cause mais le type de `where` : un
    // `Filtre` deduit de `Parameters<...>` degradait l'inference de l'appel
    // entier, et Prisma ne rendait plus que les colonnes scalaires — sans que
    // la requete, elle, change. Une heure perdue le 2026-10-03 a soupconner
    // le `select`, puis le client etendu, avant de trouver le `where`.
    select: {
      id: true,
      action: true,
      ressource: true,
      idRessource: true,
      statutHttp: true,
      ipAdresse: true,
      creeLe: true,
      idUtilisateur: true,
      idPatientConcerne: true,
      utilisateur: { select: { prenom: true, nom: true, role: true } },
      patientConcerne: { select: { utilisateur: { select: { prenom: true, nom: true } } } },
    },
    orderBy: { creeLe: 'desc' },
    ...options,
  });
}

type LigneBrute = Awaited<ReturnType<typeof lire>>[number];

function enVue(l: LigneBrute): LigneJournalView {
  // La redaction d administration : le patient est un tiers, et la colonne
  // « patient concerne » le nomme deja a cote. Le libelle du patient dirait
  // « votre dossier » a propos du dossier de quelqu un d autre.
  const { cle, objet } = libelleAccesAdministration({ action: l.action, ressource: l.ressource });
  return {
    id: l.id,
    creeLe: l.creeLe.toISOString(),
    action: l.action,
    ressource: l.ressource,
    idRessource: l.idRessource,
    libelle: cle,
    libelleObjet: objet,
    statutHttp: l.statutHttp,
    ipAdresse: l.ipAdresse,
    idUtilisateur: l.idUtilisateur,
    acteur: {
      prenom: l.utilisateur.prenom,
      nom: l.utilisateur.nom,
      role: l.utilisateur.role,
    },
    idPatientConcerne: l.idPatientConcerne,
    patientConcerne: l.patientConcerne
      ? `${l.patientConcerne.utilisateur.prenom} ${l.patientConcerne.utilisateur.nom}`
      : null,
  };
}

export async function rechercher(
  dto: FiltreJournalDto,
  maintenant = new Date()
): Promise<PageJournalView> {
  const where = construireFiltre(dto, maintenant);
  const page = Math.max(1, dto.page ?? 1);
  const limit = Math.min(dto.limit ?? 50, LIMITE_MAX);

  const [lignes, total] = await Promise.all([
    lire(where, { skip: (page - 1) * limit, take: limit }),
    prisma.journalAudit.count({ where }),
  ]);

  return {
    lignes: lignes.map(enVue),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    maxExport: MAX_LIGNES_EXPORT,
  };
}

/**
 * L'export CSV des memes criteres.
 *
 * **Refuse plutot que tronquer.** Un export d'audit ampute sans le dire est
 * pire qu'un export absent : on conclut d'une absence de ligne qu'il ne s'est
 * rien passe. L'operateur est donc renvoye a sa recherche, avec le nombre
 * exact de lignes qu'elle rend.
 *
 * Le fichier porte le libelle technique (`action`, `ressource`) et non la
 * phrase redigee pour le patient : un export sert une enquete, pas un ecran.
 */
export async function exporterCsv(
  dto: FiltreJournalDto,
  maintenant = new Date()
): Promise<string> {
  const where = construireFiltre(dto, maintenant);
  const total = await prisma.journalAudit.count({ where });

  if (total > MAX_LIGNES_EXPORT) {
    throw new ValidationError(
      `L'export porterait ${total} lignes, au-dela de la limite de ${MAX_LIGNES_EXPORT}. ` +
        `Resserrez la periode ou ajoutez un critere : un export d'audit n'est jamais tronque en silence.`
    );
  }

  const lignes = await lire(where);

  return enCsv(
    [
      'Horodatage',
      'Acteur',
      'Role',
      'Action',
      'Ressource',
      'Identifiant ressource',
      'Patient concerne',
      'Identifiant patient',
      'Code HTTP',
      'Adresse IP',
    ],
    lignes.map((l) => [
      l.creeLe,
      `${l.utilisateur.prenom} ${l.utilisateur.nom}`,
      l.utilisateur.role,
      l.action,
      l.ressource,
      l.idRessource,
      l.patientConcerne
        ? `${l.patientConcerne.utilisateur.prenom} ${l.patientConcerne.utilisateur.nom}`
        : null,
      l.idPatientConcerne,
      l.statutHttp,
      l.ipAdresse,
    ])
  );
}
