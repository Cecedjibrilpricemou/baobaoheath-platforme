import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/app-error';

type FhirResource = Record<string, unknown>;

function iso(date?: Date | string | null): string | undefined {
  if (!date) return undefined;
  return new Date(date).toISOString();
}

function fhirPatient(patient: Awaited<ReturnType<typeof loadPatient>>) {
  return {
    resourceType: 'Patient',
    id: patient.id,
    identifier: [
      { system: 'https://baobaohealth.local/patient-qr', value: patient.qrCode },
    ],
    name: [
      {
        family: patient.utilisateur.nom,
        given: [patient.utilisateur.prenom],
      },
    ],
    telecom: [
      { system: 'phone', value: patient.utilisateur.telephone, use: 'mobile' },
      ...(patient.utilisateur.email ? [{ system: 'email', value: patient.utilisateur.email }] : []),
    ],
    gender: patient.sexe?.toLowerCase(),
    birthDate: patient.dateNaissance.toISOString().slice(0, 10),
    address: [
      {
        state: patient.prefecture,
        district: patient.sousPrefecture,
        city: patient.village,
      },
    ],
    extension: [
      ...(patient.groupeSanguin ? [{
        url: 'https://baobaohealth.local/fhir/StructureDefinition/groupe-sanguin',
        valueString: patient.groupeSanguin,
      }] : []),
      {
        url: 'https://baobaohealth.local/fhir/StructureDefinition/maladies-chroniques',
        valueString: patient.maladiesChroniques.join(', '),
      },
    ],
  };
}

function fhirEncounter(consultation: Awaited<ReturnType<typeof loadConsultation>>) {
  return {
    resourceType: 'Encounter',
    id: consultation.id,
    status: consultation.statut === 'TERMINEE' ? 'finished' : 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: `Patient/${consultation.idPatient}` },
    period: {
      start: iso(consultation.consulteeLE),
      end: iso(consultation.signeLe),
    },
    reasonCode: [{ text: consultation.motifPrincipal }],
    serviceProvider: consultation.asc?.structure ? { reference: `Organization/${consultation.asc.structure.id}` } : undefined,
    diagnosis: consultation.diagnostics.map((diagnostic) => ({
      condition: { reference: `Condition/${diagnostic.id}` },
      use: { text: diagnostic.typeDiagnostic },
    })),
  };
}

function fhirOrganization(structure: {
  id: string;
  nom: string;
  type: string;
  telephone: string | null;
  adresse: string | null;
  prefecture: string;
}) {
  return {
    resourceType: 'Organization',
    id: structure.id,
    active: true,
    name: structure.nom,
    type: [{ text: structure.type }],
    telecom: structure.telephone ? [{ system: 'phone', value: structure.telephone }] : [],
    address: [{ line: structure.adresse ? [structure.adresse] : [], state: structure.prefecture }],
  };
}

function fhirPractitioner(utilisateur: {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  role: string;
}) {
  return {
    resourceType: 'Practitioner',
    id: utilisateur.id,
    name: [{ family: utilisateur.nom, given: [utilisateur.prenom] }],
    telecom: [{ system: 'phone', value: utilisateur.telephone }],
    qualification: [{ code: { text: utilisateur.role } }],
  };
}

function fhirDiagnostic(diagnostic: Awaited<ReturnType<typeof loadConsultation>>['diagnostics'][number]) {
  return {
    resourceType: 'Condition',
    id: diagnostic.id,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
    },
    code: {
      coding: diagnostic.codeIcd11 ? [{ system: 'https://icd.who.int/browse11/l-m/en', code: diagnostic.codeIcd11 }] : [],
      text: diagnostic.libelle,
    },
    severity: diagnostic.severite ? { text: diagnostic.severite } : undefined,
    recordedDate: iso(diagnostic.creeLe),
  };
}

function fhirVitals(consultation: Awaited<ReturnType<typeof loadConsultation>>): FhirResource[] {
  if (!consultation.constantes) return [];

  const vitals = consultation.constantes;
  const specs: Array<[string, number | null | undefined, string, string]> = [
    ['temperature', vitals.temperature, '8310-5', 'Cel'],
    ['poidsKg', vitals.poidsKg, '29463-7', 'kg'],
    ['tailleCm', vitals.tailleCm, '8302-2', 'cm'],
    ['frequenceCardiaque', vitals.frequenceCardiaque, '8867-4', '/min'],
    ['frequenceRespiratoire', vitals.frequenceRespiratoire, '9279-1', '/min'],
    ['spo2', vitals.spo2, '59408-5', '%'],
    ['glycemie', vitals.glycemie, '2339-0', 'g/L'],
  ];

  return specs
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value, loinc, unit]) => ({
      resourceType: 'Observation',
      id: `${vitals.id}-${name}`,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: loinc }], text: name },
      subject: { reference: `Patient/${consultation.idPatient}` },
      encounter: { reference: `Encounter/${consultation.id}` },
      effectiveDateTime: iso(vitals.mesureLe),
      valueQuantity: { value, unit },
    }));
}

