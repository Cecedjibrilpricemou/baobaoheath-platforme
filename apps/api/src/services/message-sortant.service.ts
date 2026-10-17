// src/services/message-sortant.service.ts
//
// Ce qui sort de la plateforme par SMS (EF-11-02).
//
// Un SMS voyage en clair, s'affiche sur un ecran verrouille et reste dans un
// telephone souvent partage. Le cahier des charges est donc categorique :
// **aucun contenu medical dans un message sortant**. Le detail se lit dans
// l'espace du patient, apres authentification.
//
// Le 2026-10-02, le code violait cette regle a cinq endroits : « des analyses
// vous attendent », « prelevement prevu », « vos resultats d'analyses sont
// disponibles », « votre vaccination X est due », « RESULTAT CRITIQUE ». Ce
// n'etait pas une fonctionnalite manquante mais un defaut en service.
//
// Deux parties ici :
//
//   1. des **constructeurs** de messages neutres, un par situation ;
//   2. un **garde-fou au point de sortie** — `envoyerSmsSimule` l'applique,
//      donc un appel oublie ne peut pas fuir. Mettre le controle a chaque
//      appel aurait laisse passer le prochain site ajoute.
import { logger } from '../config/logger';

/**
 * Le vocabulaire de soin qui ne doit jamais partir.
 *
 * Ce sont des **actes et des donnees de sante**, pas des types de lieu : le
 * nom d'un etablissement peut figurer dans un rappel de rendez-vous, le
 * patient devant savoir ou se presenter. Voir la note sur le risque residuel
 * en fin de fichier.
 */
const MOTS_INTERDITS = [
  'analyse', 'analyses',
  'prelevement', 'prelevements',
  'resultat', 'resultats',
  'ordonnance', 'ordonnances',
  'prescription',
  'diagnostic',
  'vaccin', 'vaccins', 'vaccination',
  'traitement',
  'medicament', 'medicaments',
  'posologie',
  'symptome', 'symptomes',
  'maladie', 'maladies',
  'allergie', 'allergies',
  'pathologie',
  'grossesse',
  'depistage',
  'serologie',
  'glycemie',
] as const;

