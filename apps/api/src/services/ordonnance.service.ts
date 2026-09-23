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

  const { prescription } = await getValeursParametres();
  const signeLe = new Date();
  const valideJusquau = new Date(signeLe);
  valideJusquau.setDate(valideJusquau.getDate() + prescription.dureeValiditeJours);

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
  },
  // Decision D2, non tranchee : voir parametres.service. Tant qu'elle ne l'est
  // pas, une ordonnance redigee par un ASC reste delivrable — l'imposer
  // bloquerait la pharmacie dans les zones sans medecin.
  signatureObligatoire = false
): string | null {
  if (signatureObligatoire && !ordonnance.signeLe) {
    return 'Ordonnance non signee par le prescripteur';
  }
  if (ordonnance.statut === StatutOrdonnance.ANNULEE) return 'Ordonnance annulee';
  if (ordonnance.statut === StatutOrdonnance.SERVIE) return 'Ordonnance deja entierement servie';
  if (estExpiree(ordonnance)) {
    return `Ordonnance expiree le ${ordonnance.valideJusquau.toLocaleDateString('fr-FR')}`;
  }
  return null;
}
