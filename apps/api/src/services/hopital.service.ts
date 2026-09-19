// src/services/hopital.service.ts
// P1 — Hopital (EF-03) : recherche patient avant admission, episode de soins,
// orientation vers un medecin, demande d'analyse structuree (referentiel
// LOINC) transmise au laboratoire, tableau de bord de l'etablissement.
//
// Perimetre : l'agent d'accueil, le medecin et l'admin de structure agissent
// pour LEUR structure (idStructure de leur compte). Un episode donne a la
// structure l'acces au dossier du patient (access-control.service).
import { Prisma, Role, StatutEpisode, Urgence } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { prochainNumero } from './numero.service';
import { envoyerSmsSimule, notifierSansBloquer } from './notification.service';
import { getIdentitePlateforme } from './parametres.service';
import type {
  CreateDemandeAnalyseDto,
  CreateEpisodeDto,
  DemandeAnalyseView,
  EpisodePatientView,
  EpisodeSoinsResumeView,
  EpisodeSoinsView,
  ExamenView,
  OrientationDto,
  PatientRechercheView,
  StructureRefView,
  TableauDeBordHopitalView,
  UpdateEpisodeDto,
} from '@baobaoheath/shared-types';

// ── Selections partagees ─────────────────────────────────────────────
const PERSONNE_SELECT = { id: true, prenom: true, nom: true, role: true } as const;
const STRUCTURE_SELECT = { id: true, nom: true, type: true, prefecture: true } as const;
const EXAMEN_SELECT = {
  id: true, codeLoinc: true, libelle: true, categorie: true, specimen: true,
  unite: true, aJeun: true, consignes: true, prixGnf: true,
} as const;

const DEMANDE_INCLUDE = {
  episode: { select: { numero: true } },
  patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
  prescripteur: { select: PERSONNE_SELECT },
  laboratoire: { select: STRUCTURE_SELECT },
  lignes: { include: { examen: { select: EXAMEN_SELECT } }, orderBy: { examen: { libelle: 'asc' } } },
} satisfies Prisma.DemandeAnalyseInclude;

const RDV_SELECT = {
  id: true, statut: true, motif: true, prevuLe: true,
  medecin: { select: PERSONNE_SELECT },
} satisfies Prisma.RendezVousSelect;

const EPISODE_INCLUDE = {
  patient: { select: { id: true, sexe: true, dateNaissance: true, utilisateur: { select: { prenom: true, nom: true, telephone: true } } } },
  structure: { select: STRUCTURE_SELECT },
  ouvertPar: { select: PERSONNE_SELECT },
  responsable: { select: PERSONNE_SELECT },
  demandesAnalyse: { include: DEMANDE_INCLUDE, orderBy: { creeLe: 'desc' } },
  rendezVous: { select: RDV_SELECT, orderBy: { prevuLe: 'asc' } },
  _count: { select: { consultations: true, demandesAnalyse: true } },
} satisfies Prisma.EpisodeSoinsInclude;

type DemandeRow = Prisma.DemandeAnalyseGetPayload<{ include: typeof DEMANDE_INCLUDE }>;
type EpisodeRow = Prisma.EpisodeSoinsGetPayload<{ include: typeof EPISODE_INCLUDE }>;

// Types de structures pouvant recevoir une demande d'analyse : laboratoires
// et etablissements disposant d'un plateau technique.
const TYPES_LABO = ['LABORATOIRE', 'CHU', 'HOPITAL_REG', 'HOPITAL_PREF'] as const;

