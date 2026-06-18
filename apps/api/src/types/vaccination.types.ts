export type { CreateVaccinationDto, UpdateVaccinationDto, VaccinationFilters } from '@baobaoheath/shared-types';

export interface RappelVaccinationFilters {
  joursAvant?: number;
  prefecture?: string;
}