type OrdonnanceChargee = Awaited<ReturnType<typeof loadConsultation>>['ordonnances'][number];
type LigneChargee = OrdonnanceChargee['lignes'][number];

// En FHIR, une MedicationRequest porte *un* medicament : elle correspond donc a
// une ligne, pas au document. Le lien entre les lignes d'une meme ordonnance
// passe par groupIdentifier, qui recoit le numero (OR-2026-000123).
function fhirMedicationRequest(ligne: LigneChargee, ordonnance: OrdonnanceChargee) {
  return {
    resourceType: 'MedicationRequest',
    id: ligne.id,
    status: ligne.statut === 'DELIVREE' ? 'completed' : 'active',
    intent: 'order',
    groupIdentifier: { value: ordonnance.numero },
    authoredOn: iso(ordonnance.signeLe ?? ordonnance.creeLe),
    medicationCodeableConcept: {
      text: ligne.medicament.nomCommercial ?? ligne.medicament.dci,
    },
    encounter: { reference: `Encounter/${ordonnance.idConsultation}` },
    dosageInstruction: [
      {
        text: [ligne.posologie, ligne.frequence, `${ligne.dureeJours} jours`, ligne.instructions]
          .filter(Boolean)
          .join(' - '),
      },
    ],
    dispenseRequest: {
      validityPeriod: { end: iso(ordonnance.valideJusquau) },
      quantity: { value: ligne.quantite },
    },
  };
}

function fhirMedicationDispense(ligne: LigneChargee) {
  if (ligne.statut !== 'DELIVREE') return null;

  return {
    resourceType: 'MedicationDispense',
    id: `dispense-${ligne.id}`,
    status: 'completed',
    medicationCodeableConcept: {
      text: ligne.medicament.nomCommercial ?? ligne.medicament.dci,
    },
    authorizingPrescription: [{ reference: `MedicationRequest/${ligne.id}` }],
    quantity: { value: ligne.quantite },
  };
}

function fhirInvoice(facture: NonNullable<Awaited<ReturnType<typeof loadConsultation>>['facture']>) {
  return {
    resourceType: 'Invoice',
    id: facture.id,
    status: facture.statut === 'PAYEE' ? 'balanced' : 'issued',
    totalNet: { value: facture.montantGnf, currency: 'GNF' },
    date: iso(facture.creeLe),
    paymentTerms: facture.modePaiement ?? undefined,
  };
}

async function loadPatient(idPatient: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    include: { utilisateur: true },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');
  return patient;
}

async function loadConsultation(idConsultation: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: idConsultation },
    include: {
      constantes: true,
      diagnostics: true,
      ordonnances: { include: { lignes: { include: { medicament: true } } } },
      facture: true,
      asc: { include: { utilisateur: true, structure: true } },
    },
  });

  if (!consultation) throw new NotFoundError('Consultation non trouvee');
  return consultation;
}

export async function getPatientFhir(idPatient: string) {
  return fhirPatient(await loadPatient(idPatient));
}

export async function getConsultationFhir(idConsultation: string) {
  return fhirEncounter(await loadConsultation(idConsultation));
}

export async function getPatientBundleFhir(idPatient: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    include: {
      utilisateur: true,
      consultations: {
        include: {
          constantes: true,
          diagnostics: true,
          ordonnances: { include: { lignes: { include: { medicament: true } } } },
          facture: true,
          asc: { include: { utilisateur: true, structure: true } },
        },
        orderBy: { consulteeLE: 'desc' },
      },
      vaccinations: true,
    },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');

  const resources: FhirResource[] = [
    fhirPatient(patient),
    ...patient.consultations.flatMap((consultation) => [
      fhirEncounter(consultation),
      ...(consultation.asc?.structure ? [fhirOrganization(consultation.asc.structure)] : []),
      ...(consultation.asc?.utilisateur ? [fhirPractitioner(consultation.asc.utilisateur)] : []),
      ...consultation.diagnostics.map(fhirDiagnostic),
      ...fhirVitals(consultation),
      ...consultation.ordonnances.flatMap((o) => o.lignes.map((l) => fhirMedicationRequest(l, o))),
      ...(consultation.ordonnances
        .flatMap((o) => o.lignes.map(fhirMedicationDispense))
        .filter(Boolean) as FhirResource[]),
      ...(consultation.facture ? [fhirInvoice(consultation.facture)] : []),
    ]),
    ...patient.vaccinations.map((vaccination) => ({
      resourceType: 'Immunization',
      id: vaccination.id,
      status: 'completed',
      vaccineCode: { text: vaccination.vaccinNom },
      patient: { reference: `Patient/${patient.id}` },
      occurrenceDateTime: iso(vaccination.administreLe),
      lotNumber: vaccination.numeroLot,
    })),
  ];

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources.map((resource) => ({
      fullUrl: `https://baobaohealth.local/fhir/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}
