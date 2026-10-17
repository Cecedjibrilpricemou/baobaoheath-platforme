// P2 — Laboratoire (EF-04) : lecture des resultats, cycle prelevement /
// saisie / validation, circuit des resultats critiques. Prisma est simule.
import { motInterditDans } from '../src/services/message-sortant.service';
import {
  accuserAlerte,
  libererResultats,
  mesResultatsALiberer,
  enregistrerPrelevement,
  interpreter,
  planifierPrelevement,
  saisirResultats,
  traiterAlertesCritiques,
  validerResultats,
} from '../src/services/laboratoire.service';
import { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => {
  const prisma: Record<string, unknown> = {
    utilisateur: { findUnique: jest.fn(), findFirst: jest.fn() },
    demandeAnalyse: { findFirst: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    echantillon: { create: jest.fn() },
    resultatAnalyse: { upsert: jest.fn() },
    alerteResultatCritique: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
    demandeAnalyse: { findFirst: M; findUnique: M; findUniqueOrThrow: M; findMany: M; update: M; updateMany: M; count: M };
    echantillon: { create: M };
    resultatAnalyse: { upsert: M };
    alerteResultatCritique: { create: M; findFirst: M; findMany: M; update: M; updateMany: M };
    $queryRaw: M;
    $transaction: M;
  };
};
const { notifierSansBloquer, envoyerSmsSimule } = jest.requireMock('../src/services/notification.service') as { notifierSansBloquer: M; envoyerSmsSimule: M };
const { getIdentitePlateforme } = jest.requireMock('../src/services/parametres.service') as { getIdentitePlateforme: M };

const technicien: JwtPayload = { userId: 'tech-1', role: 'TECHNICIEN_LABO', sessionId: 's' } as JwtPayload;
// Le role BIOLOGISTE a ete supprime le 2026-09-30 : c'est le laborantin qui
// valide, et il n'y a plus qu'un seul metier au laboratoire.
const laborantin: JwtPayload = { userId: 'tech-2', role: 'TECHNICIEN_LABO', sessionId: 's' } as JwtPayload;
const medecin: JwtPayload = { userId: 'med-1', role: 'MEDECIN', sessionId: 's' } as JwtPayload;

const hemoglobine = { id: 'ex-hb', codeLoinc: '718-7', libelle: 'Hemoglobine', categorie: 'HEMATOLOGIE', specimen: 'SANG', unite: 'g/dL', aJeun: false, consignes: null, prixGnf: null, refMin: 12, refMax: 17, refTexte: null, critiqueMin: 7, critiqueMax: 20 };
const vih = { id: 'ex-vih', codeLoinc: '75622-1', libelle: 'Serologie VIH', categorie: 'SEROLOGIE', specimen: 'SANG', unite: null, aJeun: false, consignes: null, prixGnf: null, refMin: null, refMax: null, refTexte: 'Negatif', critiqueMin: null, critiqueMax: null };

const personne = (id: string, role: string) => ({ id, prenom: 'P', nom: id, role });

function demande(statut: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'da-1', numero: 'DA-2026-000001', urgence: 'ROUTINE', statut, indicationClinique: null, consignesPatient: null,
    creeLe: new Date(), transmiseLe: new Date(), annuleeLe: null, motifAnnulation: null,
    lieuPrelevement: null, creneauPrelevement: null, recueLe: null, preleveeLe: null, valideeLe: null, commentaireLaboratoire: null, diffuseePatientLe: null,
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
    await expect(saisirResultats(laborantin, 'da-1', { resultats: [{ idLigne: 'li-hb', valeur: '14' }] })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('validerResultats (EF-04-05, EF-04-07, EF-04-09)', () => {
  const resultat = (interpretation: string, id = 'res-1') => ({ id, valeur: '6', valeurNumerique: 6, unite: 'g/dL', refMin: 12, refMax: 17, refTexte: null, interpretation, commentaire: null, saisiLe: new Date(), saisiPar: personne('tech-1', 'TECHNICIEN_LABO'), echantillon: null });

  // La validation reste reservee au laboratoire : ni le medecin prescripteur
  // ni personne d'autre ne peut signer a sa place.
  it('reste fermee a qui n est pas du laboratoire', async () => {
    await expect(validerResultats(medecin, 'da-1', {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.demandeAnalyse.findFirst).not.toHaveBeenCalled();
  });

  it('bloque tant qu une ligne n a pas de resultat', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('NORMAL') },
      { id: 'li-vih', examen: vih, resultat: null },
    ] }));
    await expect(validerResultats(laborantin, 'da-1', {})).rejects.toThrow(/Serologie VIH/);
    expect(prisma.demandeAnalyse.update).not.toHaveBeenCalled();
  });

  // Addendum du 2026-09-28 : la validation du laboratoire ne rend plus rien
  // visible au patient. Avant, un resultat sans particularite partait aussitot,
  // et le patient lisait « Hemoglobine 6 g/dL » sans savoir s'il devait
  // s'inquieter.
  it('sans critique : valide, mais ne montre rien au patient', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('ANORMAL') },
      { id: 'li-vih', examen: vih, resultat: resultat('NORMAL', 'res-2') },
    ] }));
    await validerResultats(laborantin, 'da-1', { commentaire: 'Anemie moderee' });

    const data = prisma.demandeAnalyse.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ statut: 'VALIDEE', idValideur: 'tech-2', commentaireLaboratoire: 'Anemie moderee' });
    // Ni pose, ni efface : la validation ne touche plus a ce champ.
    expect(data.diffuseePatientLe).toBeUndefined();
    expect(prisma.alerteResultatCritique.create).not.toHaveBeenCalled();

    // Une seule notification, pour le medecin. Le patient n'est pas prevenu.
    expect(notifierSansBloquer).toHaveBeenCalledTimes(1);
    expect(notifierSansBloquer.mock.calls[0][0]).toMatchObject({
      idUtilisateur: 'x', type: 'RESULTATS_DISPONIBLES', lienAction: '/medecin/resultats',
    });
    expect(envoyerSmsSimule).not.toHaveBeenCalled();
  });

  it('avec critique : alerte prioritaire au prescripteur, rien au patient', async () => {
    prisma.demandeAnalyse.findFirst.mockResolvedValue(demande('EN_ANALYSE', { lignes: [
      { id: 'li-hb', examen: hemoglobine, resultat: resultat('CRITIQUE') },
      { id: 'li-vih', examen: vih, resultat: resultat('NORMAL', 'res-2') },
    ] }));
    await validerResultats(laborantin, 'da-1', {});

    expect(prisma.alerteResultatCritique.create).toHaveBeenCalledWith({ data: { idDemande: 'da-1', idResultat: 'res-1', idDestinataire: 'med-1' } });
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data.diffuseePatientLe).toBeUndefined();
    expect(notifierSansBloquer).toHaveBeenCalledTimes(1);
    expect(notifierSansBloquer.mock.calls[0][0]).toMatchObject({ idUtilisateur: 'x', type: 'RESULTAT_CRITIQUE' });
    // Ce test exigeait le mot « CRITIQUE » dans le SMS, et verrouillait ainsi
    // une fuite : EF-11-02 interdit tout contenu medical dans un message
    // sortant, meme vers un professionnel. L'intention — une alerte urgente au
    // prescripteur, rien au patient — est conservee, et l'assertion est
    // devenue plus exigeante : le SMS doit porter le numero de demande,
    // appeler a agir, et ne contenir aucun mot de soin.
    const sms = envoyerSmsSimule.mock.calls[0][1] as string;
    expect(sms).toContain('DA-2026-000001');
    expect(sms).toMatch(/attention immediate/i);
    expect(motInterditDans(sms)).toBeNull();
  });
});

