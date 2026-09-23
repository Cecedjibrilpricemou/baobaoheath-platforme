// src/services/prescription-securite.service.ts
// Securite de prescription : allergies, interactions, contre-indications
// (EF-05-05, EF-05-06).
//
// Une alerte ne bloque jamais. Le prescripteur voit le pays, la saison et le
// patient ; le referentiel ne voit qu'une paire de molecules. La regle du
// cahier des charges est donc : on informe, on trace, on ne decide pas a sa
// place.
//
// Deux consequences dans le code :
//   - les alertes sont recalculees cote serveur a la prescription, jamais
//     reprises du client : sinon il suffirait de ne pas les demander ;
//   - elles sont figees sur la ligne. Le referentiel evoluera ; ce qui compte
//     est ce qui a ete montre ce jour-la.
import { NiveauInteraction, StatutOrdonnance } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/app-error';
import type { AlertePrescriptionView, AlertesPrescriptionView } from '@baobaoheath/shared-types';

/** Rang de gravite ; au-dela de PRECAUTION, un motif est attendu. */
const RANG: Record<NiveauInteraction, number> = {
  PRECAUTION: 0,
  ASSOCIATION_DECONSEILLEE: 1,
  CONTRE_INDICATION: 2,
};

/**
 * Les allergies et les maladies chroniques sont saisies en texte libre : « Péni
 * cilline », « penicilline », « allergie à la pénicilline ». On compare donc
 * sur une forme normalisee, sans accents ni casse.
 */
export function normaliser(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Deux libelles se correspondent si l'un contient l'autre. Le seuil de 4
 * caracteres evite qu'un terme court ne rapproche n'importe quoi : « fer »
 * figurerait dans « fermeture ».
 */
export function libellesCorrespondent(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (x.length < 4 || y.length < 4) return x === y;
  return x.includes(y) || y.includes(x);
}

/**
 * Deux medicaments appartiennent a la meme famille ATC au niveau 4 (les cinq
 * premiers caracteres, p. ex. J01C pour les penicillines). C'est ce niveau que
 * les referentiels retiennent pour les allergies de classe.
 */
export function memeClasseAtc(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = a.trim().toUpperCase();
  const nb = b.trim().toUpperCase();
  if (na.length < 4 || nb.length < 4) return false;
  return na.slice(0, 4) === nb.slice(0, 4);
}

type MedicamentCandidat = {
  id: string;
  dci: string;
  nomCommercial: string | null;
  codeAtc: string | null;
  contreIndications: string[];
};

/** Les medicaments deja prescrits qu'il faut confronter au candidat. */
type DejaPrescrit = { dci: string; libelle: string };

function alerteAllergie(
  medicament: MedicamentCandidat,
  allergie: string,
  parClasse: boolean
): AlertePrescriptionView {
  return {
    type: 'ALLERGIE',
    niveau: NiveauInteraction.CONTRE_INDICATION,
    libelle: `Allergie declaree : ${allergie}`,
    detail: parClasse
      ? `${medicament.dci} appartient a la meme famille (ATC ${medicament.codeAtc}) qu'un produit auquel le patient se declare allergique.`
      : `Le patient se declare allergique a ${allergie}.`,
    conduite: 'Choisir une alternative therapeutique, ou documenter la tolerance.',
    medicamentEnCause: medicament.nomCommercial ?? medicament.dci,
    source: 'Dossier patient',
  };
}

/**
 * Toutes les raisons de ne pas prescrire ce medicament a ce patient, au moment
 * de la consultation. Ordre de restitution : du plus grave au moins grave, un
 * prescripteur presse lit la premiere ligne.
 */
export async function analyserPrescription(
  idConsultation: string,
  idMedicament: string
): Promise<AlertesPrescriptionView> {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    select: {
      idPatient: true,
      patient: { select: { allergies: true, maladiesChroniques: true } },
    },
  });
  if (!consultation) throw new NotFoundError('Consultation non trouvee');

  const medicament = await prisma.medicament.findUnique({
    where: { id: idMedicament },
    select: { id: true, dci: true, nomCommercial: true, codeAtc: true, contreIndications: true },
  });
  if (!medicament) throw new NotFoundError('Medicament non trouve');

  const alertes: AlertePrescriptionView[] = [];

  // ── 1. Allergies declarees (EF-05-05) ─────────────────────────────
  for (const allergie of consultation.patient.allergies.filter(Boolean)) {
    const direct =
      libellesCorrespondent(allergie, medicament.dci) ||
      (!!medicament.nomCommercial && libellesCorrespondent(allergie, medicament.nomCommercial));

    if (direct) {
      alertes.push(alerteAllergie(medicament, allergie, false));
      continue;
    }

    // Allergie de classe : le patient se declare allergique a une molecule
    // que l'on connait, et le candidat partage sa famille ATC. Sans cela, un
    // patient allergique a l'amoxicilline recevrait de l'ampicilline sans un
    // mot.
    if (!medicament.codeAtc) continue;
    const connu = await prisma.medicament.findFirst({
      where: {
        codeAtc: { not: null },
        OR: [
          { dci: { contains: allergie.trim(), mode: 'insensitive' } },
          { nomCommercial: { contains: allergie.trim(), mode: 'insensitive' } },
        ],
      },
      select: { codeAtc: true },
    });
    if (connu && memeClasseAtc(connu.codeAtc, medicament.codeAtc)) {
      alertes.push(alerteAllergie(medicament, allergie, true));
    }
  }

  // ── 2. Contre-indications vs maladies chroniques (EF-05-06) ───────
  for (const contreIndication of medicament.contreIndications.filter(Boolean)) {
    const maladie = consultation.patient.maladiesChroniques.find((m) =>
      libellesCorrespondent(m, contreIndication)
    );
    if (!maladie) continue;
    alertes.push({
      type: 'CONTRE_INDICATION',
      niveau: NiveauInteraction.CONTRE_INDICATION,
      libelle: `Contre-indication : ${contreIndication}`,
      detail: `Le dossier du patient mentionne « ${maladie} », qui figure parmi les contre-indications de ${medicament.dci}.`,
      conduite: 'Verifier le rapport benefice/risque avant de prescrire.',
      medicamentEnCause: medicament.nomCommercial ?? medicament.dci,
      source: 'Fiche medicament',
    });
  }

  // ── 3. Interactions avec les traitements en cours (EF-05-05) ──────
  const dejaPrescrits = await traitementsEnCours(consultation.idPatient, idMedicament);
  for (const autre of dejaPrescrits) {
    const interaction = await trouverInteraction(medicament.dci, autre.dci);
    if (!interaction) continue;
    alertes.push({
      type: 'INTERACTION',
      niveau: interaction.niveau,
      libelle: `Interaction avec ${autre.libelle}`,
      detail: interaction.description,
      conduite: interaction.conduite,
      medicamentEnCause: autre.libelle,
      source: interaction.source,
    });
  }

  alertes.sort((a, b) => RANG[b.niveau] - RANG[a.niveau]);

  return {
    alertes,
    // Une simple precaution n'appelle pas de justification : exiger un motif
    // pour tout finirait en « RAS » systematique, et l'information se perdrait.
    motifRequis: alertes.some((a) => RANG[a.niveau] > RANG.PRECAUTION),
  };
}