// ── Mappeurs ─────────────────────────────────────────────────────────
function versDemandeView(d: DemandeRow): DemandeAnalyseView {
  return {
    id: d.id,
    numero: d.numero,
    urgence: d.urgence,
    statut: d.statut,
    indicationClinique: d.indicationClinique,
    consignesPatient: d.consignesPatient,
    creeLe: d.creeLe,
    transmiseLe: d.transmiseLe,
    annuleeLe: d.annuleeLe,
    motifAnnulation: d.motifAnnulation,
    idEpisode: d.idEpisode,
    numeroEpisode: d.episode.numero,
    patient: { id: d.patient.id, prenom: d.patient.utilisateur.prenom, nom: d.patient.utilisateur.nom },
    prescripteur: d.prescripteur,
    laboratoire: d.laboratoire,
    lignes: d.lignes.map((l) => ({ id: l.id, examen: l.examen, commentaire: l.commentaire })),
  };
}

function versEpisodeView(e: EpisodeRow): EpisodeSoinsView {
  return {
    id: e.id,
    numero: e.numero,
    motif: e.motif,
    service: e.service,
    statut: e.statut,
    notes: e.notes,
    ouvertLe: e.ouvertLe,
    closLe: e.closLe,
    patient: {
      id: e.patient.id,
      prenom: e.patient.utilisateur.prenom,
      nom: e.patient.utilisateur.nom,
      sexe: e.patient.sexe,
      dateNaissance: e.patient.dateNaissance,
      telephone: e.patient.utilisateur.telephone,
    },
    structure: e.structure,
    ouvertPar: e.ouvertPar,
    responsable: e.responsable,
    demandesAnalyse: e.demandesAnalyse.map(versDemandeView),
    rendezVous: e.rendezVous,
    nbConsultations: e._count.consultations,
  };
}

function versEpisodeResume(e: EpisodeRow): EpisodeSoinsResumeView {
  const { demandesAnalyse: _d, rendezVous: _r, ...reste } = versEpisodeView(e);
  return { ...reste, nbDemandesAnalyse: e._count.demandesAnalyse };
}

// ── Contexte de l'agent ──────────────────────────────────────────────
async function structureDe(user: JwtPayload): Promise<string> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: user.userId },
    select: { idStructure: true, medecinProfile: { select: { idStructure: true } } },
  });
  const id = u?.idStructure ?? u?.medecinProfile?.idStructure;
  if (!id) throw new ForbiddenError('Aucune structure rattachee a votre compte');
  return id;
}

async function episodeDeLaStructure(user: JwtPayload, idEpisode: string) {
  const idStructure = await structureDe(user);
  const episode = await prisma.episodeSoins.findFirst({ where: { id: idEpisode, idStructure }, include: EPISODE_INCLUDE });
  if (!episode) throw new NotFoundError('Episode de soins introuvable');
  return episode;
}

// ── EF-03-01 : recherche avant toute creation de dossier ─────────────
export async function rechercherPatients(user: JwtPayload, q: string): Promise<PatientRechercheView[]> {
  const idStructure = await structureDe(user);
  const terme = q.trim();
  if (terme.length < 3) throw new ValidationError('Saisissez au moins 3 caracteres');

  const mots = terme.split(/\s+/).filter(Boolean);
  const patients = await prisma.patientProfile.findMany({
    where: {
      OR: [
        { qrCode: terme },
        { utilisateur: { telephone: { contains: terme.replace(/\s/g, '') } } },
        // Chaque mot doit apparaitre dans le nom ou le prenom (« Diallo Ma » -> Mamadou Diallo).
        { AND: mots.map((m) => ({ utilisateur: { OR: [{ nom: { contains: m, mode: 'insensitive' } }, { prenom: { contains: m, mode: 'insensitive' } }] } })) },
      ],
    },
    select: {
      id: true, sexe: true, dateNaissance: true, prefecture: true,
      utilisateur: { select: { prenom: true, nom: true, telephone: true } },
      episodes: { where: { idStructure, statut: { in: ['OUVERT', 'EN_COURS'] } }, select: { id: true, numero: true }, take: 1 },
    },
    orderBy: [{ utilisateur: { nom: 'asc' } }, { utilisateur: { prenom: 'asc' } }],
    take: 20,
  });

  return patients.map((p) => ({
    id: p.id,
    prenom: p.utilisateur.prenom,
    nom: p.utilisateur.nom,
    sexe: p.sexe,
    dateNaissance: p.dateNaissance,
    prefecture: p.prefecture,
    telephoneMasque: p.utilisateur.telephone.replace(/.(?=.{3})/g, '•'),
    episodeOuvert: p.episodes[0] ?? null,
  }));
}

