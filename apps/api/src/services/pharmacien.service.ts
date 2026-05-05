// src/services/pharmacien.service.ts
import { prisma } from '../config/prisma';

export async function scanPatient(qrCode: string, pharmacienId: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { qrCode },
    include: {
      utilisateur: { select: { id: true, prenom: true, nom: true, telephone: true } },
      consultations: {
        where: { statut: 'TERMINEE' },
        include: { ordonnances: { include: { medicament: true } } },
        orderBy: { consulteeLE: 'desc' },
        take: 5
      }
    }
  });
  if (!patient) throw new Error('Patient non trouvé');
  return patient;
}

export async function delivrerOrdonnance(ordonnanceId: string, pharmacienId: string, dto: {
  modePaiement: string;
}) {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: ordonnanceId },
    include: { medicament: true }
  });
  if (!ordonnance) throw new Error('Ordonnance non trouvée');

  const pharmacien = await prisma.utilisateur.findUnique({
    where: { id: pharmacienId },
    include: { structure: true }
  });
  if (!pharmacien?.idStructure) throw new Error('Pharmacien sans structure assignée');

  const stock = await prisma.stock.findFirst({
    where: { idMedicament: ordonnance.idMedicament, idStructure: pharmacien.idStructure }
  });
  if (!stock || stock.quantite < ordonnance.quantite) {
    throw new Error('Stock insuffisant pour délivrer cette ordonnance');
  }

  const [updatedOrdonnance] = await prisma.$transaction([
    prisma.ordonnance.update({
      where: { id: ordonnanceId },
      data: { estDelivree: true }
    }),
    prisma.stock.update({
      where: { id: stock.id },
      data: { quantite: { decrement: ordonnance.quantite } }
    })
  ]);

  return updatedOrdonnance;
}

export async function getStocksPharmacie(pharmacienId: string) {
  const pharmacien = await prisma.utilisateur.findUnique({ where: { id: pharmacienId } });
  if (!pharmacien?.idStructure) throw new Error('Aucune structure assignée');

  return prisma.stock.findMany({
    where: { idStructure: pharmacien.idStructure },
    include: { medicament: true },
    orderBy: { quantite: 'asc' }
  });
}

export async function getOrdonnances(pharmacienId: string) {
  const pharmacien = await prisma.utilisateur.findUnique({ where: { id: pharmacienId } });
  if (!pharmacien?.idStructure) throw new Error('Aucune structure assignée');

  return prisma.ordonnance.findMany({
    where: { estDelivree: false },
    include: {
      medicament: true,
      consultation: {
        include: {
          patient: {
            include: {
              utilisateur: { select: { prenom: true, nom: true, telephone: true } }
            }
          }
        }
      }
    },
    orderBy: { creeLe: 'desc' },
    take: 50
  });
}

export async function trouverPharmaciesProches(prefecture: string) {
  return prisma.structureSante.findMany({
    where: { type: 'PHARMACIE', prefecture, estActive: true },
    select: { id: true, nom: true, adresse: true, telephone: true, latitude: true, longitude: true }
  });
}