/**
 * Les molecules que le patient prend encore : celles de ses ordonnances non
 * servies et non expirees. Une ordonnance deja servie ne dit rien de ce qui
 * est en cours — la duree du traitement, elle, n'est pas suivie a ce stade.
 */
async function traitementsEnCours(idPatient: string, idMedicamentExclu: string): Promise<DejaPrescrit[]> {
  const lignes = await prisma.ligneOrdonnance.findMany({
    where: {
      statut: StatutOrdonnance.EN_ATTENTE,
      idMedicament: { not: idMedicamentExclu },
      ordonnance: {
        statut: {
          in: [
            StatutOrdonnance.EN_ATTENTE,
            StatutOrdonnance.PARTIELLEMENT_SERVIE,
            StatutOrdonnance.DELIVREE,
          ],
        },
        valideJusquau: { gte: new Date() },
        consultation: { idPatient },
      },
    },
    select: { medicament: { select: { dci: true, nomCommercial: true } } },
    take: 50,
  });

  // Deux ordonnances peuvent porter la meme molecule : une alerte suffit.
  const vues = new Map<string, DejaPrescrit>();
  for (const l of lignes) {
    const cle = normaliser(l.medicament.dci);
    if (!vues.has(cle)) {
      vues.set(cle, { dci: l.medicament.dci, libelle: l.medicament.nomCommercial ?? l.medicament.dci });
    }
  }
  return [...vues.values()];
}

/** Le couple est stocke ordonne : on interroge dans les deux sens par securite. */
async function trouverInteraction(dciX: string, dciY: string) {
  const [a, b] = [normaliser(dciX), normaliser(dciY)].sort();
  return prisma.interactionMedicament.findFirst({
    where: { OR: [{ dciA: a, dciB: b }, { dciA: b, dciB: a }] },
    select: { niveau: true, description: true, conduite: true, source: true },
  });
}
