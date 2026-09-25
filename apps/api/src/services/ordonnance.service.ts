// src/services/ordonnance.service.ts
// L'ordonnance-document : numerotation, code de verification, validite,
// signature du prescripteur et controle au comptoir (EF-05-07/08, EF-07-01).
//
// Jusqu'a P3, « ordonnance » designait un medicament prescrit. Trois
// medicaments prescrits le meme jour formaient trois objets sans lien : il n'y
// avait donc rien a numeroter, rien a signer d'un seul geste, et rien que la
// pharmacie puisse verifier. Le document porte maintenant ces garanties, et
// les medicaments en sont les lignes.
import { randomInt } from 'node:crypto';

import { StatutOrdonnance } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { NotFoundError, ValidationError } from '../utils/app-error';
import { prochainNumero } from './numero.service';
import { getValeursParametres } from './parametres.service';
import type { AlertePrescriptionView } from '@baobaoheath/shared-types';

/**
 * Alphabet du code de verification : ni 0/O, ni 1/I/L, qui se confondent quand
 * le code est recopie depuis un papier ou dicte au telephone.
 */
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Seule capacite requise : les deux clients Prisma (normal et transaction) la fournissent. */
type ClientPrisma = Pick<typeof prisma, 'ordonnance' | 'ligneOrdonnance' | '$queryRaw'>;

export function genererCodeVerification(longueur: number): string {
  let code = '';
  // randomInt (CSPRNG) plutot que Math.random : le code est un secret partage
  // entre le patient et la pharmacie.
  for (let i = 0; i < longueur; i += 1) {
    code += ALPHABET_CODE[randomInt(ALPHABET_CODE.length)];
  }
  return code;
}

export function estExpiree(ordonnance: { valideJusquau: Date }, maintenant = new Date()): boolean {
  return ordonnance.valideJusquau.getTime() < maintenant.getTime();
}

/**
 * `expiree` est un champ calcule : Prisma ne peut pas le produire, et le
 * laisser au client obligerait chaque ecran a refaire la comparaison de dates.
 * Toutes les vues qui exposent une ordonnance passent donc par ici.
 */
export function avecExpiration<T extends { valideJusquau: Date }>(
  ordonnance: T,
  maintenant = new Date()
): T & { expiree: boolean } {
  return { ...ordonnance, expiree: estExpiree(ordonnance, maintenant) };
}

/**
 * Meme calcul, plus la conversion des alertes. Elles sont stockees en JSON :
 * Prisma les rend en `JsonValue`, que le contrat partage decrit comme un
 * tableau d'alertes. La conversion se fait ici, une fois, plutot que dans
 * chaque ecran — et le cast est legitime : c'est nous qui avons ecrit ce JSON.
 */
export function avecExpirationEtAlertes<
  T extends {
    valideJusquau: Date;
    renouvellementsAutorises: number;
    renouvellementsUtilises: number;
    lignes: { alertes: unknown; medicament?: { estReglemente: boolean } }[];
  }
>(
  ordonnance: T,
  maintenant = new Date()
): Omit<T, 'lignes'> & {
  expiree: boolean;
  renouvellementsRestants: number;
  contientProduitReglemente: boolean;
  lignes: (Omit<T['lignes'][number], 'alertes'> & { alertes: AlertePrescriptionView[] | null })[];
} {
  // Le type de la ligne se derive de T : un second parametre generique serait
  // infere depuis sa contrainte, et toutes les autres proprietes seraient
  // perdues. `Omit` est indispensable aussi : sans lui, l'intersection
  // conserve le type d'origine de `alertes` (JsonValue) et la conversion
  // n'a aucun effet.
  //
  // L'assertion finale porte sur la seule chose que TypeScript ne sait pas
  // deduire d'un spread generique : que `...l` conserve les autres proprietes
  // de la ligne. La forme produite est bien celle annoncee.
  return {
    ...ordonnance,
    expiree: estExpiree(ordonnance, maintenant),
    renouvellementsRestants: renouvellementsRestants(ordonnance),
    // Les medicaments sont deja charges ici : une requete de plus serait du
    // gaspillage, et surtout une occasion de divergence.
    contientProduitReglemente: ordonnance.lignes.some((l) => l.medicament?.estReglemente === true),
    lignes: ordonnance.lignes.map((l) => ({
      ...l,
      alertes: (l.alertes ?? null) as AlertePrescriptionView[] | null,
    })),
  } as Omit<T, 'lignes'> & {
    expiree: boolean;
    renouvellementsRestants: number;
    contientProduitReglemente: boolean;
    lignes: (Omit<T['lignes'][number], 'alertes'> & { alertes: AlertePrescriptionView[] | null })[];
  };
}

