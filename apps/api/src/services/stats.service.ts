import { prisma } from '../config/prisma';

export interface PublicStats {
  patients: number;
  consultations: number;
  asc: number;
  structures: number;
}

export async function getPublicStats(): Promise<PublicStats> {
  const [patients, consultations, asc, structures] = await Promise.all([
    prisma.patientProfile.count(),
    prisma.consultation.count({ where: { statut: 'TERMINEE' } }),
    prisma.ascProfile.count(),
    prisma.structureSante.count(),
  ]);
  return { patients, consultations, asc, structures };
}