// ── EF-03-02 : episode de soins ──────────────────────────────────────
export async function creerEpisode(user: JwtPayload, dto: CreateEpisodeDto): Promise<EpisodeSoinsView> {
  const idStructure = await structureDe(user);

  const patient = await prisma.patientProfile.findUnique({
    where: { id: dto.idPatient },
    select: { id: true, utilisateur: { select: { id: true, telephone: true, prenom: true } } },
  });
  if (!patient) throw new NotFoundError('Patient introuvable');

  const ouvert = await prisma.episodeSoins.findFirst({
    where: { idPatient: dto.idPatient, idStructure, statut: { in: ['OUVERT', 'EN_COURS'] } },
    select: { numero: true },
  });
  if (ouvert) throw new ConflictError(`Un episode est deja ouvert pour ce patient dans votre structure (${ouvert.numero})`);

  if (dto.idResponsable) await verifierMedecinDeLaStructure(dto.idResponsable, idStructure);

  const episode = await prisma.$transaction(async (tx) => {
    const numero = await prochainNumero('EP', tx);
    return tx.episodeSoins.create({
      data: {
        numero,
        motif: dto.motif,
        service: dto.service ?? null,
        notes: dto.notes ?? null,
        idPatient: dto.idPatient,
        idStructure,
        idOuvertPar: user.userId,
        idResponsable: dto.idResponsable ?? null,
      },
      include: EPISODE_INCLUDE,
    });
  });

  // Notification neutre : aucune information medicale dans le message (EF-11-02).
  await notifierSansBloquer({
    idUtilisateur: patient.utilisateur.id,
    type: 'EPISODE_OUVERT',
    titre: 'Prise en charge ouverte',
    contenu: `Votre prise en charge ${episode.numero} a ete ouverte a ${episode.structure.nom}. Suivez son avancement dans votre espace.`,
    lienAction: '/patient/parcours',
    metadonnees: { idEpisode: episode.id },
  });

  return versEpisodeView(episode);
}

async function verifierMedecinDeLaStructure(idMedecin: string, idStructure: string) {
  const medecin = await prisma.utilisateur.findFirst({
    where: {
      id: idMedecin, role: Role.MEDECIN, estActif: true,
      OR: [{ idStructure }, { medecinProfile: { idStructure } }],
    },
    select: { id: true },
  });
  if (!medecin) throw new ValidationError("Ce medecin n'appartient pas a votre structure");
}

export async function listerEpisodes(
  user: JwtPayload,
  filtres: { statut?: string; q?: string; page: number; limit: number },
): Promise<{ items: EpisodeSoinsResumeView[]; total: number; page: number; limit: number }> {
  const idStructure = await structureDe(user);
  const where: Prisma.EpisodeSoinsWhereInput = {
    idStructure,
    ...(filtres.statut ? { statut: filtres.statut as StatutEpisode } : {}),
    ...(filtres.q ? {
      OR: [
        { numero: { contains: filtres.q, mode: 'insensitive' } },
        { motif: { contains: filtres.q, mode: 'insensitive' } },
        { patient: { utilisateur: { OR: [{ nom: { contains: filtres.q, mode: 'insensitive' } }, { prenom: { contains: filtres.q, mode: 'insensitive' } }] } } },
      ],
    } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.episodeSoins.count({ where }),
    prisma.episodeSoins.findMany({ where, include: EPISODE_INCLUDE, orderBy: { ouvertLe: 'desc' }, skip: (filtres.page - 1) * filtres.limit, take: filtres.limit }),
  ]);
  return { items: rows.map(versEpisodeResume), total, page: filtres.page, limit: filtres.limit };
}