/** Sans accents ni casse : « Résultat » et « resultat » sont le meme mot. */
function normaliser(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Le mot interdit trouve dans ce message, s'il y en a un.
 *
 * La comparaison se fait sur des mots entiers : « analyse » ne doit pas
 * declencher sur « analyser » par hasard, mais surtout « resultat » ne doit
 * pas passer parce qu'il est colle a une ponctuation.
 */
export function motInterditDans(message: string): string | null {
  const mots = new Set(normaliser(message).split(/[^a-z0-9]+/).filter(Boolean));
  for (const interdit of MOTS_INTERDITS) {
    if (mots.has(interdit)) return interdit;
  }
  return null;
}

/**
 * Ce qu'on envoie quand un message n'a pas passe le controle. Toujours
 * actionnable : le patient sait qu'il doit se connecter, sans savoir pourquoi
 * depuis son ecran verrouille.
 */
export function messageDeRepli(nomCourt: string): string {
  return `${nomCourt}: une information vous attend dans votre espace. Connectez-vous.`;
}

/**
 * Le garde-fou, applique au point de sortie.
 *
 * Hors production il **leve** : un message fautif doit casser un test ou une
 * execution locale, la ou la correction coute peu. En production il remplace
 * et journalise en erreur : ne rien envoyer priverait le patient d'une
 * information qu'il attend, et envoyer le message fautif violerait EF-11-02.
 */
export function neutraliser(message: string, nomCourt = 'KENEYA'): string {
  const interdit = motInterditDans(message);
  if (!interdit) return message;

  if (process.env['NODE_ENV'] !== 'production') {
    throw new Error(
      `Message sortant non neutre (EF-11-02) : le mot « ${interdit} » ne doit pas quitter la plateforme. ` +
        `Utilisez un constructeur de message-sortant.service. Message refuse : « ${message} »`
    );
  }

  logger.error('[SMS] message non neutre remplace (EF-11-02)', { interdit });
  return messageDeRepli(nomCourt);
}

// ── Les constructeurs ────────────────────────────────────────────────
//
// Chacun dit ce qu'il ne doit pas contenir. Ils sont testes un par un.

/**
 * Quelque chose attend le patient dans son espace : des analyses prescrites,
 * un prelevement a venir, des resultats liberes. Le SMS ne dit jamais quoi.
 */
export function messagePatientInformation(nomCourt: string): string {
  return messageDeRepli(nomCourt);
}

/**
 * Rappel de rendez-vous.
 *
 * La date, l'heure et le lieu restent : le patient doit pouvoir se presenter.
 * Ce qui disparait est le **motif** — un rendez-vous n'est pas un diagnostic.
 */
export function messageRendezVous(nomCourt: string, quand: string, lieu?: string): string {
  // Le nom de l'etablissement vient de la base : « Centre de traitement X »
  // ou « Laboratoire Cece » revelent la nature du soin, et aucun filtre de
  // vocabulaire ne peut le deviner a l'avance. On le laisse passer le meme
  // controle que le reste : s'il est revelateur, le lieu disparait et le
  // patient le retrouve dans son espace. Un rendez-vous sans lieu reste
  // utile ; un diagnostic annonce par SMS, non.
  const lieuSur = lieu && motInterditDans(lieu) === null ? lieu : null;
  if (lieuSur) return `${nomCourt}: rendez-vous le ${quand} a ${lieuSur}.`;
  return lieu
    ? `${nomCourt}: rendez-vous le ${quand}. Lieu et details dans votre espace.`
    : `${nomCourt}: rendez-vous le ${quand}.`;
}

/**
 * Une demarche du patient a abouti ou non — un transfert accepte, par
 * exemple. On dit l'issue et le lieu, jamais la raison du soin.
 */
export function messageDemarche(nomCourt: string, aboutie: boolean, lieu: string): string {
  return aboutie
    ? `${nomCourt}: votre demarche vers ${lieu} est acceptee. Presentez-vous avec votre QR code.`
    : `${nomCourt}: votre demarche vers ${lieu} n'a pas abouti. Details dans votre espace.`;
}

/**
 * Un professionnel doit agir sans delai sur un dossier.
 *
 * Le numero de demande est **opaque** : il n'apprend rien a qui lit par-dessus
 * l'epaule, et suffit au destinataire pour retrouver le dossier.
 */
export function messageProfessionnelUrgent(nomCourt: string, numero: string): string {
  return `${nomCourt}: la demande ${numero} requiert votre attention immediate. Connectez-vous.`;
}

/** Un professionnel doit intervenir, sans urgence vitale. */
export function messageProfessionnelIntervention(nomCourt: string, numero: string): string {
  return `${nomCourt}: la demande ${numero} requiert une intervention. Connectez-vous.`;
}

/**
 * Alerte de stock a un agent.
 *
 * Le produit n'est pas nomme. Ce n'est pas une donnee de patient, mais la
 * regle est la meme pour tous les messages sortants, et l'agent se connecte
 * de toute facon pour reapprovisionner.
 */
export function messageStockCritique(nomCourt: string): string {
  return `${nomCourt} ALERTE: un produit de votre stock est sous son seuil. Connectez-vous.`;
}

/**
 * Un rappel a echeance — une vaccination due, par exemple.
 *
 * L'echeance et l'invitation a contacter son agent suffisent a declencher
 * l'action. Nommer l'acte reviendrait a annoncer un statut vaccinal par SMS.
 */
export function messageEcheance(nomCourt: string, quand: string): string {
  return `${nomCourt}: un rappel vous concerne, echeance le ${quand}. Contactez votre agent ou consultez votre espace.`;
}

// ── Risque residuel, assume et consigne ──────────────────────────────
//
// Un rappel de rendez-vous nomme l'etablissement. Si cet etablissement
// s'appelle « Laboratoire Cece » ou « Centre de traitement X », son nom
// revele la nature du soin — et aucun filtre de vocabulaire ne peut le
// rattraper, puisque le nom vient de la base.
//
// La correction propre est un **libelle public neutre** par structure, choisi
// a l'enregistrement et utilise dans les messages sortants. Elle releve de
// l'administration des referentiels (P11) et n'est pas faite.