/**
 * L'ordonnance en cours de redaction d'une consultation, creee au premier
 * medicament prescrit. Tant qu'elle n'est pas signee, le medecin peut y
 * ajouter des lignes ; une fois signee, une nouvelle prescription ouvre un
 * nouveau document (on ne modifie pas une ordonnance signee).
 */
export async function ordonnanceEnRedaction(
  idConsultation: string,
  client: ClientPrisma = prisma
) {
  const existante = await client.ordonnance.findFirst({
    where: { idConsultation, signeLe: null, statut: StatutOrdonnance.EN_ATTENTE },
    orderBy: { creeLe: 'desc' },
  });
  if (existante) return existante;

  const { prescription } = await getValeursParametres();
  const numero = await prochainNumero('OR', client);
  const valideJusquau = new Date();
  valideJusquau.setDate(valideJusquau.getDate() + prescription.dureeValiditeJours);

  return client.ordonnance.create({
    data: {
      numero,
      idConsultation,
      codeVerification: genererCodeVerification(prescription.longueurCodeVerification),
      valideJusquau,
    },
  });
}

/**
 * Le statut du document se deduit de ses lignes, il ne se saisit jamais :
 * toutes servies -> SERVIE, certaines -> PARTIELLEMENT_SERVIE. Un document
 * annule ou expire garde son statut, qui ne depend pas des lignes.
 */
export async function recalculerStatut(
  idOrdonnance: string,
  client: ClientPrisma = prisma
): Promise<StatutOrdonnance> {
  const ordonnance = await client.ordonnance.findUnique({
    where: { id: idOrdonnance },
    include: { lignes: { select: { statut: true } } },
  });
  if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');

  if (
    ordonnance.statut === StatutOrdonnance.ANNULEE ||
    ordonnance.statut === StatutOrdonnance.EXPIREE
  ) {
    return ordonnance.statut;
  }

  const lignes = ordonnance.lignes;
  const delivrees = lignes.filter((l) => l.statut === StatutOrdonnance.DELIVREE).length;

  let statut: StatutOrdonnance = StatutOrdonnance.EN_ATTENTE;
  if (lignes.length > 0 && delivrees === lignes.length) statut = StatutOrdonnance.SERVIE;
  else if (delivrees > 0) statut = StatutOrdonnance.PARTIELLEMENT_SERVIE;

  if (statut !== ordonnance.statut) {
    await client.ordonnance.update({ where: { id: idOrdonnance }, data: { statut } });
  }
  return statut;
}

/**
 * Signature nominative du prescripteur. C'est elle qui rend l'ordonnance
 * opposable : la validite ne court qu'a partir de la signature, et une
 * ordonnance non signee est refusee au comptoir.
 */
export async function signerOrdonnance(idOrdonnance: string, idSignataire: string) {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: idOrdonnance },
    include: { lignes: { select: { id: true } } },
  });
  if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');
  if (ordonnance.signeLe) throw new ValidationError('Cette ordonnance est deja signee');
  if (ordonnance.lignes.length === 0) {
    throw new ValidationError('Une ordonnance sans medicament ne peut pas etre signee');
  }

  // EF-05-12 : un produit reglemente raccourcit la validite, y compris au
  // moment de la signature — c'est elle qui fait courir le delai.
  const signeLe = new Date();
  const valideJusquau = await calculerValidite(
    signeLe,
    await contientProduitReglemente(idOrdonnance)
  );

  return prisma.ordonnance.update({
    where: { id: idOrdonnance },
    data: { signePar: idSignataire, signeLe, valideJusquau },
    include: { lignes: { include: { medicament: true } }, signataire: { select: { prenom: true, nom: true } } },
  });
}