// ── Liberation par le medecin (addendum du 2026-09-28) ────────────────
describe('libererResultats', () => {
  const garde = (extra: Record<string, unknown> = {}) => ({
    id: 'da-1', numero: 'DA-2026-000001', statut: 'VALIDEE', diffuseePatientLe: null,
    idPrescripteur: 'med-1', idPatient: 'pat-1', idEpisode: 'ep-1',
    episode: { idResponsable: 'med-1' },
    ...extra,
  });

  function liberationReussie() {
    prisma.demandeAnalyse.updateMany.mockResolvedValue({ count: 1 });
    prisma.alerteResultatCritique.updateMany.mockResolvedValue({ count: 0 });
    prisma.utilisateur.findFirst.mockResolvedValue({ id: 'user-pat', telephone: '625000000' });
    prisma.demandeAnalyse.findUniqueOrThrow.mockResolvedValue(demande('VALIDEE'));
  }

  it('est reservee au medecin', async () => {
    await expect(libererResultats(laborantin, 'da-1', {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.demandeAnalyse.findUnique).not.toHaveBeenCalled();
  });

  it('refuse un medecin qui ne suit pas ce patient', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde({ idPrescripteur: 'med-9', episode: { idResponsable: 'med-8' } }));
    await expect(libererResultats(medecin, 'da-1', {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(prisma.demandeAnalyse.updateMany).not.toHaveBeenCalled();
  });

  // Le prescripteur peut s'absenter : exiger le seul prescripteur bloquerait le
  // patient chez un medecin en conge.
  it('accepte le medecin responsable de l episode, meme s il n a pas prescrit', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde({ idPrescripteur: 'med-9', episode: { idResponsable: 'med-1' } }));
    liberationReussie();
    await expect(libererResultats(medecin, 'da-1', {})).resolves.toBeDefined();
  });

  it('refuse tant que le laboratoire n a pas valide', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde({ statut: 'EN_ANALYSE' }));
    await expect(libererResultats(medecin, 'da-1', {})).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuse de liberer deux fois', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde({ diffuseePatientLe: new Date() }));
    await expect(libererResultats(medecin, 'da-1', {})).rejects.toBeInstanceOf(ConflictError);
  });

  it('rend introuvable une demande inconnue', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(null);
    await expect(libererResultats(medecin, 'da-x', {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ouvre l acces au patient, avec l explication du medecin', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde());
    liberationReussie();

    await libererResultats(medecin, 'da-1', { commentaire: '  Votre fer est bas, rien d inquietant.  ' });

    const { where, data } = prisma.demandeAnalyse.updateMany.mock.calls[0][0];
    // La condition fait tout le travail : elle interdit la double liberation.
    expect(where).toEqual({ id: 'da-1', statut: 'VALIDEE', diffuseePatientLe: null });
    expect(data.diffuseePatientLe).toBeInstanceOf(Date);
    expect(data.idLiberePar).toBe('med-1');
    expect(data.commentaireMedecin).toBe('Votre fer est bas, rien d inquietant.');

    // Le patient est prevenu, sans valeur medicale dans le SMS.
    expect(notifierSansBloquer).toHaveBeenCalledWith(expect.objectContaining({ idUtilisateur: 'user-pat', type: 'RESULTATS_DISPONIBLES' }));
    expect(envoyerSmsSimule.mock.calls[0][1]).not.toMatch(/fer|bas/i);
  });

  it('sans commentaire, ne stocke pas une chaine vide', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde());
    liberationReussie();
    await libererResultats(medecin, 'da-1', { commentaire: '   ' });
    expect(prisma.demandeAnalyse.updateMany.mock.calls[0][0].data.commentaireMedecin).toBeNull();
  });

  // Liberer, c'est avoir lu : sans cela l'escalade critique se retournerait
  // contre un medecin qui a deja fait le travail.
  it('leve les alertes critiques encore ouvertes de la demande', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde());
    liberationReussie();
    await libererResultats(medecin, 'da-1', {});
    expect(prisma.alerteResultatCritique.updateMany).toHaveBeenCalledWith({
      where: { idDemande: 'da-1', accuseeLe: null },
      data: { accuseeLe: expect.any(Date) },
    });
  });

  // Deux medecins qui liberent en meme temps : un gagnant, un perdant, jamais
  // deux notifications au patient.
  it('refuse quand un autre medecin vient de liberer', async () => {
    prisma.demandeAnalyse.findUnique.mockResolvedValue(garde());
    prisma.demandeAnalyse.updateMany.mockResolvedValue({ count: 0 });
    await expect(libererResultats(medecin, 'da-1', {})).rejects.toBeInstanceOf(ConflictError);
    expect(notifierSansBloquer).not.toHaveBeenCalled();
  });
});