export async function getEpisode(user: JwtPayload, idEpisode: string): Promise<EpisodeSoinsView> {
  return versEpisodeView(await episodeDeLaStructure(user, idEpisode));
}

export async function modifierEpisode(user: JwtPayload, idEpisode: string, dto: UpdateEpisodeDto): Promise<EpisodeSoinsView> {
  const episode = await episodeDeLaStructure(user, idEpisode);
  if (episode.statut === 'CLOS' || episode.statut === 'ANNULE') throw new ConflictError('Cet episode est termine');
  if (dto.idResponsable) await verifierMedecinDeLaStructure(dto.idResponsable, episode.idStructure);

  const maj = await prisma.episodeSoins.update({
    where: { id: idEpisode },
    data: {
      ...(dto.motif !== undefined && { motif: dto.motif }),
      ...(dto.service !== undefined && { service: dto.service }),
      ...(dto.idResponsable !== undefined && { idResponsable: dto.idResponsable }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.statut !== undefined && { statut: dto.statut }),
    },
    include: EPISODE_INCLUDE,
  });
  return versEpisodeView(maj);
}

export async function cloturerEpisode(user: JwtPayload, idEpisode: string, annuler = false): Promise<EpisodeSoinsView> {
  const episode = await episodeDeLaStructure(user, idEpisode);
  if (episode.statut === 'CLOS' || episode.statut === 'ANNULE') throw new ConflictError('Cet episode est deja termine');
  const maj = await prisma.episodeSoins.update({
    where: { id: idEpisode },
    data: { statut: annuler ? 'ANNULE' : 'CLOS', closLe: new Date() },
    include: EPISODE_INCLUDE,
  });
  return versEpisodeView(maj);
}

