// Regles metier du parcours de consultation cote ASC :
// creer -> constantes (alertes) -> diagnostic / ordonnance -> cloturer ou referer.
import {
  addDiagnostic,
  addOrdonnance,
  completeConsultation,
  createConsultation,
  createReferral,
  saveVitals,
} from '../src/services/consultation.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    ascProfile: { findUnique: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    consultation: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    constantesVitales: { create: jest.fn(), update: jest.fn() },
    diagnostic: { create: jest.fn() },
    ordonnance: { create: jest.fn() },
    ligneOrdonnance: { create: jest.fn() },
    medicament: { findUnique: jest.fn() },
    structureSante: { findUnique: jest.fn() },
    referencement: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

// L'ouverture du document (numerotation, code, validite) est testee dans
// ordonnance.service.test.ts : ici on verifie seulement que la prescription
// rejoint bien l'ordonnance en cours de redaction.
// L'analyse de securite a son propre fichier de tests
// (prescription-securite.service.test.ts) : ici on verifie seulement qu'elle
// est bien sollicitee et que son resultat est fige sur la ligne.
jest.mock('../src/services/prescription-securite.service', () => ({
  analyserPrescription: jest.fn(),
}));

jest.mock('../src/services/ordonnance.service', () => ({
  ...jest.requireActual('../src/services/ordonnance.service'),
  ordonnanceEnRedaction: jest.fn(),
  // EF-05-09/12 : teste dans ordonnance.service.test.ts ; ici on verifie
  // seulement que la prescription la declenche avec le nombre demande.
  appliquerReglesDocument: jest.fn(),
}));

jest.mock('../src/services/access-control.service', () => ({
  assertCanAccessPatient: jest.fn().mockResolvedValue(undefined),
  assertCanAccessConsultation: jest.fn().mockResolvedValue(undefined),
  buildConsultationWhereForUser: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/sync.service', () => ({
  recordSyncEvent: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    ascProfile: { findUnique: jest.Mock };
    patientProfile: { findUnique: jest.Mock };
    consultation: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    constantesVitales: { create: jest.Mock; update: jest.Mock };
    diagnostic: { create: jest.Mock };
    ordonnance: { create: jest.Mock };
    ligneOrdonnance: { create: jest.Mock };
    medicament: { findUnique: jest.Mock };
    structureSante: { findUnique: jest.Mock };
    referencement: { create: jest.Mock };
    $transaction: jest.Mock;
  };
};
const accessControl = jest.requireMock('../src/services/access-control.service') as {
  assertCanAccessPatient: jest.Mock; assertCanAccessConsultation: jest.Mock;
};
const { ordonnanceEnRedaction, appliquerReglesDocument } = jest.requireMock('../src/services/ordonnance.service') as {
  ordonnanceEnRedaction: jest.Mock;
  appliquerReglesDocument: jest.Mock;
};
const { analyserPrescription } = jest.requireMock('../src/services/prescription-securite.service') as {
  analyserPrescription: jest.Mock;
};
const { recordSyncEvent } = jest.requireMock('../src/services/sync.service') as { recordSyncEvent: jest.Mock };

const ASC = { userId: 'asc-u', role: 'ASC', sessionId: 's' } as JwtPayload;
const MEDECIN = { userId: 'med-u', role: 'MEDECIN', sessionId: 's' } as JwtPayload;
const ASC_PROFILE = { id: 'asc-1', idStructure: 'struct-1' };

/** Consultation appartenant a l'ASC de test, encore ouverte. */
function consultationOuverte() {
  prisma.ascProfile.findUnique.mockResolvedValue(ASC_PROFILE);
  prisma.consultation.findFirst.mockResolvedValue({ id: 'cons-1', statut: 'EN_COURS' });
}

beforeEach(() => {
  accessControl.assertCanAccessPatient.mockResolvedValue(undefined);
  accessControl.assertCanAccessConsultation.mockResolvedValue(undefined);
  recordSyncEvent.mockResolvedValue(undefined);
});
afterEach(() => jest.resetAllMocks());

describe('createConsultation', () => {
  it('exige un profil ASC', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(null);
    await expect(createConsultation(ASC, { idPatient: 'p1', motifPrincipal: 'Fievre' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('verifie l acces au patient avant de creer', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC_PROFILE);
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1' });
    accessControl.assertCanAccessPatient.mockRejectedValue(new ForbiddenError('non'));

    await expect(createConsultation(ASC, { idPatient: 'p1', motifPrincipal: 'Fievre' }))
      .rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.consultation.create).not.toHaveBeenCalled();
  });

  it('cree la consultation EN_COURS rattachee a l ASC et journalise un evenement de sync', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC_PROFILE);
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.consultation.create.mockResolvedValue({ id: 'cons-1', statut: 'EN_COURS' });

    await createConsultation(ASC, { idPatient: 'p1', motifPrincipal: 'Fievre', symptomes: ['toux'] });

    expect(prisma.consultation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { idPatient: 'p1', idAsc: 'asc-1', motifPrincipal: 'Fievre', symptomes: ['toux'], statut: 'EN_COURS' },
    }));
    expect(recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'Consultation', entityId: 'cons-1', operation: 'CREATE', idStructure: 'struct-1',
    }));
  });
});