describe('mesResultatsALiberer', () => {
  it('ne rend que les validees que le patient ne voit pas encore', async () => {
    prisma.demandeAnalyse.findMany.mockResolvedValue([]);
    await mesResultatsALiberer(medecin);
    const { where, orderBy } = prisma.demandeAnalyse.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ statut: 'VALIDEE', diffuseePatientLe: null });
    expect(where.OR).toEqual([{ idPrescripteur: 'med-1' }, { episode: { idResponsable: 'med-1' } }]);
    // Le plus ancien d'abord : c'est le patient qui attend depuis le plus longtemps.
    expect(orderBy).toEqual({ valideeLe: 'asc' });
  });

  it('signale les resultats critiques et anormaux de chaque demande', async () => {
    prisma.demandeAnalyse.findMany.mockResolvedValue([{
      id: 'da-1', numero: 'DA-2026-000001', valideeLe: new Date('2026-09-28T08:00:00Z'), idEpisode: 'ep-1',
      patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } },
      laboratoire: { id: 'labo-A', nom: 'Labo Cece' },
      lignes: [{ resultat: { interpretation: 'CRITIQUE' } }, { resultat: { interpretation: 'NORMAL' } }],
    }]);

    const [r] = await mesResultatsALiberer(medecin);

    expect(r).toMatchObject({ idDemande: 'da-1', numero: 'DA-2026-000001', nbExamens: 2, contientCritique: true, contientAnormal: false });
    expect(r.patient).toEqual({ id: 'pat-1', prenom: 'Awa', nom: 'Diallo' });
    expect(typeof r.valideeLe).toBe('string');
  });
});