// ── EF-03-05 : orientation vers un medecin ou un service ─────────────
export async function orienter(user: JwtPayload, idEpisode: string, dto: OrientationDto): Promise<EpisodeSoinsView> {
  const episode = await episodeDeLaStructure(user, idEpisode);
  if (episode.statut === 'CLOS' || episode.statut === 'ANNULE') throw new ConflictError('Cet episode est termine');
  if (!dto.idMedecin && !dto.service) throw new ValidationError('Indiquez un medecin ou un service');
  if (dto.idMedecin) await verifierMedecinDeLaStructure(dto.idMedecin, episode.idStructure);
  if (dto.prevuLe && !dto.idMedecin) throw new ValidationError('Un rendez-vous doit viser un medecin');

  const prevuLe = dto.prevuLe ? new Date(dto.prevuLe) : null;
  if (prevuLe && Number.isNaN(prevuLe.getTime())) throw new ValidationError('Date de rendez-vous invalide');

  await prisma.$transaction(async (tx) => {
    await tx.episodeSoins.update({
      where: { id: idEpisode },
      data: {
        statut: 'EN_COURS',
        ...(dto.service !== undefined && { service: dto.service }),
        ...(dto.idMedecin && { idResponsable: dto.idMedecin }),
      },
    });
    if (prevuLe && dto.idMedecin) {
      // Une nouvelle orientation datee remplace le rendez-vous encore planifie
      // de l'episode : on ne cumule pas les convocations.
      await tx.rendezVous.updateMany({ where: { idEpisode, statut: 'PLANIFIE' }, data: { statut: 'ANNULE' } });
      await tx.rendezVous.create({
        data: {
          idPatient: episode.idPatient,
          idMedecin: dto.idMedecin,
          idEpisode,
          prevuLe,
          motif: dto.motif ?? episode.motif,
          statut: 'PLANIFIE',
        },
      });
    }
  });

  const patientUser = await prisma.utilisateur.findFirst({ where: { patientProfile: { id: episode.idPatient } }, select: { id: true, telephone: true } });
  if (patientUser) {
    const quand = prevuLe ? ` le ${prevuLe.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : '';
    await notifierSansBloquer({
      idUtilisateur: patientUser.id,
      type: 'ORIENTATION',
      titre: 'Orientation',
      contenu: `Vous etes oriente(e) vers ${dto.service ?? 'un medecin'} a ${episode.structure.nom}${quand}. Details dans votre espace.`,
      lienAction: '/patient/parcours',
      metadonnees: { idEpisode },
    });
    if (prevuLe) {
      const { nomCourt } = await getIdentitePlateforme();
      await envoyerSmsSimule(patientUser.telephone, `${nomCourt}: rendez-vous a ${episode.structure.nom}${quand}. Details dans votre espace.`);
    }
  }

  return versEpisodeView(await episodeDeLaStructure(user, idEpisode));
}

// ── Referentiels ─────────────────────────────────────────────────────
export async function listerExamens(q?: string, categorie?: string): Promise<ExamenView[]> {
  return prisma.examen.findMany({
    where: {
      actif: true,
      ...(categorie ? { categorie } : {}),
      ...(q ? { OR: [{ libelle: { contains: q, mode: 'insensitive' } }, { codeLoinc: { contains: q } }] } : {}),
    },
    select: EXAMEN_SELECT,
    orderBy: [{ categorie: 'asc' }, { libelle: 'asc' }],
  });
}

export async function listerLaboratoires(): Promise<StructureRefView[]> {
  return prisma.structureSante.findMany({
    where: { estActive: true, type: { in: [...TYPES_LABO] } },
    select: STRUCTURE_SELECT,
    orderBy: [{ type: 'asc' }, { nom: 'asc' }],
  });
}

export async function listerMedecinsDeLaStructure(user: JwtPayload) {
  const idStructure = await structureDe(user);
  return prisma.utilisateur.findMany({
    where: { role: Role.MEDECIN, estActif: true, OR: [{ idStructure }, { medecinProfile: { idStructure } }] },
    select: { ...PERSONNE_SELECT, medecinProfile: { select: { specialite: true } } },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  }).then((rows) => rows.map((m) => ({ id: m.id, prenom: m.prenom, nom: m.nom, role: m.role, specialite: m.medecinProfile?.specialite ?? null })));
}

// ── EF-03-03 / EF-03-04 : demande d'analyse structuree ───────────────
/** Consignes generees depuis les examens choisis (a jeun, specimen...), completees par le prescripteur. */
function composerConsignes(examens: { aJeun: boolean; consignes: string | null; specimen: string }[], libre?: string): string {
  const lignes = new Set<string>();
  if (examens.some((e) => e.aJeun)) lignes.add('Se presenter a jeun : ne rien manger ni boire (sauf de l\'eau) pendant les 8 heures precedentes.');
  const specimens = new Set(examens.map((e) => e.specimen));
  if (specimens.has('URINE')) lignes.add('Apporter un echantillon d\'urine du matin dans un flacon propre, ou le prelever sur place.');
  if (specimens.has('SELLES')) lignes.add('Apporter un echantillon de selles recent dans un flacon fourni par le laboratoire.');
  for (const e of examens) if (e.consignes) lignes.add(e.consignes);
  lignes.add('Apporter une piece d\'identite et presenter votre QR Code au laboratoire.');
  if (libre?.trim()) lignes.add(libre.trim());
  return [...lignes].join('\n');
}

export async function creerDemandeAnalyse(user: JwtPayload, idEpisode: string, dto: CreateDemandeAnalyseDto): Promise<DemandeAnalyseView> {
  const episode = await episodeDeLaStructure(user, idEpisode);
  if (episode.statut === 'CLOS' || episode.statut === 'ANNULE') throw new ConflictError('Cet episode est termine');

  const labo = await prisma.structureSante.findFirst({ where: { id: dto.idLaboratoire, estActive: true, type: { in: [...TYPES_LABO] } }, select: { id: true, nom: true, adresse: true, prefecture: true, telephone: true } });
  if (!labo) throw new ValidationError('Laboratoire introuvable ou inactif');

  const ids = [...new Set(dto.examens.map((e) => e.idExamen))];
  const examens = await prisma.examen.findMany({ where: { id: { in: ids }, actif: true }, select: { id: true, aJeun: true, consignes: true, specimen: true } });
  if (examens.length !== ids.length) throw new ValidationError('Un ou plusieurs examens sont inconnus');

  const demande = await prisma.$transaction(async (tx) => {
    const numero = await prochainNumero('DA', tx);
    const creee = await tx.demandeAnalyse.create({
      data: {
        numero,
        urgence: (dto.urgence ?? 'ROUTINE') as Urgence,
        statut: 'TRANSMISE',
        transmiseLe: new Date(),
        indicationClinique: dto.indicationClinique ?? null,
        consignesPatient: composerConsignes(examens, dto.consignesPatient),
        idEpisode,
        idPatient: episode.idPatient,
        idPrescripteur: user.userId,
        idLaboratoire: labo.id,
        lignes: { create: ids.map((idExamen) => ({ idExamen, commentaire: dto.examens.find((e) => e.idExamen === idExamen)?.commentaire ?? null })) },
      },
      include: DEMANDE_INCLUDE,
    });
    if (episode.statut === 'OUVERT') await tx.episodeSoins.update({ where: { id: idEpisode }, data: { statut: 'EN_COURS' } });
    return creee;
  });

  // Le patient est informe du lieu et des conditions (EF-03-04), sans detail medical dans le SMS.
  const patientUser = await prisma.utilisateur.findFirst({ where: { patientProfile: { id: episode.idPatient } }, select: { id: true, telephone: true } });
  if (patientUser) {
    const lieu = [labo.nom, labo.adresse, labo.prefecture].filter(Boolean).join(', ');
    await notifierSansBloquer({
      idUtilisateur: patientUser.id,
      type: 'DEMANDE_ANALYSE',
      titre: 'Analyses a realiser',
      contenu: `Une demande d'analyses ${demande.numero} vous attend au laboratoire ${lieu}${labo.telephone ? ` (tel. ${labo.telephone})` : ''}. Consignes dans votre espace.`,
      lienAction: '/patient/parcours',
      metadonnees: { idDemande: demande.id, idEpisode },
    });
    const { nomCourt } = await getIdentitePlateforme();
    await envoyerSmsSimule(patientUser.telephone, `${nomCourt}: des analyses vous attendent au laboratoire ${labo.nom}. Consignes et details dans votre espace.`);
  }

  return versDemandeView(demande);
}

