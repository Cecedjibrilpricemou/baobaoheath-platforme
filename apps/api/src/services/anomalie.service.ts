import { prisma } from '../config/prisma';
import type { AnomalieView, SeuilsAnomalies, TypeAnomalie } from '@baobaoheath/shared-types';

/**
 * Detection d'anomalies d'acces (EF-12-06).
 *
 * **Ce que ce service est, et ce qu'il n'est pas.** Il rend des *signaux a
 * examiner*, pas des verdicts. Un soignant de garde consulte beaucoup de
 * dossiers la nuit sans rien faire de mal ; un comptoir de pharmacie scanne
 * des dizaines de codes par jour. Un detecteur qui pretendrait trancher ferait
 * suspendre des gens a tort — et la suspension, elle, coupe un soignant de ses
 * patients. Chaque signal porte donc ce qui l'a declenche, de quoi aller voir
 * le detail dans le journal, et rien de plus.
 *
 * **Les seuils ci-dessous sont des points de depart, pas des verites.** Ils
 * n'ont pas ete calibres sur du trafic reel — la base de demonstration ne
 * porte que l'activite de quelques comptes de test. Il faudra les reprendre
 * apres quelques semaines d'exploitation, et probablement les faire varier
 * selon le role : un pharmacien et un medecin n'ont pas le meme volume normal.
 * C'est ecrit ici pour qu'on ne prenne pas ces nombres pour des references.
 */

/**
 * Les codes qui comptent comme un refus d'acces.
 *
 * **Pas tous les 4xx.** Un 400 est une requete mal formee — un client qui se
 * trompe, pas quelqu'un qui force une porte ; la base de demonstration en
 * portait 58, tous issus de scripts de verification. Un 404 peut signaler une
 * enumeration d'identifiants, mais aussi une ressource effacee : trop bruyant
 * pour declencher seul. Restent 401 et 403, qui disent « vous n'avez pas le
 * droit » — c'est le signal qu'on cherche.
 */
const CODES_DE_REFUS = [401, 403];

export const SEUILS_PAR_DEFAUT: SeuilsAnomalies = {
  /** Cinq refus en une heure : au-dela, ce n'est plus une main qui glisse. */
  refusRepetes: 5,
  /**
   * Trente dossiers distincts en une heure. Volontairement haut : un comptoir
   * de pharmacie un jour de forte affluence en depasse vingt sans rien faire
   * d'anormal. A recalibrer par role.
   */
  dossiersDistincts: 30,
  /**
   * Deux adresses IP differentes dans la meme heure pour un seul compte :
   * identifiants partages, ou voles. Un soignant qui passe du wifi de
   * l'hopital a son telephone declenche ce signal — d'ou son rang de simple
   * signal, et non d'alerte.
   */
  adressesDistinctes: 2,
  fenetreHeures: 1,
};

type Mesure = {
  idUtilisateur: string;
  refus: number;
  dossiers: number;
  adresses: number;
};

/**
 * Quels signaux une mesure declenche, et a quel rang.
 *
 * Fonction pure, exportee : c'est elle qui decide ce qu'un administrateur
 * verra, et elle doit pouvoir etre eprouvee sans base. Le rang monte avec le
 * depassement, parce qu'un compte a six refus et un compte a soixante
 * n'appellent pas la meme reaction.
 */
export function evaluer(
  mesure: Mesure,
  seuils: SeuilsAnomalies
): { type: TypeAnomalie; mesure: number; seuil: number; gravite: 'SIGNAL' | 'ALERTE' }[] {
  const signaux: { type: TypeAnomalie; mesure: number; seuil: number; gravite: 'SIGNAL' | 'ALERTE' }[] = [];

  const rang = (valeur: number, seuil: number): 'SIGNAL' | 'ALERTE' =>
    valeur >= seuil * 3 ? 'ALERTE' : 'SIGNAL';

  if (mesure.refus >= seuils.refusRepetes) {
    signaux.push({
      type: 'REFUS_REPETES',
      mesure: mesure.refus,
      seuil: seuils.refusRepetes,
      gravite: rang(mesure.refus, seuils.refusRepetes),
    });
  }

  if (mesure.dossiers >= seuils.dossiersDistincts) {
    signaux.push({
      type: 'VOLUME_DOSSIERS',
      mesure: mesure.dossiers,
      seuil: seuils.dossiersDistincts,
      gravite: rang(mesure.dossiers, seuils.dossiersDistincts),
    });
  }

  // Celui-la ne monte jamais en alerte : un soignant qui passe du wifi de
  // l'etablissement a son telephone le declenche. C'est un point de depart
  // d'enquete, pas un motif.
  if (mesure.adresses >= seuils.adressesDistinctes) {
    signaux.push({
      type: 'ADRESSES_MULTIPLES',
      mesure: mesure.adresses,
      seuil: seuils.adressesDistinctes,
      gravite: 'SIGNAL',
    });
  }

  return signaux;
}

