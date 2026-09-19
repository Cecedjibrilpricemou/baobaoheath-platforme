// prisma/seed-examens.ts
// Referentiel de depart des examens de laboratoire, codes LOINC (EF-03-03,
// EF-13-04). Idempotent (upsert sur le code) : partage par le seed principal
// et le seed e2e. La liste s'enrichit ensuite depuis l'administration.
import type { PrismaClient } from '../src/config/generated/client/client';

type ExamenSeed = {
  codeLoinc: string; libelle: string; categorie: string; specimen: string;
  unite?: string; aJeun?: boolean; consignes?: string; prixGnf?: number;
  // Valeurs de reference et seuils critiques (EF-04-04, EF-04-07).
  refMin?: number; refMax?: number; refTexte?: string; critiqueMin?: number; critiqueMax?: number;
};

export const EXAMENS_DE_BASE: ExamenSeed[] = [
  // Hematologie
  { codeLoinc: '58410-2', libelle: 'Numeration formule sanguine (NFS)', categorie: 'HEMATOLOGIE', specimen: 'SANG', prixGnf: 60000 },
  { codeLoinc: '718-7',   libelle: 'Hemoglobine', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: 'g/dL', prixGnf: 25000, refMin: 12, refMax: 17, critiqueMin: 7, critiqueMax: 20 },
  { codeLoinc: '777-3',   libelle: 'Plaquettes', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: '10^3/µL', prixGnf: 25000, refMin: 150, refMax: 400, critiqueMin: 50, critiqueMax: 1000 },
  { codeLoinc: '30341-2', libelle: 'Vitesse de sedimentation (VS)', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: 'mm/h', prixGnf: 20000, refMin: 0, refMax: 20 },
  { codeLoinc: '882-1',   libelle: 'Groupe sanguin ABO et Rhesus', categorie: 'HEMATOLOGIE', specimen: 'SANG', prixGnf: 30000 },
  // Biochimie
  { codeLoinc: '1558-6',  libelle: 'Glycemie a jeun', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', aJeun: true, prixGnf: 20000, refMin: 3.9, refMax: 6.1, critiqueMin: 2.5, critiqueMax: 25 },
  { codeLoinc: '4548-4',  libelle: 'Hemoglobine glyquee (HbA1c)', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: '%', prixGnf: 90000, refMin: 4, refMax: 6 },
  { codeLoinc: '2160-0',  libelle: 'Creatinine', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'µmol/L', prixGnf: 25000, refMin: 60, refMax: 110, critiqueMax: 700 },
  { codeLoinc: '3094-0',  libelle: 'Uree', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', prixGnf: 25000, refMin: 2.5, refMax: 7.5, critiqueMax: 35 },
  { codeLoinc: '1742-6',  libelle: 'Transaminases ALAT (SGPT)', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'UI/L', prixGnf: 30000, refMin: 0, refMax: 40, critiqueMax: 1000 },
  { codeLoinc: '1920-8',  libelle: 'Transaminases ASAT (SGOT)', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'UI/L', prixGnf: 30000, refMin: 0, refMax: 40, critiqueMax: 1000 },
  { codeLoinc: '2093-3',  libelle: 'Cholesterol total', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', aJeun: true, prixGnf: 30000, refMin: 0, refMax: 5.2 },
  { codeLoinc: '2571-8',  libelle: 'Triglycerides', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', aJeun: true, prixGnf: 30000, refMin: 0, refMax: 1.7 },
  { codeLoinc: '1751-7',  libelle: 'Albumine', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'g/L', prixGnf: 30000, refMin: 35, refMax: 50 },
  { codeLoinc: '1988-5',  libelle: 'Proteine C reactive (CRP)', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mg/L', prixGnf: 40000, refMin: 0, refMax: 5, critiqueMax: 300 },
  { codeLoinc: '2951-2',  libelle: 'Sodium', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', prixGnf: 20000, refMin: 135, refMax: 145, critiqueMin: 120, critiqueMax: 160 },
  { codeLoinc: '2823-3',  libelle: 'Potassium', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mmol/L', prixGnf: 20000, refMin: 3.5, refMax: 5.1, critiqueMin: 2.5, critiqueMax: 6.5 },
  { codeLoinc: '3024-7',  libelle: 'Thyroxine libre (T4L)', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'pmol/L', prixGnf: 80000, refMin: 12, refMax: 22 },
  { codeLoinc: '3016-3',  libelle: 'TSH', categorie: 'BIOCHIMIE', specimen: 'SANG', unite: 'mUI/L', prixGnf: 80000, refMin: 0.4, refMax: 4 },
  // Serologie / infectieux
  { codeLoinc: '75622-1', libelle: 'Serologie VIH 1 et 2', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 40000, consignes: 'Resultat remis en main propre par un professionnel.', refTexte: 'Negatif' },
  { codeLoinc: '5195-3',  libelle: 'Antigene HBs (hepatite B)', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 40000, refTexte: 'Negatif' },
  { codeLoinc: '16128-1', libelle: 'Anticorps anti-VHC (hepatite C)', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 45000, refTexte: 'Negatif' },
  { codeLoinc: '20507-0', libelle: 'Serologie syphilis (RPR)', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 30000, refTexte: 'Negatif' },
  { codeLoinc: '22587-0', libelle: 'Test de grossesse (beta-hCG)', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 30000 },
  { codeLoinc: '32207-3', libelle: 'Paludisme — test de diagnostic rapide (TDR)', categorie: 'PARASITOLOGIE', specimen: 'SANG', prixGnf: 15000, refTexte: 'Negatif' },
  { codeLoinc: '10704-5', libelle: 'Paludisme — goutte epaisse et frottis', categorie: 'PARASITOLOGIE', specimen: 'SANG', prixGnf: 20000, refTexte: 'Negatif' },
  { codeLoinc: '6463-4',  libelle: 'Serologie Widal (typhoide)', categorie: 'SEROLOGIE', specimen: 'SANG', prixGnf: 30000, refTexte: 'Negatif' },
  // Urines et selles
  { codeLoinc: '24356-8', libelle: 'Bandelette urinaire', categorie: 'URINE', specimen: 'URINE', prixGnf: 15000 },
  { codeLoinc: '630-4',   libelle: 'ECBU (examen cytobacteriologique des urines)', categorie: 'MICROBIOLOGIE', specimen: 'URINE', prixGnf: 50000, consignes: 'Urines du matin, apres toilette intime, milieu du jet.', refTexte: 'Sterile' },
  { codeLoinc: '10701-1', libelle: 'Examen parasitologique des selles', categorie: 'PARASITOLOGIE', specimen: 'SELLES', prixGnf: 25000, refTexte: 'Negatif' },
  { codeLoinc: '625-4',   libelle: 'Coproculture', categorie: 'MICROBIOLOGIE', specimen: 'SELLES', prixGnf: 50000, refTexte: 'Negatif' },
  // Microbiologie
  { codeLoinc: '6448-5',  libelle: 'Hemoculture', categorie: 'MICROBIOLOGIE', specimen: 'SANG', prixGnf: 80000, refTexte: 'Sterile' },
  { codeLoinc: '11545-1', libelle: 'Recherche de BAAR dans les crachats (tuberculose)', categorie: 'MICROBIOLOGIE', specimen: 'CRACHATS', prixGnf: 30000, consignes: 'Crachats du matin, avant le brossage des dents.', refTexte: 'Negatif' },
];

export async function seedExamens(prisma: PrismaClient): Promise<number> {
  for (const e of EXAMENS_DE_BASE) {
    await prisma.examen.upsert({
      where: { codeLoinc: e.codeLoinc },
      update: { libelle: e.libelle, categorie: e.categorie, specimen: e.specimen, unite: e.unite ?? null, aJeun: e.aJeun ?? false, consignes: e.consignes ?? null, prixGnf: e.prixGnf ?? null, refMin: e.refMin ?? null, refMax: e.refMax ?? null, refTexte: e.refTexte ?? null, critiqueMin: e.critiqueMin ?? null, critiqueMax: e.critiqueMax ?? null },
      create: { codeLoinc: e.codeLoinc, libelle: e.libelle, categorie: e.categorie, specimen: e.specimen, unite: e.unite ?? null, aJeun: e.aJeun ?? false, consignes: e.consignes ?? null, prixGnf: e.prixGnf ?? null, refMin: e.refMin ?? null, refMax: e.refMax ?? null, refTexte: e.refTexte ?? null, critiqueMin: e.critiqueMin ?? null, critiqueMax: e.critiqueMax ?? null },
    });
  }
  return EXAMENS_DE_BASE.length;
}
