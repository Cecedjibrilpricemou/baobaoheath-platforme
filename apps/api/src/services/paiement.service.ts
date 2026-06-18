import { prisma } from '../config/prisma';
import {
  ConfirmerPaiementDto,
  InitierPaiementDto,
  PaiementFilters,
} from '../types/paiement.types';
import { initierPaiementSimule } from './payment-provider.service';

const MAX_MONTANT_GNF = 10_000_000;

export async function initierPaiement(userId: string, dto: InitierPaiementDto) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: dto.idConsultation },
    include: { patient: true, facture: true },
  });

  if (!consultation) throw new Error('Consultation non trouvee');
  if (consultation.facture) throw new Error('Une facture existe deja pour cette consultation');

  if (consultation.patient.idUtilisateur !== userId) {
    throw new Error("Acces refuse - ce n'est pas votre consultation");
  }

  // Use server-side tariff when set; otherwise cap client-provided amount
  const montantGnf = consultation.tarifGnf != null && consultation.tarifGnf > 0
    ? consultation.tarifGnf
    : Math.min(dto.montantGnf, MAX_MONTANT_GNF);

  const providerResult = await initierPaiementSimule({
    modePaiement: dto.modePaiement,
    montantGnf,
    numeroOperateur: dto.numeroOperateur,
  });

  return prisma.facture.create({
    data: {
      idPatient: consultation.patient.id,
      idConsultation: dto.idConsultation,
      montantGnf,
      modePaiement: dto.modePaiement,
      numeroOperateur: dto.numeroOperateur,
      referenceOperateur: providerResult.referenceOperateur,
      statut: providerResult.statut,
    },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: { prenom: true, nom: true, telephone: true },
          },
        },
      },
      consultation: true,
    },
  });
}

export async function verifierStatutPaiement(userId: string, idFacture: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: { prenom: true, nom: true },
          },
        },
      },
      consultation: true,
    },
  });

  if (!facture) throw new Error('Facture non trouvee');
  if (facture.patient.idUtilisateur !== userId) throw new Error('Acces refuse');

  return facture;
}

export async function confirmerPaiement(idFacture: string, dto: ConfirmerPaiementDto) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
  });

  if (!facture) throw new Error('Facture non trouvee');
  if (facture.statut === 'PAYEE') throw new Error('Cette facture a deja ete payee');

  return prisma.facture.update({
    where: { id: idFacture },
    data: {
      statut: 'PAYEE',
      referenceOperateur: dto.referenceOperateur,
      payeeLe: new Date(),
    },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: { prenom: true, nom: true, telephone: true },
          },
        },
      },
    },
  });
}

export async function getHistoriquePaiements(userId: string, filters: PaiementFilters) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
  });

  if (!patient) throw new Error('Profil patient non trouve');

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    idPatient: patient.id,
    ...(filters.statut && { statut: filters.statut }),
    ...(filters.modePaiement && { modePaiement: filters.modePaiement }),
  };

  const [factures, total] = await Promise.all([
    prisma.facture.findMany({
      where,
      skip,
      take: limit,
      include: {
        consultation: {
          select: {
            motifPrincipal: true,
            consulteeLE: true,
          },
        },
      },
      orderBy: { creeLe: 'desc' },
    }),
    prisma.facture.count({ where }),
  ]);

  return {
    data: factures,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function annulerPaiement(userId: string, idFacture: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: { patient: true },
  });

  if (!facture) throw new Error('Facture non trouvee');
  if (facture.patient.idUtilisateur !== userId) throw new Error('Acces refuse');
  if (facture.statut === 'PAYEE') throw new Error("Impossible d'annuler une facture deja payee");

  return prisma.facture.update({
    where: { id: idFacture },
    data: { statut: 'ANNULEE' },
  });
}
