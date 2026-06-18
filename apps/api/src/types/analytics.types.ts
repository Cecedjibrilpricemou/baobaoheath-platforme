export type { AnalyticsFilters, ExportFilters } from '@baobaoheath/shared-types';

export interface HeatmapFilters {
  pathologie?: string;
  debut?: string;
  fin?: string;
}

export interface AlerteEpidemique {
  pathologie: string;
  prefecture: string;
  nombre: number;
  seuil: number;
  niveau: 'ATTENTION' | 'ALERTE' | 'URGENCE';
  dateDetection: Date;
}
