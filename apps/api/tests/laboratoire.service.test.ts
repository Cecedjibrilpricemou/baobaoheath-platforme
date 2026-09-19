// P2 — Laboratoire (EF-04) : lecture des resultats, cycle prelevement /
// saisie / validation, circuit des resultats critiques. Prisma est simule.
import {
  accuserAlerte,
  enregistrerPrelevement,
  interpreter,
  planifierPrelevement,
  saisirResultats,
  traiterAlertesCritiques,
  validerResultats,
} from '../src/services/laboratoire.service';
import { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), findFirst: jest.fn() },
    demandeAnalyse: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    echantillon: { create: jest.fn() },
    resultatAnalyse: { upsert: jest.fn() },
    alerteResultatCritique: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
  };
  prisma['$transaction'] = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return { prisma };
});
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn().mockResolvedValue(undefined),
  envoyerSmsSimule: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/parametres.service', () => ({
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nom: 'KÈNÈYA', nomCourt: 'KENEYA', copyright: '©', logoUrl: '', telephone: '', emailContact: '' }),
}));
jest.mock('../src/services/access-control.service', () => ({ buildPatientWhereForUser: jest.fn().mockResolvedValue({}) }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur: { findUnique: M; findFirst: M };
    demandeAnalyse: { findFirst: M; findUnique: M; findMany: M; update: M; count: M };
    echantillon: { create: M };
    resultatAnalyse: { upsert: M };
    alerteResultatCritique: { create: M; findFirst: M; findMany: M; update: M };
    $queryRaw: M;
    $transaction: M;
  };
};
const { notifierSansBloquer, envoyerSmsSimule } = jest.requireMock('../src/services/notification.service') as { notifierSansBloquer: M; envoyerSmsSimule: M };
const { getIdentitePlateforme } = jest.requireMock('../src/services/parametres.service') as { getIdentitePlateforme: M };

const technicien: JwtPayload = { userId: 'tech-1', role: 'TECHNICIEN_LABO', sessionId: 's' } as JwtPayload;
const biologiste: JwtPayload = { userId: 'bio-1', role: 'BIOLOGISTE', sessionId: 's' } as JwtPayload;
const medecin: JwtPayload = { userId: 'med-1', role: 'MEDECIN', sessionId: 's' } as JwtPayload;

const hemoglobine = { id: 'ex-hb', codeLoinc: '718-7', libelle: 'Hemoglobine', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: 'g/dL', aJeun: false, consignes: null, prixGnf: null, refMin: 12, refMax: 17, refTexte: null, critiqueMin: 7, critiqueMax: 20 };
const vih = { id: 'ex-vih', codeLoinc: '75622-1', libelle: 'Serologie VIH', categorie: 'SEROLOGIE', specimen: 'SANG', unite: null, aJeun: false, consignes: null, prixGnf: null, refMin: null, refMax: null, refTexte: 'Negatif', critiqueMin: null, critiqueMax: null };

const personne = (id: string, role: string) => ({ id, prenom: 'P', nom: id, role });

function demande(statut: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'da-1', numero: 'DA-2026-000001', urgence: 'ROUTINE', statut, indicationClinique: null, consignesPatient: null,
    creeLe: new Date(), transmiseLe: new Date(), annuleeLe: null, motifAnnulation: null,
    lieuPrelevement: null, creneauPrelevement: null, recueLe: null, preleveeLe: null, valideeLe: null, commentaireBiologiste: null, diffuseePatientLe: null,
    idEpisode: 'ep-1', idPatient: 'pat-1', idPrescripteur: 'med-1', idLaboratoire: 'labo-A', idValideur: null,
    episode: { numero: 'EP-2026-000001' },
    patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } },
    prescripteur: personne('med-1', 'MEDECIN'), laboratoire: { id: 'labo-A', nom: 'Labo Kindia', type: 'LABORATOIRE', prefecture: 'Kindia' },
    valideur: null, echantillons: [],
    lignes: [
      { id: 'li-hb', commentaire: null, idDemande: 'da-1', idExamen: 'ex-hb', examen: hemoglobine, resultat: null },
      { id: 'li-vih', commentaire: null, idDemande: 'da-1', idExamen: 'ex-vih', examen: vih, resultat: null },
    ],
    _count: { alertesCritiques: 0 },
    ...extra,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  prisma.utilisateur.findUnique.mockResolvedValue({ id: 'x', idStructure: 'labo-A', telephone: '620000001' });
  prisma.utilisateur.findFirst.mockResolvedValue({ id: 'user-pat', telephone: '625000000' });
  prisma.$queryRaw.mockResolvedValue([{ valeur: 3 }]);
  prisma.demandeAnalyse.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => demande((data['statut'] as string) ?? 'RECUE', data));
  notifierSansBloquer.mockResolvedValue(undefined);
  envoyerSmsSimule.mockResolvedValue(undefined);
  getIdentitePlateforme.mockResolvedValue({ nom: 'KÈNÈYA', nomCourt: 'KENEYA' });
});

