import { TypeStructure } from '../config/generated/client/client';

export const TYPES_STRUCTURES_HOSPITALIERES: TypeStructure[] = [
  TypeStructure.HOPITAL_PREF,
  TypeStructure.HOPITAL_REG,
  TypeStructure.CHU,
  TypeStructure.CLINIQUE,
];

export function estStructureHospitaliere(type: TypeStructure): boolean {
  return TYPES_STRUCTURES_HOSPITALIERES.includes(type);
}

export function estStructureOfficinale(type: TypeStructure): boolean {
  return type === TypeStructure.PHARMACIE;
}

export function filtreStructuresOfficinales() {
  return { type: TypeStructure.PHARMACIE };
}
