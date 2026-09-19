// features/hopital/hopital.utils.ts — classes de badge partagees par les pages Hopital et Parcours patient.
import type { StatutDemandeAnalyse, StatutEpisode, Urgence } from '@baobaoheath/shared-types';

export function statutEpisodeClasse(statut: StatutEpisode): string {
  const map: Record<StatutEpisode, string> = {
    OUVERT: 'bb-badge--info', EN_COURS: 'bb-badge--success', CLOS: 'bb-badge--neutral', ANNULE: 'bb-badge--danger',
  };
  return `bb-badge ${map[statut]}`;
}

export function statutDemandeClasse(statut: StatutDemandeAnalyse): string {
  const map: Record<StatutDemandeAnalyse, string> = {
    TRANSMISE: 'bb-badge--info', RECUE: 'bb-badge--info', PRELEVEE: 'bb-badge--warning',
    EN_ANALYSE: 'bb-badge--warning', VALIDEE: 'bb-badge--success', ANNULEE: 'bb-badge--danger',
  };
  return `bb-badge ${map[statut]}`;
}

export function urgenceClasse(urgence: Urgence): string {
  const map: Record<Urgence, string> = { ROUTINE: 'bb-badge--neutral', URGENT: 'bb-badge--warning', URGENCE_VITALE: 'bb-badge--danger' };
  return `bb-badge ${map[urgence]}`;
}

/** Valeur locale pour <input type="datetime-local"> : demain 9 h. */
export function dateLocaleParDefaut(): string {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