export async function getDemandeAnalyse(user: JwtPayload, idDemande: string): Promise<DemandeAnalyseView> {
  const idStructure = await structureDe(user);
  const d = await prisma.demandeAnalyse.findFirst({ where: { id: idDemande, episode: { idStructure } }, include: DEMANDE_INCLUDE });
  if (!d) throw new NotFoundError('Demande introuvable');
  return versDemandeView(d);
}

export async function annulerDemandeAnalyse(user: JwtPayload, idDemande: string, motif: string): Promise<DemandeAnalyseView> {
  const idStructure = await structureDe(user);
  const d = await prisma.demandeAnalyse.findFirst({ where: { id: idDemande, episode: { idStructure } }, select: { id: true, statut: true } });
  if (!d) throw new NotFoundError('Demande introuvable');
  if (!['TRANSMISE', 'RECUE'].includes(d.statut)) throw new ConflictError('Cette demande ne peut plus etre annulee (prelevement realise)');
  const maj = await prisma.demandeAnalyse.update({
    where: { id: idDemande },
    data: { statut: 'ANNULEE', annuleeLe: new Date(), motifAnnulation: motif },
    include: DEMANDE_INCLUDE,
  });
  return versDemandeView(maj);
}

// ── EF-03-06 : bon d'examen imprimable ───────────────────────────────
function echapper(v: string | null | undefined): string {
  return (v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export async function documentDemandeAnalyse(user: JwtPayload, idDemande: string): Promise<string> {
  return rendreBonExamen(await getDemandeAnalyse(user, idDemande));
}

async function rendreBonExamen(d: DemandeAnalyseView): Promise<string> {
  const identite = await getIdentitePlateforme();
  const patient = await prisma.patientProfile.findUnique({ where: { id: d.patient.id }, select: { sexe: true, dateNaissance: true, qrCode: true, utilisateur: { select: { telephone: true } } } });
  const date = (v: string | Date) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const lignes = d.lignes.map((l) => `<tr><td>${echapper(l.examen.codeLoinc)}</td><td>${echapper(l.examen.libelle)}</td><td>${echapper(l.examen.specimen)}</td><td>${echapper(l.commentaire)}</td></tr>`).join('');
  const consignes = (d.consignesPatient ?? '').split('\n').filter(Boolean).map((c) => `<li>${echapper(c)}</li>`).join('');
  const urgence = d.urgence === 'ROUTINE' ? 'Routine' : d.urgence === 'URGENT' ? 'URGENT' : 'URGENCE VITALE';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Bon d'examen ${echapper(d.numero)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#0d2b1a;margin:32px;font-size:13px}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2D7D46;padding-bottom:12px;margin-bottom:20px}
  h1{margin:0;font-size:20px;color:#2D7D46} h2{font-size:14px;margin:18px 0 6px;color:#1A5C35;text-transform:uppercase;letter-spacing:.05em}
  .meta{font-size:12px;color:#3a5848} .badge{display:inline-block;padding:3px 10px;border-radius:99px;background:#EDF7F1;color:#1A5C35;font-weight:700;font-size:11px}
  .badge--urgent{background:#FEF2F2;color:#B91C1C}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #DDE8E2;padding:7px 9px;text-align:left} th{background:#F3F7F5;font-size:11.5px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px} .grid div{padding:3px 0}
  footer{margin-top:28px;padding-top:10px;border-top:1px solid #DDE8E2;font-size:11px;color:#7a9485;display:flex;justify-content:space-between}
  .sign{margin-top:36px;display:flex;justify-content:flex-end} .sign div{width:240px;border-top:1px solid #0d2b1a;padding-top:6px;text-align:center}
  @media print{body{margin:14mm}}
</style></head><body>
<header>
  <div>${identite.logoUrl ? `<img src="${echapper(identite.logoUrl)}" alt="" style="height:40px;margin-bottom:6px"><br>` : ''}<h1>${echapper(identite.nom)}</h1><div class="meta">${echapper(d.laboratoire.nom)} — Bon d'examen</div></div>
  <div style="text-align:right"><div class="meta">N° <strong>${echapper(d.numero)}</strong></div><div class="meta">Episode ${echapper(d.numeroEpisode)}</div><div class="meta">Emis le ${date(d.creeLe)}</div><span class="badge${d.urgence !== 'ROUTINE' ? ' badge--urgent' : ''}">${urgence}</span></div>
</header>
<h2>Patient</h2>
<div class="grid">
  <div><strong>${echapper(d.patient.prenom)} ${echapper(d.patient.nom)}</strong></div>
  <div>Ne(e) le ${patient ? date(patient.dateNaissance) : '—'} · ${echapper(patient?.sexe)}</div>
  <div>Telephone : ${echapper(patient?.utilisateur.telephone)}</div>
  <div>Identifiant : ${echapper(patient?.qrCode)}</div>
</div>
<h2>Prescripteur</h2>
<div class="grid"><div>${echapper(d.prescripteur.prenom)} ${echapper(d.prescripteur.nom)}</div><div>${echapper(d.indicationClinique ? 'Indication : ' + d.indicationClinique : '')}</div></div>
<h2>Examens demandes</h2>
<table><thead><tr><th>Code LOINC</th><th>Examen</th><th>Prelevement</th><th>Commentaire</th></tr></thead><tbody>${lignes}</tbody></table>
<h2>Laboratoire</h2>
<div class="grid"><div>${echapper(d.laboratoire.nom)}</div><div>${echapper(d.laboratoire.prefecture)}</div></div>
<h2>Consignes pour le patient</h2>
<ul>${consignes}</ul>
<div class="sign"><div>Cachet et signature</div></div>
<footer><span>${echapper(identite.copyright)}</span><span>${[identite.telephone, identite.emailContact].filter(Boolean).map(echapper).join(' · ')}</span></footer>
</body></html>`;
}

// ── EF-03-07 : tableau de bord de l'etablissement ────────────────────
export async function tableauDeBord(user: JwtPayload): Promise<TableauDeBordHopitalView> {
  const idStructure = await structureDe(user);
  const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0);

  const [episodesOuverts, episodesDuJour, demandesEnAttente, demandesUrgentes, orientationsAVenir, parStatut, derniers] = await Promise.all([
    prisma.episodeSoins.count({ where: { idStructure, statut: { in: ['OUVERT', 'EN_COURS'] } } }),
    prisma.episodeSoins.count({ where: { idStructure, ouvertLe: { gte: debutJour } } }),
    prisma.demandeAnalyse.count({ where: { episode: { idStructure }, statut: { in: ['TRANSMISE', 'RECUE'] } } }),
    prisma.demandeAnalyse.count({ where: { episode: { idStructure }, urgence: { in: ['URGENT', 'URGENCE_VITALE'] }, statut: { notIn: ['VALIDEE', 'ANNULEE'] } } }),
    prisma.rendezVous.count({ where: { episode: { idStructure }, statut: 'PLANIFIE', prevuLe: { gte: new Date() } } }),
    prisma.episodeSoins.groupBy({ by: ['statut'], where: { idStructure }, _count: { _all: true } }),
    prisma.episodeSoins.findMany({ where: { idStructure }, include: EPISODE_INCLUDE, orderBy: { ouvertLe: 'desc' }, take: 8 }),
  ]);

  return {
    episodesOuverts,
    episodesDuJour,
    demandesEnAttente,
    demandesUrgentes,
    orientationsAVenir,
    parStatut: parStatut.map((p) => ({ statut: p.statut, nombre: p._count._all })),
    derniersEpisodes: derniers.map(versEpisodeResume),
  };
}

// ── Vue patient : GET /patients/me/episodes ──────────────────────────
export async function mesEpisodes(userId: string): Promise<EpisodePatientView[]> {
  const rows = await prisma.episodeSoins.findMany({
    where: { patient: { idUtilisateur: userId } },
    include: EPISODE_INCLUDE,
    orderBy: { ouvertLe: 'desc' },
  });
  return rows.map((e) => ({
    id: e.id, numero: e.numero, motif: e.motif, service: e.service, statut: e.statut,
    ouvertLe: e.ouvertLe, closLe: e.closLe, structure: e.structure, responsable: e.responsable,
    demandesAnalyse: e.demandesAnalyse.map(versDemandeView),
    // Le patient ne voit pas les rendez-vous remplaces (ANNULE) : seul le
    // rendez-vous en vigueur et l'historique tenu comptent pour lui.
    rendezVous: e.rendezVous.filter((r) => r.statut !== 'ANNULE'),
  }));
}

/** Bon d'examen consultable par le patient lui-meme. */
export async function documentDemandePourPatient(userId: string, idDemande: string): Promise<string> {
  const d = await prisma.demandeAnalyse.findFirst({ where: { id: idDemande, patient: { idUtilisateur: userId } }, include: DEMANDE_INCLUDE });
  if (!d) throw new NotFoundError('Demande introuvable');
  return rendreBonExamen(versDemandeView(d));
}
