// src/services/pharmacien.service.ts
import { prisma } from '../config/prisma';

// ── Scanner QR Code patient ───────────────────────────────
// Retourne uniquement les données nécessaires à la délivrance
// Le pharmacien ne voit PAS les diagnostics, constantes, notes médecin
export async function scanPatient(qrCode: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { qrCode },
    include: {
      utilisateur: {
        select: { prenom: true, nom: true, telephone: true }
      }
    }
  });

  if (!patient) throw new Error('Patient non trouvé — QR Code invalide');

  // Ordonnances signées et non encore délivrées
  const ordonnances = await prisma.ordonnance.findMany({
    where: {
      consultation: { idPatient: patient.id },
      statut: 'EN_ATTENTE',
      signeLe: { not: null }
    },
    include: {
      medicament: {
        select: {
          id: true, dci: true, nomCommercial: true,
          forme: true, dosage: true, prixUnitaireGnf: true
        }
      },
      signataire: {
        select: { prenom: true, nom: true }
      }
    },
    orderBy: { signeLe: 'desc' }
  });

  // Vérifier les conflits d'allergie pour chaque médicament
  const allergies = patient.allergies ?? [];
  const ordonnancesAvecAlertes = ordonnances.map(o => {
    const alerteAllergie = allergies.some(a =>
      o.medicament.dci.toLowerCase().includes(a.toLowerCase()) ||
      o.medicament.nomCommercial?.toLowerCase().includes(a.toLowerCase())
    );
    return {
      id: o.id,
      posologie: o.posologie,
      frequence: o.frequence,
      dureeJours: o.dureeJours,
      quantite: o.quantite,
      statut: o.statut,
      signeLe: o.signeLe,
      medecinNom: o.signataire ? `Dr. ${o.signataire.prenom} ${o.signataire.nom}` : '—',
      medicament: o.medicament,
      prixTotalGnf: o.medicament.prixUnitaireGnf * o.quantite,
      alerteAllergie
    };
  });

  return {
    patient: {
      prenom: patient.utilisateur.prenom,
      nom: patient.utilisateur.nom,
      dateNaissance: patient.dateNaissance,
      groupeSanguin: patient.groupeSanguin,
      // Allergies visibles uniquement si conflit détecté
      allergiesCritiques: allergies
    },
    ordonnances: ordonnancesAvecAlertes,
    totalOrdonnances: ordonnancesAvecAlertes.length
  };
}

// ── Délivrer une ordonnance ───────────────────────────────
export async function delivrerOrdonnance(
  ordonnanceId: string,
  pharmacienId: string,
  modePaiement: string,
  quantiteDelivree?: number
) {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: ordonnanceId },
    include: {
      medicament: true,
      consultation: { include: { patient: true } }
    }
  });

  if (!ordonnance) throw new Error('Ordonnance non trouvée');
  if (ordonnance.statut !== 'EN_ATTENTE') throw new Error('Cette ordonnance a déjà été délivrée');

  const quantite = quantiteDelivree ?? ordonnance.quantite;
  const montantGnf = ordonnance.medicament.prixUnitaireGnf * quantite;

  // Vérifier stock disponible dans la pharmacie du pharmacien
  const pharmacien = await prisma.utilisateur.findUnique({
    where: { id: pharmacienId },
    include: { pharmacienProfile: { include: { structure: true } } }
  });

  if (!pharmacien?.pharmacienProfile) throw new Error('Profil pharmacien non trouvé');

  // Stock basé sur l'ascProfile de la structure pharmacie
  const stock = await prisma.stock.findFirst({
    where: {
      idMedicament: ordonnance.idMedicament,
      asc: { idStructure: pharmacien.pharmacienProfile.idStructure }
    }
  });

  if (stock && stock.quantite < quantite) {
    throw new Error(`Stock insuffisant — ${stock.quantite} unités disponibles sur ${quantite} demandées`);
  }

  // Transaction : délivrer + créer facture + mettre à jour stock
  await prisma.$transaction(async (tx) => {
    // Statut délivré (partiel si quantite < ordonnance.quantite)
    const nouveauStatut = quantite >= ordonnance.quantite ? 'DELIVREE' : 'EN_ATTENTE';

    await tx.ordonnance.update({
      where: { id: ordonnanceId },
      data: {
        statut: nouveauStatut as any,
        quantite: ordonnance.quantite - quantite // restant à délivrer
      }
    });

    // Créer la facture
    await tx.facture.create({
      data: {
        montantGnf,
        statut: 'PAYEE',
        modePaiement: modePaiement as any,
        payeeLe: new Date(),
        idPatient: ordonnance.consultation.idPatient
      }
    });

    // Mettre à jour le stock si existant
    if (stock) {
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantite: stock.quantite - quantite }
      });
    }
  });

  return { montantGnf, quantiteDelivree: quantite, message: 'Ordonnance délivrée avec succès' };
}

// ── Stocks de la pharmacie ────────────────────────────────
export async function getStocksPharmacie(pharmacienId: string) {
  const pharmacien = await prisma.utilisateur.findUnique({
    where: { id: pharmacienId },
    include: { pharmacienProfile: true }
  });

  if (!pharmacien?.pharmacienProfile?.idStructure) {
    return [];
  }

  const stocks = await prisma.stock.findMany({
    where: {
      asc: { idStructure: pharmacien.pharmacienProfile.idStructure }
    },
    include: {
      medicament: {
        select: { dci: true, nomCommercial: true, forme: true, dosage: true, categorie: true, prixUnitaireGnf: true }
      }
    },
    orderBy: { medicament: { dci: 'asc' } }
  });

  return stocks;
}

// ── Rechercher pharmacies proches avec un médicament ─────
export async function trouverPharmaciesProches(
  idMedicament: string,
  latitude: number,
  longitude: number
) {
  // Rayon approximatif ~10km en degrés
  const delta = 0.09;

  const stocks = await prisma.stock.findMany({
    where: {
      idMedicament,
      quantite: { gt: 0 },
      asc: {
        structure: {
          type: 'PHARMACIE',
          latitude: { gte: latitude - delta, lte: latitude + delta },
          longitude: { gte: longitude - delta, lte: longitude + delta }
        }
      }
    },
    include: {
      asc: {
        include: {
          structure: {
            select: { nom: true, adresse: true, telephone: true, latitude: true, longitude: true }
          }
        }
      }
    }
  });

  return stocks.map(s => ({
    pharmacie: s.asc.structure,
    quantiteDisponible: s.quantite
  }));
}
