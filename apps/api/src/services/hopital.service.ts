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
import { messagePatientInformation } from './message-sortant.service';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { prochainNumero } from './numero.service';
import { randomBytes } from 'node:crypto';
import { logger } from '../config/logger';
import { hashPassword } from '../utils/password.utils';
import { initialiserConsentementsParDefaut } from './privacy.service';
import { envoyerSmsSimule, notifierSansBloquer } from './notification.service';
import { getIdentitePlateforme } from './parametres.service';
import type {
  PresenceDuJourView,
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
// Partagees avec laboratoire.service (P2) : une seule forme de demande.
export const PERSONNE_SELECT = { id: true, prenom: true, nom: true, role: true } as const;
export const STRUCTURE_SELECT = { id: true, nom: true, type: true, prefecture: true } as const;
export const EXAMEN_SELECT = {
  id: true, codeLoinc: true, libelle: true, categorie: true, specimen: true,
  unite: true, aJeun: true, consignes: true, prixGnf: true,
  refMin: true, refMax: true, refTexte: true, critiqueMin: true, critiqueMax: true,
} as const;

export const DEMANDE_INCLUDE = {
  episode: { select: { numero: true } },
  patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
  prescripteur: { select: PERSONNE_SELECT },
  laboratoire: { select: STRUCTURE_SELECT },
  valideur: { select: PERSONNE_SELECT },
  liberePar: { select: PERSONNE_SELECT },
  echantillons: { include: { preleveur: { select: PERSONNE_SELECT } }, orderBy: { preleveLe: 'asc' } },
  lignes: {
    include: { examen: { select: EXAMEN_SELECT }, resultat: { include: { saisiPar: { select: PERSONNE_SELECT }, echantillon: { select: { code: true } } } } },
    orderBy: { examen: { libelle: 'asc' } },
  },
  _count: { select: { alertesCritiques: { where: { accuseeLe: null } } } },
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

export type DemandeRow = Prisma.DemandeAnalyseGetPayload<{ include: typeof DEMANDE_INCLUDE }>;
type EpisodeRow = Prisma.EpisodeSoinsGetPayload<{ include: typeof EPISODE_INCLUDE }>;

// Types de structures pouvant recevoir une demande d'analyse : laboratoires
// et etablissements disposant d'un plateau technique.
const TYPES_LABO = ['LABORATOIRE', 'CHU', 'HOPITAL_REG', 'HOPITAL_PREF'] as const;

// ── Mappeurs ─────────────────────────────────────────────────────────
export function versDemandeView(d: DemandeRow): DemandeAnalyseView {
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
    lignes: d.lignes.map((l) => ({
      id: l.id,
      examen: l.examen,
      commentaire: l.commentaire,
      resultat: l.resultat
        ? {
            id: l.resultat.id, valeur: l.resultat.valeur, valeurNumerique: l.resultat.valeurNumerique, unite: l.resultat.unite,
            refMin: l.resultat.refMin, refMax: l.resultat.refMax, refTexte: l.resultat.refTexte,
            interpretation: l.resultat.interpretation, commentaire: l.resultat.commentaire, saisiLe: l.resultat.saisiLe,
            saisiPar: l.resultat.saisiPar, codeEchantillon: l.resultat.echantillon?.code ?? null,
          }
        : null,
    })),
    lieuPrelevement: d.lieuPrelevement,
    creneauPrelevement: d.creneauPrelevement,
    recueLe: d.recueLe,
    preleveeLe: d.preleveeLe,
    valideeLe: d.valideeLe,
    valideur: d.valideur,
    commentaireLaboratoire: d.commentaireLaboratoire,
    commentaireMedecin: d.commentaireMedecin,
    libereePar: d.liberePar ?? null,
    diffuseePatientLe: d.diffuseePatientLe,
    echantillons: d.echantillons.map((e) => ({ id: e.id, code: e.code, specimen: e.specimen, preleveLe: e.preleveLe, commentaire: e.commentaire, preleveur: e.preleveur })),
    alerteCritiqueEnAttente: d._count.alertesCritiques > 0,
  };
}

/**
 * Vue patient : les resultats ne sont visibles qu'une fois diffuses
 * (validation du laboratoire, et accuse du prescripteur si critique — EF-04-09).
 */
export function versDemandeViewPatient(d: DemandeRow): DemandeAnalyseView {
  const vue = versDemandeView(d);
  if (vue.diffuseePatientLe) return vue;
  return { ...vue, commentaireLaboratoire: null, commentaireMedecin: null, libereePar: null, lignes: vue.lignes.map((l) => ({ ...l, resultat: null })) };
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

/**
 * Masque les valeurs d'analyse pour l'agent d'accueil (addendum du 2026-09-28).
 *
 * Fermer `/demandes-analyse/:id` ne suffisait pas : la fiche d'episode porte
 * elle aussi les lignes et leurs resultats, et elle lui reste ouverte — c'est
 * son ecran de travail. Sans ce filtre, le droit retire d'un cote revenait par
 * l'autre. Il garde ce dont il a besoin, la liste des examens demandes et
 * l'avancement, mais pas les valeurs.
 */
function sansValeursPourLAccueil(user: JwtPayload, vue: EpisodeSoinsView): EpisodeSoinsView {
  if (user.role !== 'AGENT_ACCUEIL') return vue;
  return {
    ...vue,
    demandesAnalyse: vue.demandesAnalyse.map((d) => ({
      ...d,
      commentaireLaboratoire: null,
      commentaireMedecin: null,
      libereePar: null,
      lignes: d.lignes.map((l) => ({ ...l, resultat: null })),
    })),
  };
}

export async function getEpisode(user: JwtPayload, idEpisode: string): Promise<EpisodeSoinsView> {
  return sansValeursPourLAccueil(user, versEpisodeView(await episodeDeLaStructure(user, idEpisode)));
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
//
// L'accueil oriente, il ne fixe plus l'heure (addendum du 2026-09-28,
// point 3). Le creneau appartient au medecin, qui seul connait son agenda :
// jusqu'ici l'accueil posait une convocation que le medecin subissait.
export async function orienter(user: JwtPayload, idEpisode: string, dto: OrientationDto): Promise<EpisodeSoinsView> {
  const episode = await episodeDeLaStructure(user, idEpisode);
  if (episode.statut === 'CLOS' || episode.statut === 'ANNULE') throw new ConflictError('Cet episode est termine');
  if (!dto.idMedecin && !dto.service) throw new ValidationError('Indiquez un medecin ou un service');
  if (dto.idMedecin) await verifierMedecinDeLaStructure(dto.idMedecin, episode.idStructure);

  await prisma.$transaction(async (tx) => {
    await tx.episodeSoins.update({
      where: { id: idEpisode },
      data: {
        statut: 'EN_COURS',
        ...(dto.service !== undefined && { service: dto.service }),
        ...(dto.idMedecin && { idResponsable: dto.idMedecin }),
      },
    });
    // Reorienter vers quelqu'un d'autre annule la convocation precedente : on
    // ne laisse pas un patient attendu par deux medecins.
    if (dto.idMedecin) {
      await tx.rendezVous.updateMany({
        where: { idEpisode, statut: 'PLANIFIE', idMedecin: { not: dto.idMedecin } },
        data: { statut: 'ANNULE' },
      });
    }
  });

  // Le medecin destinataire doit etre prevenu : sans cela l'orientation
  // s'ecrit en base et personne ne voit arriver le patient. C'est a lui, et
  // non plus a l'accueil, de poser le rendez-vous.
  if (dto.idMedecin) {
    await notifierSansBloquer({
      idUtilisateur: dto.idMedecin,
      type: 'ORIENTATION',
      titre: 'Un patient vous est oriente',
      contenu: `Episode ${episode.numero} — ${dto.motif ?? episode.motif}. Fixez-lui un rendez-vous.`,
      lienAction: '/medecin/orientations',
      metadonnees: { idEpisode },
    });
  }

  // Le patient n'est prevenu d'aucune heure ici : il n'y en a pas encore. Lui
  // en annoncer une que le medecin n'a pas confirmee serait lui faire perdre
  // un deplacement.
  const patientUser = await prisma.utilisateur.findFirst({ where: { patientProfile: { id: episode.idPatient } }, select: { id: true, telephone: true } });
  if (patientUser) {
    await notifierSansBloquer({
      idUtilisateur: patientUser.id,
      type: 'ORIENTATION',
      titre: 'Orientation',
      contenu: `Vous etes oriente(e) vers ${dto.service ?? 'un medecin'} a ${episode.structure.nom}. Vous serez prevenu(e) des qu'un rendez-vous sera fixe.`,
      lienAction: '/patient/parcours',
      metadonnees: { idEpisode },
    });
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
    // EF-11-02 : le SMS ne dit pas qu'il s'agit d'analyses. Le detail, les
    // consignes et le laboratoire se lisent dans l'espace du patient.
    await envoyerSmsSimule(patientUser.telephone, messagePatientInformation(nomCourt));
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
export function echapper(v: string | null | undefined): string {
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
    demandesAnalyse: e.demandesAnalyse.map(versDemandeViewPatient),
    // Le patient ne voit pas les rendez-vous remplaces (ANNULE) : seul le
    // rendez-vous en vigueur et l'historique tenu comptent pour lui.
    rendezVous: e.rendezVous.filter((r) => r.statut !== 'ANNULE'),
  }));
}

/** Bon d'examen consultable par le patient lui-meme. */
export async function documentDemandePourPatient(userId: string, idDemande: string): Promise<string> {
  const d = await prisma.demandeAnalyse.findFirst({ where: { id: idDemande, patient: { idUtilisateur: userId } }, include: DEMANDE_INCLUDE });
  if (!d) throw new NotFoundError('Demande introuvable');
  return rendreBonExamen(versDemandeViewPatient(d));
}

// ── Pointage de presence (addendum du 2026-09-28, point 2) ───────────
//
// Le patient arrive avec ou sans rendez-vous ; l'assistante pointe son
// arrivee, voit avec quel medecin il a rendez-vous, et le redirige au moment
// opportun. C'est le seul geste de l'accueil qui touche au rendez-vous : il
// ne le cree pas et n'en change pas l'heure.

const PRESENCE_INCLUDE = {
  patient: { select: { id: true, utilisateur: { select: { prenom: true, nom: true, telephone: true } } } },
  // `bureau` : ce que l'agent lit au patient juste apres l'avoir pointe.
  medecin: {
    select: {
      id: true, prenom: true, nom: true,
      medecinProfile: { select: { bureau: true } },
    },
  },
  episode: { select: { id: true } },
} satisfies Prisma.RendezVousInclude;

type PresenceRow = Prisma.RendezVousGetPayload<{ include: typeof PRESENCE_INCLUDE }>;

function versPresence(r: PresenceRow): PresenceDuJourView {
  return {
    idRendezVous: r.id,
    prevuLe: r.prevuLe.toISOString(),
    statut: r.statut,
    arriveeLe: r.arriveeLe?.toISOString() ?? null,
    patient: {
      id: r.patient.id,
      prenom: r.patient.utilisateur.prenom,
      nom: r.patient.utilisateur.nom,
      telephone: r.patient.utilisateur.telephone,
    },
    medecin: r.medecin
      ? {
          id: r.medecin.id,
          prenom: r.medecin.prenom,
          nom: r.medecin.nom,
          // Souvent nul : l'ecran n'affiche alors rien plutot qu'un tiret.
          bureau: r.medecin.medecinProfile?.bureau ?? null,
        }
      : null,
    idEpisode: r.episode?.id ?? null,
  };
}

/** Les patients attendus aujourd'hui dans cette structure. */
export async function presencesDuJour(user: JwtPayload, jour?: string): Promise<PresenceDuJourView[]> {
  const idStructure = await structureDe(user);

  const base = jour ? new Date(jour) : new Date();
  if (Number.isNaN(base.getTime())) throw new ValidationError('Date invalide');
  const debut = new Date(base); debut.setHours(0, 0, 0, 0);
  const fin = new Date(base); fin.setHours(23, 59, 59, 999);

  const rdvs = await prisma.rendezVous.findMany({
    where: {
      episode: { idStructure },
      statut: { not: 'ANNULE' },
      prevuLe: { gte: debut, lte: fin },
    },
    include: PRESENCE_INCLUDE,
    orderBy: { prevuLe: 'asc' },
    take: 200,
  });
  return rdvs.map(versPresence);
}

/** L'assistante pointe l'arrivee : c'est la que l'attente commence. */
export async function pointerPresence(user: JwtPayload, idRendezVous: string): Promise<PresenceDuJourView> {
  const idStructure = await structureDe(user);

  const rdv = await prisma.rendezVous.findFirst({
    where: { id: idRendezVous, episode: { idStructure } },
    select: { id: true, statut: true, idMedecin: true, idEpisode: true, patient: { select: { utilisateur: { select: { prenom: true, nom: true } } } } },
  });
  if (!rdv) throw new NotFoundError('Rendez-vous introuvable');
  if (rdv.statut === 'ANNULE') throw new ConflictError('Ce rendez-vous est annule');

  const maintenant = new Date();
  // Attribution atomique : deux agents qui pointent en meme temps donnent un
  // gagnant et un perdant, jamais deux notifications au medecin.
  const prise = await prisma.rendezVous.updateMany({
    where: { id: idRendezVous, statut: 'PLANIFIE' },
    data: { statut: 'PRESENT', arriveeLe: maintenant, idPointePar: user.userId },
  });
  if (prise.count === 0) throw new ConflictError('Ce patient est deja pointe');

  // Le medecin doit savoir que son patient attend, sinon le pointage ne sert
  // a rien : l'assistante devrait aller le lui dire de vive voix.
  if (rdv.idMedecin) {
    await notifierSansBloquer({
      idUtilisateur: rdv.idMedecin,
      type: 'RAPPEL_RENDEZ_VOUS',
      titre: 'Votre patient est arrive',
      contenu: `${rdv.patient.utilisateur.prenom} ${rdv.patient.utilisateur.nom} attend a l'accueil.`,
      lienAction: '/medecin/agenda',
      metadonnees: { idRendezVous, idEpisode: rdv.idEpisode },
    });
  }

  const maj = await prisma.rendezVous.findUniqueOrThrow({ where: { id: idRendezVous }, include: PRESENCE_INCLUDE });
  return versPresence(maj);
}

/**
 * Creer le dossier d'un patient depuis le comptoir (EF-03-01).
 *
 * **L'accueil ne quitte plus son espace pour la page publique d'inscription.**
 * Il y etait renvoye dans un nouvel onglet, avec un formulaire concu pour
 * quelqu'un qui s'inscrit seul chez lui — et il perdait le fil de l'admission
 * en cours.
 *
 * **Le mot de passe est genere, pas invente par l'agent.** Un agent qui
 * choisirait le mot de passe du patient le connaitrait ; il est affiche une
 * seule fois pour etre remis, et le patient doit le changer a sa premiere
 * connexion (`doitChangerMotDePasse`), comme pour un agent de structure.
 *
 * Les antecedents (allergies, maladies chroniques, groupe sanguin) ne sont pas
 * demandes ici : au comptoir, on enregistre une identite. Le reste se recueille
 * en consultation, par quelqu'un dont c'est le metier.
 */
export async function creerPatientAuComptoir(
  user: JwtPayload,
  dto: {
    telephone: string; prenom: string; nom: string;
    dateNaissance: string; sexe: string; prefecture: string;
    sousPrefecture?: string; email?: string;
  },
): Promise<{ patient: { id: string; prenom: string; nom: string }; motDePasseTemporaire: string }> {
  const existant = await prisma.utilisateur.findUnique({
    where: { telephone: dto.telephone },
    select: { id: true, prenom: true, nom: true, role: true },
  });
  if (existant) {
    // On nomme la personne : l'agent saura s'il s'agit du bon dossier, au lieu
    // de recommencer sa recherche a l'aveugle.
    throw new ConflictError(
      `Ce numero appartient deja a ${existant.prenom} ${existant.nom}. Cherchez-le dans la liste.`,
    );
  }

  const motDePasseTemporaire = genererMotDePasseTemp();
  const motDePasseHash = await hashPassword(motDePasseTemporaire);

  const patient = await prisma.$transaction(async (tx) => {
    const u = await tx.utilisateur.create({
      data: {
        telephone: dto.telephone,
        email: dto.email?.trim() || null,
        motDePasseHash,
        prenom: dto.prenom.trim(),
        nom: dto.nom.trim(),
        role: 'PATIENT',
        doitChangerMotDePasse: true,
      },
      select: { id: true, prenom: true, nom: true },
    });

    const p = await tx.patientProfile.create({
      data: {
        idUtilisateur: u.id,
        dateNaissance: new Date(dto.dateNaissance),
        sexe: dto.sexe,
        prefecture: dto.prefecture.trim(),
        sousPrefecture: dto.sousPrefecture?.trim() || null,
        // Le patient est rattache a la structure qui l'enregistre : c'est la
        // qu'il sera suivi, et c'est ce qui ouvre l'episode de soins.
        idStructurePreferee: await structureDe(user),
      },
      select: { id: true },
    });

    await initialiserConsentementsParDefaut(tx, p.id, u.id);
    return { id: p.id, prenom: u.prenom, nom: u.nom };
  });

  logger.info('[ADMISSION] dossier patient cree au comptoir', {
    idPatient: patient.id, parQui: user.userId,
  });

  return { patient, motDePasseTemporaire };
}

/**
 * Un mot de passe temporaire lisible a voix haute.
 *
 * Sans O/0 ni I/l : il est dicte au comptoir, parfois dans le bruit.
 */
function genererMotDePasseTemp(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(5);
  let pwd = 'BaoBao@';
  for (let i = 0; i < 5; i++) pwd += chars[bytes[i]! % chars.length];
  return pwd;
}