describe('interpreter — lecture d apres references et seuils critiques (EF-04-04, EF-04-07)', () => {
  it('classe une valeur numerique : normale, anormale, critique', () => {
    expect(interpreter('14', hemoglobine)).toEqual({ valeurNumerique: 14, interpretation: 'NORMAL' });
    expect(interpreter('10,5', hemoglobine)).toEqual({ valeurNumerique: 10.5, interpretation: 'ANORMAL' });
    expect(interpreter('6.2', hemoglobine)).toEqual({ valeurNumerique: 6.2, interpretation: 'CRITIQUE' });
    expect(interpreter('21', hemoglobine)).toEqual({ valeurNumerique: 21, interpretation: 'CRITIQUE' });
  });

  it('compare un resultat qualitatif au texte de reference, accents et casse ignores', () => {
    expect(interpreter('négatif', vih).interpretation).toBe('NORMAL');
    expect(interpreter('Positif', vih).interpretation).toBe('ANORMAL');
    expect(interpreter('Positif', vih).valeurNumerique).toBeNull();
  });
});

describe('planifierPrelevement (EF-04-02)', () => {
  it('enregistre lieu et creneau, passe en RECUE et previent le patient', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('TRANSMISE'));
    const creneau = new Date(Date.now() + 86_400_000).toISOString();
    await planifierPrelevement(technicien, 'da-1', { lieu: 'DOMICILE', creneau });
    const data = prisma.demandeAnalyse.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ lieuPrelevement: 'DOMICILE', statut: 'RECUE' });
    expect(data.creneauPrelevement).toBeInstanceOf(Date);
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({ idUtilisateur: 'user-pat', type: 'PRELEVEMENT_PLANIFIE' }));
    expect(envoyerSmsSimule.mock.calls[0][1]).toContain('domicile');
  });

  it('refuse un creneau passe', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('RECUE'));
    await expect(planifierPrelevement(technicien, 'da-1', { lieu: 'SUR_PLACE', creneau: '2020-01-01T08:00:00Z' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuse sur une demande deja prelevee', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('PRELEVEE'));
    await expect(planifierPrelevement(technicien, 'da-1', { lieu: 'SUR_PLACE' })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('enregistrerPrelevement (EF-04-03)', () => {
  it('cree un echantillon code par type de specimen quand rien n est precise', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('RECUE', { lignes: [
      { id: 'a', examen: { ...hemoglobine, specimen: 'SANG' }, resultat: null },
      { id: 'b', examen: { ...vih, specimen: 'SANG' }, resultat: null },
      { id: 'c', examen: { ...vih, id: 'ex-u', specimen: 'URINE' }, resultat: null },
    ] }));
    await enregistrerPrelevement(technicien, 'da-1', {});
    expect(prisma.echantillon.create).toHaveBeenCalledTimes(2);
    const specimens = prisma.echantillon.create.mock.calls.map((c) => c[0].data.specimen);
    expect(specimens).toEqual(['SANG', 'URINE']);
    expect(prisma.echantillon.create.mock.calls[0][0].data.code).toBe('EC-2026-000003');
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data).toMatchObject({ statut: 'PRELEVEE' });
  });

  it('interdit le prelevement d une demande annulee', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('ANNULEE'));
    await expect(enregistrerPrelevement(technicien, 'da-1', {})).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuse un utilisateur sans laboratoire', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({ idStructure: null });
    await expect(enregistrerPrelevement(technicien, 'da-1', {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('saisirResultats (EF-04-04, EF-04-06)', () => {
  it('cible par ligne ou par code LOINC, fige les references et calcule la lecture', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('PRELEVEE'));
    await saisirResultats(technicien, 'da-1', { resultats: [{ idLigne: 'li-hb', valeur: '6,5' }, { codeLoinc: '75622-1', valeur: 'Negatif' }] });
    expect(prisma.resultatAnalyse.upsert).toHaveBeenCalledTimes(2);
    const hb = prisma.resultatAnalyse.upsert.mock.calls[0][0];
    expect(hb.where).toEqual({ idLigne: 'li-hb' });
    expect(hb.create).toMatchObject({ valeur: '6,5', valeurNumerique: 6.5, unite: 'g/dL', refMin: 12, refMax: 17, interpretation: 'CRITIQUE', idSaisiPar: 'tech-1' });
    expect(prisma.resultatAnalyse.upsert.mock.calls[1][0].create).toMatchObject({ idLigne: 'li-vih', interpretation: 'NORMAL' });
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data).toEqual({ statut: 'EN_ANALYSE' });
  });

  it('rejette un examen absent de la demande', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('PRELEVEE'));
    await expect(saisirResultats(technicien, 'da-1', { resultats: [{ codeLoinc: '0000-0', valeur: '1' }] })).rejects.toBeInstanceOf(ValidationError);
    expect(prisma.resultatAnalyse.upsert).not.toHaveBeenCalled();
  });

  it('ne modifie plus une demande validee', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('VALIDEE'));
    await expect(saisirResultats(biologiste, 'da-1', { resultats: [{ idLigne: 'li-hb', valeur: '14' }] })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('validerResultats (EF-04-05, EF-04-07, EF-04-09)', () => {
  const resultat = (interpretation: string, id = 'res-1') => ({ id, valeur: '6', valeurNumerique: 6, unite: 'g/dL', refMin: 12, refMax: 17, refTexte: null, interpretation, commentaire: null, saisiLe: new Date(), saisiPar: personne('tech-1', 'TECHNICIEN_LABO'), echantillon: null });

  it('est reservee au biologiste', async () => {
    await expect(validerResultats(technicien, 'da-1', {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.demandeAnalyse.findFirst).not.toHaveBeenCalled();
  });

  it('bloque tant qu une ligne n a pas de resultat', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('NORMAL') },
      { id: 'li-vih', examen: vih, resultat: null },
    ] }));
    await expect(validerResultats(biologiste, 'da-1', {})).rejects.toThrow(/Serologie VIH/);
    expect(prisma.demandeAnalyse.update).not.toHaveBeenCalled();
  });

  it('sans critique : valide, diffuse aussitot au patient et informe le prescripteur', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('ANORMAL') },
      { id: 'li-vih', examen: vih, resultat: resultat('NORMAL', 'res-2') },
    ] }));
    await validerResultats(biologiste, 'da-1', { commentaire: 'Anemie moderee' });
    const data = prisma.demandeAnalyse.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ statut: 'VALIDEE', idValideur: 'bio-1', commentaireBiologiste: 'Anemie moderee' });
    expect(data.diffuseePatientLe).toBeInstanceOf(Date);
    expect(prisma.alerteResultatCritique.create).not.toHaveBeenCalled();
    const types = notifierSansBloquer.mock.calls.map((c) => c[0].type);
    expect(types).toEqual(['RESULTATS_DISPONIBLES', 'RESULTATS_DISPONIBLES']);
    // Le SMS patient ne contient aucune valeur medicale.
    expect(envoyerSmsSimule.mock.calls[0][1]).not.toMatch(/6|Anemie/);
  });

  it('avec critique : alerte prioritaire au prescripteur, diffusion patient differee', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('CRITIQUE') },
      { id: 'li-vih', examen: vih, resultat: resultat('NORMAL', 'res-2') },
    ] }));
    await validerResultats(biologiste, 'da-1', {});
    expect(prisma.alerteResultatCritique.create).toHaveBeenCalledWith({ data: { idDemande: 'da-1', idResultat: 'res-1', idDestinataire: 'med-1' } });
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data.diffuseePatientLe).toBeNull();
    expect(notifierSansBloquer).toHaveBeenCalledTimes(1);
    expect(notifierSansBloquer.mock.calls[0][0]).toMatchObject({ idUtilisateur: 'x', type: 'RESULTAT_CRITIQUE' });
    expect(envoyerSmsSimule.mock.calls[0][1]).toContain('CRITIQUE');
  });
});