describe('saveVitals — alertes cliniques', () => {
  beforeEach(() => {
    consultationOuverte();
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', constantes: null });
    prisma.constantesVitales.create.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 'cv-1', ...(data as object) }));
  });

  it('ne leve aucune alerte pour des constantes normales', async () => {
    await saveVitals(ASC, 'cons-1', { temperature: 37.2, spo2: 98, frequenceRespiratoire: 20, tensionSystolique: 120, glycemie: 1 });
    const { data } = prisma.constantesVitales.create.mock.calls[0][0];
    expect(data.alertes).toEqual([]);
  });

  it('cumule une alerte par seuil depasse', async () => {
    await saveVitals(ASC, 'cons-1', { temperature: 40, spo2: 90, frequenceRespiratoire: 60, tensionSystolique: 190, glycemie: 3.5 });
    const { data } = prisma.constantesVitales.create.mock.calls[0][0];
    expect(data.alertes).toHaveLength(5);
    expect(data.alertes.join(' ')).toMatch(/Fievre/);
    expect(data.alertes.join(' ')).toMatch(/SpO2/);
  });

  it('met a jour les constantes existantes au lieu d en creer', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', constantes: { id: 'cv-0' } });
    prisma.constantesVitales.update.mockResolvedValue({ id: 'cv-0' });

    await saveVitals(ASC, 'cons-1', { temperature: 38 });

    expect(prisma.constantesVitales.update).toHaveBeenCalled();
    expect(prisma.constantesVitales.create).not.toHaveBeenCalled();
    expect(recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ operation: 'UPDATE' }));
  });

  it('refuse la saisie sur une consultation qui n appartient pas a l ASC', async () => {
    prisma.consultation.findFirst.mockResolvedValue(null);
    await expect(saveVitals(ASC, 'cons-autre', { temperature: 38 })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuse la saisie sur une consultation terminee', async () => {
    prisma.consultation.findFirst.mockResolvedValue({ id: 'cons-1', statut: 'TERMINEE' });
    await expect(saveVitals(ASC, 'cons-1', { temperature: 38 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('completeConsultation', () => {
  it('passe la consultation a TERMINEE et le journalise', async () => {
    consultationOuverte();
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', statut: 'EN_COURS', constantes: null, diagnostics: [], ordonnances: [] });
    prisma.consultation.update.mockResolvedValue({ id: 'cons-1', statut: 'TERMINEE' });

    const res = await completeConsultation(ASC, 'cons-1');

    expect(res.statut).toBe('TERMINEE');
    expect(prisma.consultation.update).toHaveBeenCalledWith({ where: { id: 'cons-1' }, data: { statut: 'TERMINEE' } });
    expect(recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ payload: { statut: 'TERMINEE' } }));
  });
});

describe('addDiagnostic / addOrdonnance — qui peut ecrire', () => {
  it('un medecin passe par le controle d acces general, pas par le perimetre ASC', async () => {
    prisma.diagnostic.create.mockResolvedValue({ id: 'd1', libelle: 'Paludisme' });

    await addDiagnostic(MEDECIN, 'cons-1', { libelle: 'Paludisme', source: 'MEDECIN' });

    expect(accessControl.assertCanAccessConsultation).toHaveBeenCalledWith(MEDECIN, 'cons-1');
    expect(prisma.ascProfile.findUnique).not.toHaveBeenCalled();
  });

  it('un ASC ne peut diagnostiquer que ses consultations ouvertes', async () => {
    prisma.ascProfile.findUnique.mockResolvedValue(ASC_PROFILE);
    prisma.consultation.findFirst.mockResolvedValue(null);

    await expect(addDiagnostic(ASC, 'cons-x', { libelle: 'Paludisme', source: 'ASC' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.diagnostic.create).not.toHaveBeenCalled();
  });

  it('le diagnostic est PRINCIPAL et ACTIF par defaut', async () => {
    consultationOuverte();
    prisma.diagnostic.create.mockResolvedValue({ id: 'd1', libelle: 'Paludisme' });

    await addDiagnostic(ASC, 'cons-1', { libelle: 'Paludisme', source: 'IA_LOCALE' });

    expect(prisma.diagnostic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ typeDiagnostic: 'PRINCIPAL', statutClinique: 'ACTIF', source: 'IA_LOCALE' }),
    });
  });

  beforeEach(() => {
    analyserPrescription.mockResolvedValue({ alertes: [], motifRequis: false });
    appliquerReglesDocument.mockResolvedValue(undefined);
  });

  it('refuse une ordonnance sur un medicament inconnu', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue(null);

    await expect(addOrdonnance(ASC, 'cons-1', { idMedicament: 'm-x', posologie: '1cp', frequence: '2/j', dureeJours: 3 }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.ligneOrdonnance.create).not.toHaveBeenCalled();
    // Aucun numero ne doit etre consomme pour une prescription refusee.
    expect(ordonnanceEnRedaction).not.toHaveBeenCalled();
  });

  it('la quantite prescrite vaut 1 par defaut', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    ordonnanceEnRedaction.mockResolvedValue({ id: 'ord-1', numero: 'OR-2026-000001' });
    prisma.ligneOrdonnance.create.mockResolvedValue({ id: 'l1', quantite: 1 });

    await addOrdonnance(ASC, 'cons-1', { idMedicament: 'm-1', posologie: '1cp', frequence: '2/j', dureeJours: 3 });

    expect(prisma.ligneOrdonnance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantite: 1, idMedicament: 'm-1' }),
    }));
  });

  // EF-05-06 : ce qui a ete montre au prescripteur est fige sur la ligne. Le
  // referentiel evoluera ; ce qui compte est ce qu'il avait sous les yeux.
  it('fige les alertes et le motif de depassement sur la ligne', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    ordonnanceEnRedaction.mockResolvedValue({ id: 'ord-1', numero: 'OR-2026-000001' });
    prisma.ligneOrdonnance.create.mockResolvedValue({ id: 'l1', quantite: 1 });
    const alertes = [{ type: 'ALLERGIE', niveau: 'CONTRE_INDICATION', libelle: 'x', detail: 'y' }];
    analyserPrescription.mockResolvedValue({ alertes, motifRequis: true });

    await addOrdonnance(ASC, 'cons-1', {
      idMedicament: 'm-1', posologie: '1cp', frequence: '2/j', dureeJours: 3,
      motifDepassement: 'Benefice superieur au risque, patiente surveillee.',
    });

    expect(analyserPrescription).toHaveBeenCalledWith('cons-1', 'm-1');
    expect(prisma.ligneOrdonnance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        alertes,
        motifDepassement: 'Benefice superieur au risque, patiente surveillee.',
      }),
    }));
  });

  // Sans alerte, un motif n'a pas de sens : le conserver laisserait croire
  // qu'on a passe outre quelque chose.
  it('n enregistre aucun motif quand aucune alerte ne s est declenchee', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    ordonnanceEnRedaction.mockResolvedValue({ id: 'ord-1', numero: 'OR-2026-000001' });
    prisma.ligneOrdonnance.create.mockResolvedValue({ id: 'l1', quantite: 1 });

    await addOrdonnance(ASC, 'cons-1', {
      idMedicament: 'm-1', posologie: '1cp', frequence: '2/j', dureeJours: 3,
      motifDepassement: 'motif sans objet',
    });

    expect(prisma.ligneOrdonnance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertes: undefined, motifDepassement: null }),
    }));
  });

  // EF-05-09 : le renouvellement se decide au niveau du document, meme s'il
  // est saisi dans le formulaire d'une ligne.
  it('transmet au document le nombre de renouvellements demande', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    ordonnanceEnRedaction.mockResolvedValue({ id: 'ord-1', numero: 'OR-2026-000001' });
    prisma.ligneOrdonnance.create.mockResolvedValue({ id: 'l1', quantite: 1 });

    await addOrdonnance(ASC, 'cons-1', {
      idMedicament: 'm-1', posologie: '1cp', frequence: '2/j', dureeJours: 3,
      renouvellementsAutorises: 3,
    });

    expect(appliquerReglesDocument).toHaveBeenCalledWith('ord-1', 3);
  });

  // Deux medicaments prescrits pendant la meme consultation forment *une*
  // ordonnance : c'est ce qui rend le numero et le code utilisables au
  // comptoir. Avant P3, ils donnaient deux objets sans lien.
  it('rattache le medicament a l ordonnance en cours de redaction de la consultation', async () => {
    consultationOuverte();
    prisma.medicament.findUnique.mockResolvedValue({ id: 'm-1' });
    ordonnanceEnRedaction.mockResolvedValue({ id: 'ord-1', numero: 'OR-2026-000001' });
    prisma.ligneOrdonnance.create.mockResolvedValue({ id: 'l1', quantite: 2 });

    await addOrdonnance(ASC, 'cons-1', { idMedicament: 'm-1', posologie: '1cp', frequence: '2/j', dureeJours: 3, quantite: 2 });

    expect(ordonnanceEnRedaction).toHaveBeenCalledWith('cons-1');
    expect(prisma.ligneOrdonnance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idOrdonnance: 'ord-1' }),
    }));
  });
});

