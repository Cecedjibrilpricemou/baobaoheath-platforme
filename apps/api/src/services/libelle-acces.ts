/**
 * Dire a un patient ce qui s'est passe sur son dossier (EF-02-08).
 *
 * Le journal enregistre des motifs de route : `GET /:id`, `GET /scan/:qrCode`,
 * `POST /ventes`. L'ecran du patient les affichait tels quels, dans une balise
 * `<code>`. Un patient ne lit pas `GET /:id` — et un journal illisible ne
 * remplit pas l'obligation de transparence, il la simule.
 *
 * **Ce module rend des cles de traduction, pas du texte.** La premiere version
 * rendait des phrases francaises, ce qui aurait affiche du francais a un
 * patient ayant choisi l'anglais — l'application est bilingue, le selecteur de
 * langue est a l'ecran. La formulation vit donc dans
 * `apps/web/src/app/shared/i18n/{fr,en}.json`, comme tout le reste de
 * l'interface, et un test verifie que chaque cle produite ici y existe
 * reellement dans les deux langues.
 *
 * Ce module est volontairement **pur** : pas de base, pas de requete.
 *
 * Trois regles de redaction, qui expliquent les choix ci-dessous :
 *
 *   1. **Ne jamais nommer un contenu medical.** Un journal se lit parfois sur
 *      un ecran partage. « ordonnance » et « medicament » sont deja des mots
 *      interdits par EF-11-02, et le filtre `motInterditDans` les a refuses
 *      quand je les ai essayes — c'est un test qui l'a montre, pas une
 *      supposition. On ne cree pas deux standards de neutralite sur la meme
 *      plateforme : les objets restent generaux. Une anomalie se repere a
 *      l'auteur et a l'heure, pas au type de document, et `action` plus
 *      `ressource` gardent le detail technique pour une enquete.
 *   2. **Ne pas pretendre plus de precision qu'on en a.** Une ressource
 *      inconnue — ou mal enregistree, ce qui est arrive 120 fois dans la base
 *      de demonstration — reste designee largement.
 *   3. **Distinguer la lecture de l'ecriture.** « consulte » et « modifie »
 *      n'ont pas les memes consequences pour un patient.
 */

/** Ce que le journal enregistre d'une requete, reduit au necessaire. */
export type AccesBrut = {
  /** Le motif de route, tel qu'enregistre : `GET /:id`, `POST /ventes`. */
  action: string;
  /** Le premier segment apres `/api/v1`, tel qu'enregistre. */
  ressource: string;
};

/** Les deux cles a traduire : la phrase, et l'objet qu'elle designe. */
export type LibelleAcces = {
  /** Ex. `PATIENT.CONSENTS.ACCESS_LABEL.READ`. Attend un parametre `objet`. */
  cle: string;
  /**
   * Ex. `PATIENT.CONSENTS.ACCESS_OBJECT.PATIENTS`. Vide pour les phrases qui
   * se suffisent a elles-memes, comme le scan d'un code.
   */
  objet: string;
};

const PREFIXE = 'PATIENT.CONSENTS.ACCESS_LABEL';
const PREFIXE_OBJET = 'PATIENT.CONSENTS.ACCESS_OBJECT';

type Verbe = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE';

function verbeDe(action: string): Verbe {
  const methode = action.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  if (methode === 'POST') return 'CREATE';
  if (methode === 'PUT' || methode === 'PATCH') return 'UPDATE';
  if (methode === 'DELETE') return 'DELETE';
  // Une methode imprevue est traitee comme une lecture : c'est l'hypothese la
  // moins affirmative, et elle ne pretend pas une ecriture qui n'a pas eu lieu.
  return 'READ';
}

/** Ce que designe la ressource, en mots de patient. Voir la regle 1. */
const OBJET: Record<string, string> = {
  patients: 'RECORD',
  consultations: 'CONSULTATION',
  ordonnances: 'DOCUMENT',
  episodes: 'CARE_EPISODE',
  vaccinations: 'IMMUNISATION',
  laboratoire: 'DOCUMENT',
  resultats: 'DOCUMENT',
  hopital: 'HOSPITAL_RECORD',
  commandes: 'PHARMACY_ORDER',
  pharmacien: 'PHARMACY_VISIT',
  assurance: 'INSURANCE',
  paiements: 'PAYMENT',
  factures: 'INVOICE',
  privacy: 'PRIVACY_SETTINGS',
  'rendez-vous': 'APPOINTMENT',
  fhir: 'EXTERNAL_EXCHANGE',
  sync: 'OFFLINE_SYNC',
};

/**
 * Les ressources que **seule une enquete** voit.
 *
 * Elles n'apparaissent jamais dans le journal d'un patient : ces actions ne
 * touchent aucun dossier, donc elles n'ont pas de patient concerne. Les
 * ranger a part evite d'exiger une traduction cote patient pour « votre
 * journal d'audit », qui n'aurait aucun sens — c'est un test qui l'a signale,
 * en reclamant `PATIENT.CONSENTS.ACCESS_OBJECT.AUDIT_LOG`.
 *
 * Sans elles, une tentative refusee sur le journal d'audit s'affichait
 * « Dossier » dans l'ecran d'enquete. Vu a l'ecran le 2026-10-03.
 */