describe('accuserAlerte (EF-04-08) et escalade (EF-04-09)', () => {
  const alerte = (extra: Record<string, unknown> = {}) => ({
    id: 'al-1', creeLe: new Date(), accuseeLe: null, escaladeeLe: null, idDemande: 'da-1', idResultat: 'res-1', idDestinataire: 'med-1', idEscaladeVers: null,
    demande: { id: 'da-1', numero: 'DA-2026-000001', idEpisode: 'ep-1', patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } }, laboratoire: { id: 'labo-A', nom: 'L', type: 'LABORATOIRE', prefecture: 'K' } },
    resultat: { valeur: '6', unite: 'g/dL', refMin: 12, refMax: 17, ligne: { examen: { libelle: 'Hemoglobine', codeLoinc: '718-7' } } },
    destinataire: personne('med-1', 'MEDECIN'),
    ...extra,
  });

  it('l accuse de lecture libere la diffusion au patient quand plus rien n est en attente', async () => {
    prisma.alerteResultatCritique.findFirst.mockResolvedValue(alerte());
    prisma.alerteResultatCritique.update.mockResolvedValue(alerte({ accuseeLe: new Date() }));
    prisma.demandeAnalyse.findUnique.mockResolvedValue({ id: 'da-1', numero: 'DA-2026-000001', idPatient: 'pat-1', idEpisode: 'ep-1', statut: 'VALIDEE', diffuseePatientLe: null, _count: { alertesCritiques: 0 } });
    const vue = await accuserAlerte(medecin, 'al-1');
    expect(vue.accuseeLe).not.toBeNull();
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data.diffuseePatientLe).toBeInstanceOf(Date);
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({ idUtilisateur: 'user-pat', type: 'RESULTATS_DISPONIBLES' }));
  });

  it('ne diffuse pas tant qu une autre alerte de la demande reste ouverte', async () => {
    prisma.alerteResultatCritique.findFirst.mockResolvedValue(alerte());
    prisma.alerteResultatCritique.update.mockResolvedValue(alerte({ accuseeLe: new Date() }));
    prisma.demandeAnalyse.findUnique.mockResolvedValue({ id: 'da-1', statut: 'VALIDEE', diffuseePatientLe: null, _count: { alertesCritiques: 1 } });
    await accuserAlerte(medecin, 'al-1');
    expect(prisma.demandeAnalyse.update).not.toHaveBeenCalled();
    expect(notifierSansBloquer).not.toHaveBeenCalled();
  });

  it('le job escalade vers l admin de la structure et diffuse au patient passe le delai', async () => {
    prisma.alerteResultatCritique.findMany.mockResolvedValue([{ ...alerte(), destinataire: { id: 'med-1', prenom: 'Dr', nom: 'Bah', idStructure: null, medecinProfile: { idStructure: 'struct-H' } } }]);
    prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'admin-H', telephone: '610000000' }).mockResolvedValue({ id: 'user-pat', telephone: '625000000' });
    prisma.demandeAnalyse.findMany.mockResolvedValue([{ id: 'da-9', numero: 'DA-2026-000009', idPatient: 'pat-1', idEpisode: 'ep-1' }]);
    const r = await traiterAlertesCritiques();
    expect(r).toEqual({ escaladees: 1, diffusees: 1 });
    expect(prisma.alerteResultatCritique.update.mock.calls[0][0].data).toMatchObject({ idEscaladeVers: 'admin-H' });
    expect(prisma.utilisateur.findFirst.mock.calls[0][0].where).toMatchObject({ idStructure: 'struct-H', role: 'ADMIN_STRUCTURE' });
    const types = notifierSansBloquer.mock.calls.map((c) => c[0].type);
    expect(types).toEqual(['ESCALADE_CRITIQUE', 'RESULTATS_DISPONIBLES']);
    expect(prisma.demandeAnalyse.update).toHaveBeenCalledWith({ where: { id: 'da-9' }, data: { diffuseePatientLe: expect.any(Date) } });
  });
});