/**
 * Les mesures par acteur sur la fenetre.
 *
 * Trois agregats distincts plutot qu'une requete unique : les trois comptent
 * des choses differentes (lignes de refus, patients distincts, adresses
 * distinctes), et PostgreSQL les sert par les index poses pour EF-12-05.
 */
async function mesurer(depuis: Date): Promise<Map<string, Mesure>> {
  const [refus, lignes] = await Promise.all([
    prisma.journalAudit.groupBy({
      by: ['idUtilisateur'],
      where: { creeLe: { gte: depuis }, statutHttp: { in: CODES_DE_REFUS } },
      _count: { _all: true },
    }),
    // On ne peut pas compter des valeurs distinctes par groupe avec `groupBy`
    // sans SQL brut : on lit les couples (acteur, patient) et (acteur, ip) de
    // la fenetre, ce qui reste borne par l'index sur `creeLe`.
    prisma.journalAudit.findMany({
      where: { creeLe: { gte: depuis } },
      select: { idUtilisateur: true, idPatientConcerne: true, ipAdresse: true },
    }),
  ]);

  const mesures = new Map<string, Mesure & { setDossiers: Set<string>; setAdresses: Set<string> }>();
  const obtenir = (id: string) => {
    let m = mesures.get(id);
    if (!m) {
      m = { idUtilisateur: id, refus: 0, dossiers: 0, adresses: 0, setDossiers: new Set(), setAdresses: new Set() };
      mesures.set(id, m);
    }
    return m;
  };

  for (const l of lignes) {
    const m = obtenir(l.idUtilisateur);
    if (l.idPatientConcerne) m.setDossiers.add(l.idPatientConcerne);
    if (l.ipAdresse) m.setAdresses.add(l.ipAdresse);
  }
  for (const r of refus) {
    obtenir(r.idUtilisateur).refus = r._count._all;
  }

  const sortie = new Map<string, Mesure>();
  for (const [id, m] of mesures) {
    sortie.set(id, {
      idUtilisateur: id,
      refus: m.refus,
      dossiers: m.setDossiers.size,
      adresses: m.setAdresses.size,
    });
  }
  return sortie;
}

export async function detecter(
  seuils: SeuilsAnomalies = SEUILS_PAR_DEFAUT,
  maintenant = new Date()
): Promise<{ anomalies: AnomalieView[]; seuils: SeuilsAnomalies; depuis: string }> {
  const depuis = new Date(maintenant.getTime() - seuils.fenetreHeures * 3_600_000);
  const mesures = await mesurer(depuis);

  const retenus: { mesure: Mesure; signaux: ReturnType<typeof evaluer> }[] = [];
  for (const mesure of mesures.values()) {
    const signaux = evaluer(mesure, seuils);
    if (signaux.length > 0) retenus.push({ mesure, signaux });
  }

  if (retenus.length === 0) {
    return { anomalies: [], seuils, depuis: depuis.toISOString() };
  }

  // On ne nomme les acteurs qu'une fois les signaux retenus : inutile de
  // charger des comptes qui ne declenchent rien.
  const acteurs = await prisma.utilisateur.findMany({
    where: { id: { in: retenus.map((r) => r.mesure.idUtilisateur) } },
    select: { id: true, prenom: true, nom: true, role: true, estActif: true },
  });
  const parId = new Map(acteurs.map((a) => [a.id, a]));

  const anomalies: AnomalieView[] = [];
  for (const { mesure, signaux } of retenus) {
    const a = parId.get(mesure.idUtilisateur);
    for (const s of signaux) {
      anomalies.push({
        type: s.type,
        gravite: s.gravite,
        idUtilisateur: mesure.idUtilisateur,
        acteur: a ? `${a.prenom} ${a.nom}` : 'Compte supprime',
        role: a?.role ?? null,
        acteurActif: a?.estActif ?? false,
        mesure: s.mesure,
        seuil: s.seuil,
        depuis: depuis.toISOString(),
      });
    }
  }

  // Les alertes d'abord, puis le depassement le plus net : un administrateur
  // qui ouvre cet ecran doit voir en haut ce qui merite son attention.
  anomalies.sort((x, y) => {
    if (x.gravite !== y.gravite) return x.gravite === 'ALERTE' ? -1 : 1;
    return y.mesure / y.seuil - x.mesure / x.seuil;
  });

  return { anomalies, seuils, depuis: depuis.toISOString() };
}