/**
 * Pourquoi une ordonnance ne peut pas etre servie, ou `null` si elle le peut.
 * Le motif est rendu tel quel au comptoir : le pharmacien doit pouvoir
 * l'expliquer au patient plutot que d'opposer un refus muet.
 */
export function motifDeRefus(
  ordonnance: {
    statut: StatutOrdonnance;
    signeLe: Date | null;
    valideJusquau: Date;
    // Ces deux champs sont **obligatoires** a dessein : ils sont calcules, donc
    // absents d'un enregistrement Prisma brut. Les rendre optionnels laissait
    // les appelants passer l'objet tel quel, et les deux regles restaient
    // inertes sans que rien ne le signale.
    /** EF-05-12 : un produit reglemente durcit la regle, quelle que soit D2. */
    contientProduitReglemente: boolean;
    /** EF-05-09 : une ordonnance servie reste servable s'il reste un cycle. */
    renouvellementsRestants: number;
  },
  // Decision D2, non tranchee : voir parametres.service. Tant qu'elle ne l'est
  // pas, une ordonnance redigee par un ASC reste delivrable — l'imposer
  // bloquerait la pharmacie dans les zones sans medecin.
  signatureObligatoire = false
): string | null {
  // Un stupefiant ou un psychotrope ne se delivre pas sur la seule parole d'un
  // agent communautaire : la signature est exigee meme quand D2 ne l'impose
  // pas encore au cas general.
  if ((signatureObligatoire || ordonnance.contientProduitReglemente) && !ordonnance.signeLe) {
    return ordonnance.contientProduitReglemente && !signatureObligatoire
      ? "Produit reglemente : signature d'un medecin obligatoire"
      : 'Ordonnance non signee par le prescripteur';
  }
  if (ordonnance.statut === StatutOrdonnance.ANNULEE) return 'Ordonnance annulee';
  if (ordonnance.statut === StatutOrdonnance.SERVIE && !ordonnance.renouvellementsRestants) {
    return 'Ordonnance deja entierement servie';
  }
  if (estExpiree(ordonnance)) {
    return `Ordonnance expiree le ${ordonnance.valideJusquau.toLocaleDateString('fr-FR')}`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Renouvellement et produits reglementes (EF-05-09, EF-05-12)
// ═══════════════════════════════════════════════════════════════════

/** Ce qu'il reste de cycles, une fois l'ordonnance entierement servie. */
export function renouvellementsRestants(o: {
  renouvellementsAutorises: number;
  renouvellementsUtilises: number;
}): number {
  return Math.max(0, o.renouvellementsAutorises - o.renouvellementsUtilises);
}

/**
 * La validite d'une ordonnance : reduite des qu'un produit reglemente y
 * figure (EF-05-12). Les deux durees sont des parametres — le cahier des
 * charges interdit d'en faire des constantes.
 */
export async function calculerValidite(
  depuis: Date,
  contientProduitReglemente: boolean
): Promise<Date> {
  const { prescription } = await getValeursParametres();
  const jours = contientProduitReglemente
    ? prescription.dureeValiditeReglementeJours
    : prescription.dureeValiditeJours;
  const fin = new Date(depuis);
  fin.setDate(fin.getDate() + jours);
  return fin;
}

/** Vrai des qu'une ligne porte un produit a circuit reglemente. */
export async function contientProduitReglemente(
  idOrdonnance: string,
  client: ClientPrisma = prisma
): Promise<boolean> {
  const ligne = await client.ligneOrdonnance.findFirst({
    where: { idOrdonnance, medicament: { estReglemente: true } },
    select: { id: true },
  });
  return ligne !== null;
}

/**
 * EF-05-09 : ouvrir le cycle suivant d'une ordonnance renouvelable.
 *
 * Le numero et le code ne changent pas : c'est le meme papier que le patient
 * represente au comptoir, et lui en donner un nouveau a chaque passage le
 * perdrait. Les lignes repassent en attente, le compteur avance, et la
 * validite globale continue de plafonner le tout — un renouvellement ne
 * prolonge pas une ordonnance perimee.
 */
export async function renouvelerOrdonnance(idOrdonnance: string) {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: idOrdonnance },
    include: { lignes: { select: { id: true, statut: true } } },
  });
  if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');

  if (await contientProduitReglemente(idOrdonnance)) {
    throw new ValidationError("Un produit reglemente ne peut pas etre renouvele");
  }
  if (renouvellementsRestants(ordonnance) === 0) {
    throw new ValidationError('Cette ordonnance n a plus de renouvellement disponible');
  }
  if (ordonnance.statut !== StatutOrdonnance.SERVIE) {
    throw new ValidationError('Le renouvellement n ouvre qu une ordonnance entierement servie');
  }
  if (estExpiree(ordonnance)) {
    throw new ValidationError(
      `Ordonnance expiree le ${ordonnance.valideJusquau.toLocaleDateString('fr-FR')}`
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.ligneOrdonnance.updateMany({
      where: { idOrdonnance },
      data: { statut: StatutOrdonnance.EN_ATTENTE },
    });
    return tx.ordonnance.update({
      where: { id: idOrdonnance },
      data: {
        statut: StatutOrdonnance.EN_ATTENTE,
        renouvellementsUtilises: { increment: 1 },
      },
      include: { lignes: { include: { medicament: true } } },
    });
  });
}