const OBJET_ADMINISTRATION: Record<string, string> = {
  journal: 'AUDIT_LOG',
  comptes: 'ACCOUNTS',
  parametres: 'SETTINGS',
  referentiels: 'REFERENCE_DATA',
  analytics: 'STATISTICS',
};

/**
 * Les cles a traduire pour une ligne de journal.
 *
 * `parMoi` change la formulation, pas le contenu : « Vous avez consulte votre
 * dossier » n'inquiete pas, « Votre dossier a ete consulte » doit pouvoir
 * attirer l'oeil. Sans cette distinction, les consultations du patient noient
 * celles des tiers — 273 lignes sur 850 dans la base de demonstration.
 */
/**
 * Ce qu'une ligne de journal **est**, independamment de qui la lit.
 *
 * Le meme acces se raconte autrement selon le lecteur : « Votre dossier a ete
 * consulte » pour le patient, « Dossier consulte » pour l'administrateur qui
 * enquete sur le dossier d'un tiers. La premiere version de l'ecran
 * d'administration reemployait les libelles du patient et affichait donc
 * « votre dossier a ete consulte » a propos du dossier de quelqu'un d'autre —
 * vu a l'ecran le 2026-10-03.
 *
 * Cette fonction rend les deux parties nues ; chaque vue en fabrique ses
 * propres cles. Une seule table de correspondance, deux redactions.
 */
export function partiesAcces(acces: AccesBrut): { verbe: string; objet: string } {
  // Le scan d'un code au comptoir : le geste le plus concret du journal, et
  // celui qui n'etait pas trace avant le 2026-09-29. La phrase se suffit a
  // elle-meme, donc pas d'objet.
  if (/\/(scan|qr)\//.test(acces.action)) {
    return { verbe: 'SCAN', objet: '' };
  }
  return {
    verbe: verbeDe(acces.action),
    objet: OBJET[acces.ressource] ?? OBJET_ADMINISTRATION[acces.ressource] ?? 'RECORD',
  };
}

export function libelleAcces(acces: AccesBrut, parMoi: boolean): LibelleAcces {
  const { verbe, objet } = partiesAcces(acces);
  const suffixe = parMoi ? '_BY_ME' : '';
  return {
    cle: `${PREFIXE}.${verbe}${suffixe}`,
    objet: objet ? `${PREFIXE_OBJET}.${objet}` : '',
  };
}

/**
 * Les memes cles, redigees pour une enquete : le patient est un tiers, et la
 * colonne « patient concerne » le nomme deja juste a cote.
 */
export function libelleAccesAdministration(acces: AccesBrut, refuse = false): LibelleAcces {
  const { verbe, objet } = partiesAcces(acces);

  // **Un acces refuse n'a rien consulte.** L'ecran affichait « Dossier
  // consulte » a cote d'un 403 : la phrase contredisait le code juste a cote,
  // et c'est exactement ce qu'une enquete ne doit pas lire. Vu a l'ecran le
  // 2026-10-03. Le detail de la tentative reste dans `action`.
  if (refuse) {
    return {
      cle: 'ADMIN.JOURNAL.ACTION_LABEL.REFUSE',
      objet: objet ? `ADMIN.JOURNAL.ACTION_OBJECT.${objet}` : 'ADMIN.JOURNAL.ACTION_OBJECT.RECORD',
    };
  }

  return {
    cle: `ADMIN.JOURNAL.ACTION_LABEL.${verbe}`,
    objet: objet ? `ADMIN.JOURNAL.ACTION_OBJECT.${objet}` : '',
  };
}

/**
 * Toutes les cles que ce module peut produire.
 *
 * Sert au test qui verifie qu'aucune ne manque dans fr.json ni dans en.json :
 * une cle absente s'afficherait telle quelle a l'ecran, en majuscules et avec
 * des points.
 */
export function toutesLesCles(): string[] {
  const cles = new Set<string>();
  for (const verbe of ['READ', 'CREATE', 'UPDATE', 'DELETE', 'SCAN']) {
    cles.add(`${PREFIXE}.${verbe}`);
    cles.add(`${PREFIXE}.${verbe}_BY_ME`);
    cles.add(`ADMIN.JOURNAL.ACTION_LABEL.${verbe}`);
  }
  cles.add('ADMIN.JOURNAL.ACTION_LABEL.REFUSE');
  for (const objet of [...Object.values(OBJET), 'RECORD']) {
    cles.add(`${PREFIXE_OBJET}.${objet}`);
    cles.add(`ADMIN.JOURNAL.ACTION_OBJECT.${objet}`);
  }
  // Celles-la n'existent que cote enquete : un patient ne verra jamais une
  // ligne portant sur le journal d'audit ou sur les comptes.
  for (const objet of Object.values(OBJET_ADMINISTRATION)) {
    cles.add(`ADMIN.JOURNAL.ACTION_OBJECT.${objet}`);
  }
  return [...cles].sort();
}
