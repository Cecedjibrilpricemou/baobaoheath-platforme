import { prisma } from '../config/prisma';
import {
  InitierPaiementDto,
  ConfirmerPaiementDto,
  PaiementFilters,
} from '../types/paiement.types';
import { randomUUID } from 'crypto';

// ─── MOCK — Simuler appel Orange Money ───────────────────
async function mockOrangeMoneyRequest(
  montant: number,
  numero: string
): Promise<{ reference: string; statut: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    reference: `OM-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    statut: 'EN_ATTENTE',
  };
}

// ─── MOCK — Simuler appel MTN MoMo ───────────────────────
async function mockMtnMomoRequest(
  montant: number,
  numero: string
): Promise<{ reference: string; statut: string }> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    reference: `MTN-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    statut: 'EN_ATTENTE',
  };
}

// ─── Initier un paiement ──────────────────────────────────
export async function initierPaiement(
  userId: string,
  dto: InitierPaiementDto
) {
  // Vérifier que la consultation existe
  const consultation = await prisma.consultation.findUnique({
    where: { id: dto.idConsultation },
    include: { patient: true, facture: true },
  });

  if (!consultation) {
    throw new Error('Consultation non trouvée');
  }

  if (consultation.facture) {
    throw new Error('Une facture existe déjà pour cette consultation');
  }

  // Vérifier que le patient est bien celui connecté
  if (consultation.patient.idUtilisateur !== userId) {
    throw new Error('Accès refusé — ce n\'est pas votre consultation');
  }

  let referenceOperateur: string | undefined;

  // Appel API selon le mode de paiement
  if (dto.modePaiement === 'ORANGE_MONEY') {
    if (!dto.numeroOperateur) {
      throw new Error('Numéro Orange Money requis');
    }
    const result = await mockOrangeMoneyRequest(
      dto.montantGnf,
      dto.numeroOperateur
    );
    referenceOperateur = result.reference;
  } else if (dto.modePaiement === 'MTN_MOMO') {
    if (!dto.numeroOperateur) {
      throw new Error('Numéro MTN MoMo requis');
    }
    const result = await mockMtnMomoRequest(
      dto.montantGnf,
      dto.numeroOperateur
    );
    referenceOperateur = result.reference;
  }

  // Créer la facture en base
  const facture = await prisma.facture.create({
    data: {
      idPatient: consultation.patient.id,
      idConsultation: dto.idConsultation,
      montantGnf: dto.montantGnf,
      modePaiement: dto.modePaiement,
      numeroOperateur: dto.numeroOperateur,
      referenceOperateur,
      statut: dto.modePaiement === 'ESPECES' ? 'EN_ATTENTE' : 'EN_ATTENTE',
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

  return facture;
}

// ─── Vérifier le statut d'un paiement ────────────────────
export async function verifierStatutPaiement(
  userId: string,
  idFacture: string
) {
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

  if (!facture) {
    throw new Error('Facture non trouvée');
  }

  if (facture.patient.idUtilisateur !== userId) {
    throw new Error('Accès refusé');
  }

  return facture;
}

// ─── Confirmer un paiement ────────────────────────────────
export async function confirmerPaiement(
  idFacture: string,
  dto: ConfirmerPaiementDto
) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
  });

  if (!facture) {
    throw new Error('Facture non trouvée');
  }

  if (facture.statut === 'PAYEE') {
    throw new Error('Cette facture a déjà été payée');
  }

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

// ─── Historique des paiements du patient ─────────────────
export async function getHistoriquePaiements(
  userId: string,
  filters: PaiementFilters
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
  });

  if (!patient) {
    throw new Error('Profil patient non trouvé');
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    idPatient: patient.id,
    ...(filters.statut && { statut: filters.statut as any }),
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

// ─── Annuler un paiement ──────────────────────────────────
export async function annulerPaiement(
  userId: string,
  idFacture: string
) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: { patient: true },
  });

  if (!facture) {
    throw new Error('Facture non trouvée');
  }

  if (facture.patient.idUtilisateur !== userId) {
    throw new Error('Accès refusé');
  }

  if (facture.statut === 'PAYEE') {
    throw new Error('Impossible d\'annuler une facture déjà payée');
  }

  return prisma.facture.update({
    where: { id: idFacture },
    data: { statut: 'ANNULEE' },
  });
}