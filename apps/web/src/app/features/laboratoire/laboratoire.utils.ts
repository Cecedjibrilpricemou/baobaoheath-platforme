// features/laboratoire/laboratoire.utils.ts — lecture des resultats et etapes
// du cycle laboratoire, partagees avec l'accueil et le parcours patient.
import type { DemandeAnalyseView, InterpretationResultat, LigneDemandeAnalyseView, StatutDemandeAnalyse } from '@baobaoheath/shared-types';

export function interpretationClasse(i: InterpretationResultat | null | undefined): string {
  const map: Record<InterpretationResultat, string> = { NORMAL: 'bb-badge--success', ANORMAL: 'bb-badge--warning', CRITIQUE: 'bb-badge--danger' };
  return `bb-badge ${i ? map[i] : 'bb-badge--neutral'}`;
}

/** Intervalle de reference lisible : « 12 – 17 », « ≤ 5 », « Negatif »… */
export function referenceLisible(l: LigneDemandeAnalyseView): string {
  const r = l.resultat ?? l.examen;
  if (r.refMin !== null && r.refMax !== null) return `${r.refMin} – ${r.refMax}`;
  if (r.refMin !== null) return `≥ ${r.refMin}`;
  if (r.refMax !== null) return `≤ ${r.refMax}`;
  return r.refTexte ?? '—';
}

/** Etapes du cycle, dans l'ordre ; ANNULEE est hors frise. */
export const ETAPES_DEMANDE: StatutDemandeAnalyse[] = ['TRANSMISE', 'RECUE', 'PRELEVEE', 'EN_ANALYSE', 'VALIDEE'];

export function indexEtape(statut: StatutDemandeAnalyse): number {
  return ETAPES_DEMANDE.indexOf(statut);
}

export function nbResultatsSaisis(d: DemandeAnalyseView): number {
  return d.lignes.filter((l) => l.resultat).length;
}

export function aResultatCritique(d: DemandeAnalyseView): boolean {
  return d.lignes.some((l) => l.resultat?.interpretation === 'CRITIQUE');
}

/**
 * Apercu de la lecture pendant la saisie, memes regles que l'API
 * (laboratoire.service interpreter) : la valeur retenue reste celle du serveur.
 */
export function apercuInterpretation(valeur: string, examen: LigneDemandeAnalyseView['examen']): InterpretationResultat | null {
  const v = valeur.trim();
  if (!v) return null;
  const n = Number(v.replace(',', '.').replace(/^[<>]=?\s*/, ''));
  if (Number.isFinite(n)) {
    if ((examen.critiqueMin !== null && n < examen.critiqueMin) || (examen.critiqueMax !== null && n > examen.critiqueMax)) return 'CRITIQUE';
    if ((examen.refMin !== null && n < examen.refMin) || (examen.refMax !== null && n > examen.refMax)) return 'ANORMAL';
    return 'NORMAL';
  }
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (examen.refTexte && norm(v) !== norm(examen.refTexte)) return 'ANORMAL';
  return 'NORMAL';
}