describe('accuserAlerte (EF-04-08) et escalade', () => {
  const alerte = (extra: Record<string, unknown> = {}) => ({
    id: 'al-1', creeLe: new Date(), accuseeLe: null, escaladeeLe: null, idDemande: 'da-1', idResultat: 'res-1', idDestinataire: 'med-1', idEscaladeVers: null,
    demande: { id: 'da-1', numero: 'DA-2026-000001', idEpisode: 'ep-1', patient: { id: 'pat-1', utilisateur: { prenom: 'Awa', nom: 'Diallo' } }, laboratoire: { id: 'labo-A', nom: 'L', type: 'LABORATOIRE', prefecture: 'K' } },
    resultat: { valeur: '6', unite: 'g/dL', refMin: 12, refMax: 17, ligne: { examen: { libelle: 'Hemoglobine', codeLoinc: '718-7' } } },
    destinataire: personne('med-1', 'MEDECIN'),
    ...extra,
  });

  // L'accuse dit que le soignant a vu l'alerte, pas qu'il a explique le
  // resultat. Ce sont deux gestes differents depuis l'addendum du 2026-09-28.
  it('l accuse de lecture ne montre plus rien au patient', async () => {
    prisma.alerteResultatCritique.findFirst.mockResolvedValue(alerte());
    prisma.alerteResultatCritique.update.mockResolvedValue(alerte({ accuseeLe: new Date() }));

    const vue = await accuserAlerte(medecin, 'al-1');

    expect(vue.accuseeLe).not.toBeNull();
    expect(prisma.demandeAnalyse.update).not.toHaveBeenCalled();
    expect(prisma.demandeAnalyse.updateMany).not.toHaveBeenCalled();
    expect(notifierSansBloquer).not.toHaveBeenCalled();
  });

  it('le job escalade l alerte critique vers l admin de la structure', async () => {
    prisma.alerteResultatCritique.findMany.mockResolvedValue([{ ...alerte(), destinataire: { id: 'med-1', prenom: 'Dr', nom: 'Bah', idStructure: null, medecinProfile: { idStructure: 'struct-H' } } }]);
    prisma.utilisateur.findFirst.mockResolvedValue({ id: 'admin-H', telephone: '610000000' });
    prisma.demandeAnalyse.findMany.mockResolvedValue([]);

    const r = await traiterAlertesCritiques();

    expect(r).toEqual({ escaladees: 1, relancees: 0, escaladesLiberation: 0 });
    expect(prisma.alerteResultatCritique.update.mock.calls[0][0].data).toMatchObject({ idEscaladeVers: 'admin-H' });
    expect(notifierSansBloquer.mock.calls.map((c) => c[0].type)).toEqual(['ESCALADE_CRITIQUE']);
  });

  // Le garde-fou : sans lui, un medecin absent laisserait le patient sans
  // reponse. Mais il ne doit jamais diffuser a sa place.
  it('le job relance le medecin qui n a pas libere, sans rien montrer au patient', async () => {
    prisma.alerteResultatCritique.findMany.mockResolvedValue([]);
    prisma.demandeAnalyse.findMany
      .mockResolvedValueOnce([{ id: 'da-9', numero: 'DA-2026-000009', idPrescripteur: 'med-1', idEpisode: 'ep-1', episode: { idResponsable: 'med-2' } }])
      .mockResolvedValueOnce([]);

    const r = await traiterAlertesCritiques();

    expect(r).toEqual({ escaladees: 0, relancees: 1, escaladesLiberation: 0 });
    // Le responsable de l'episode d'abord : le prescripteur a pu passer la main.
    expect(notifierSansBloquer.mock.calls[0][0]).toMatchObject({ idUtilisateur: 'med-2', lienAction: '/medecin/resultats' });
    // La relance est datee, donc elle ne repart pas a chaque tour du job.
    expect(prisma.demandeAnalyse.update.mock.calls[0][0].data).toEqual({ relanceLiberationLe: expect.any(Date) });
  });

  it('le job escalade vers l admin quand le medecin n a toujours pas libere', async () => {
    prisma.alerteResultatCritique.findMany.mockResolvedValue([]);
    prisma.demandeAnalyse.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'da-9', numero: 'DA-2026-000009', idEpisode: 'ep-1', episode: { idStructure: 'struct-H' }, prescripteur: { prenom: 'Dr', nom: 'Bah' } }]);
    prisma.utilisateur.findFirst.mockResolvedValue({ id: 'admin-H', telephone: '610000000' });

    const r = await traiterAlertesCritiques();

    expect(r).toEqual({ escaladees: 0, relancees: 0, escaladesLiberation: 1 });
    expect(notifierSansBloquer.mock.calls[0][0]).toMatchObject({ idUtilisateur: 'admin-H', titre: 'Resultats non liberes au patient' });
    // L'escalade va a l'administrateur, jamais au patient.
    expect(notifierSansBloquer.mock.calls.every((c) => c[0].idUtilisateur !== 'user-pat')).toBe(true);
  });
});