/**
 * Applique au document ce qui ne se decide pas ligne par ligne (EF-05-09,
 * EF-05-12), apres chaque prescription :
 *
 *   - un produit reglemente ferme le renouvellement et raccourcit la validite,
 *     sans que le prescripteur ait a y penser ni puisse s'y soustraire ;
 *   - sinon, le nombre de renouvellements demande s'applique, plafonne par le
 *     parametre systeme.
 *
 * La validite n'est recalculee que si elle change : une ordonnance signee ne
 * doit pas voir sa date glisser parce qu'on a ajoute une ligne.
 */
export async function appliquerReglesDocument(
  idOrdonnance: string,
  renouvellementsDemandes?: number
): Promise<void> {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: idOrdonnance },
    select: { id: true, signeLe: true, creeLe: true, valideJusquau: true, renouvellementsAutorises: true },
  });
  if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');

  const reglemente = await contientProduitReglemente(idOrdonnance);
  const { prescription } = await getValeursParametres();

  let renouvellements = ordonnance.renouvellementsAutorises;
  if (reglemente) {
    renouvellements = 0;
  } else if (renouvellementsDemandes !== undefined) {
    renouvellements = Math.max(0, Math.min(renouvellementsDemandes, prescription.renouvellementsMax));
  }

  // La validite court depuis la signature quand elle existe, sinon depuis la
  // redaction — la meme regle qu'ailleurs.
  const depuis = ordonnance.signeLe ?? ordonnance.creeLe;
  const valideJusquau = await calculerValidite(depuis, reglemente);

  const changeValidite = valideJusquau.getTime() !== ordonnance.valideJusquau.getTime();
  const changeRenouvellements = renouvellements !== ordonnance.renouvellementsAutorises;
  if (!changeValidite && !changeRenouvellements) return;

  await prisma.ordonnance.update({
    where: { id: idOrdonnance },
    data: {
      ...(changeRenouvellements ? { renouvellementsAutorises: renouvellements } : {}),
      // Une ordonnance reglemente voit sa validite se reduire des que le
      // produit y entre ; l'inverse n'a pas lieu d'etre, on ne rallonge pas.
      ...(changeValidite && (reglemente || valideJusquau > ordonnance.valideJusquau)
        ? { valideJusquau }
        : {}),
    },
  });
}