describe('createReferral', () => {
  beforeEach(() => {
    consultationOuverte();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      consultation: { update: prisma.consultation.update },
      referencement: { create: prisma.referencement.create },
    }));
  });

  it('refuse un second referencement sur la meme consultation', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', referencement: { id: 'ref-0' } });

    await expect(createReferral(ASC, 'cons-1', { idStructureCible: 'st-2', urgence: 'URGENT', resumeClinique: 'x' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une structure cible inconnue', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', referencement: null });
    prisma.structureSante.findUnique.mockResolvedValue(null);

    await expect(createReferral(ASC, 'cons-1', { idStructureCible: 'st-x', urgence: 'URGENT', resumeClinique: 'x' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it('passe la consultation a REFERENCEE et cree le referencement dans la meme transaction', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ id: 'cons-1', referencement: null });
    prisma.structureSante.findUnique.mockResolvedValue({ id: 'st-2' });
    prisma.referencement.create.mockResolvedValue({ id: 'ref-1' });

    await createReferral(ASC, 'cons-1', { idStructureCible: 'st-2', urgence: 'URGENCE_VITALE', resumeClinique: 'Detresse' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.consultation.update).toHaveBeenCalledWith({ where: { id: 'cons-1' }, data: { statut: 'REFERENCEE' } });
    expect(prisma.referencement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        idConsultation: 'cons-1', idStructureSource: 'struct-1', idStructureCible: 'st-2',
        urgence: 'URGENCE_VITALE', resumeClinique: 'Detresse',
      },
    }));
    expect(recordSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Referencement', entityId: 'ref-1' }));
  });
});
