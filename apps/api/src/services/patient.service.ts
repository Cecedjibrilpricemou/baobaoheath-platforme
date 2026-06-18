import { randomUUID } from 'crypto';
import { Role, SyncOperation } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { CreatePatientDto, PatientFilters, UpdatePatientDto } from '../types/patient.types';
import { generateTokenPair } from '../utils/jwt.utils';
import { hashPassword } from '../utils/password.utils';
import { assertCanAccessPatient, buildPatientWhereForUser } from './access-control.service';
import { recordSyncEvent } from './sync.service';
import { ConflictError, NotFoundError, ValidationError } from '../utils/app-error';

export async function createPatient(dto: CreatePatientDto) {
  const existing = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
  if (existing) throw new ConflictError('Ce numero de telephone est deja utilise');

  const motDePasseHash = await hashPassword(dto.motDePasse);

  const result = await prisma.$transaction(async (tx) => {
    const utilisateur = await tx.utilisateur.create({
      data: {
        telephone: dto.telephone,
        motDePasseHash,
        prenom: dto.prenom,
        nom: dto.nom,
        role: Role.PATIENT,
      },
    });

    const patient = await tx.patientProfile.create({
      data: {
        idUtilisateur: utilisateur.id,
        dateNaissance: new Date(dto.dateNaissance),
        sexe: dto.sexe,
        prefecture: dto.prefecture,
        sousPrefecture: dto.sousPrefecture,
        village: dto.village,
        groupeSanguin: dto.groupeSanguin,
        allergies: dto.allergies ?? [],
        maladiesChroniques: dto.maladiesChroniques ?? [],
        urgenceNom: dto.urgenceNom,
        urgenceTelephone: dto.urgenceTelephone,
      },
      include: { utilisateur: true },
    });

    return { utilisateur, patient };
  });

  const sessionId = randomUUID();
  const tokenPair = generateTokenPair({
    userId: result.utilisateur.id,
    role: result.utilisateur.role,
    sessionId,
  });

  await prisma.session.create({
    data: {
      id: sessionId,
      refreshToken: tokenPair.refreshToken,
      expireLe: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idUtilisateur: result.utilisateur.id,
    },
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'PatientProfile',
    entityId: result.patient.id,
    operation: SyncOperation.CREATE,
    idUtilisateur: result.utilisateur.id,
    payload: { prefecture: result.patient.prefecture },
  });

  return { tokenPair, patient: result.patient };
}

export async function getPatients(user: JwtPayload, filters: PatientFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    AND: [
      await buildPatientWhereForUser(user),
      {
        ...(filters.prefecture && { prefecture: filters.prefecture }),
        ...(filters.search && {
          OR: [
            { utilisateur: { prenom: { contains: filters.search, mode: 'insensitive' as const } } },
            { utilisateur: { nom: { contains: filters.search, mode: 'insensitive' as const } } },
            { utilisateur: { telephone: { contains: filters.search } } },
          ],
        }),
      },
    ],
  };

  const [patients, total] = await Promise.all([
    prisma.patientProfile.findMany({
      where,
      skip,
      take: limit,
      include: {
        utilisateur: {
          select: { id: true, telephone: true, prenom: true, nom: true, email: true, photoUrl: true },
        },
      },
      orderBy: { creeLe: 'desc' },
    }),
    prisma.patientProfile.count({ where }),
  ]);

  return { data: patients, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getPatientById(user: JwtPayload, id: string) {
  await assertCanAccessPatient(user, id);

  const patient = await prisma.patientProfile.findUnique({
    where: { id },
    include: {
      utilisateur: {
        select: {
          id: true,
          telephone: true,
          email: true,
          prenom: true,
          nom: true,
          photoUrl: true,
          langue: true,
          creeLe: true,
        },
      },
    },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');
  return patient;
}

export async function getPatientByQrCode(user: JwtPayload, qrCode: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { qrCode },
    include: {
      utilisateur: {
        select: { id: true, telephone: true, email: true, prenom: true, nom: true, photoUrl: true },
      },
    },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');
  await assertCanAccessPatient(user, patient.id);
  return patient;
}

export async function getMyProfile(userId: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    include: {
      utilisateur: {
        select: { id: true, telephone: true, email: true, prenom: true, nom: true, photoUrl: true, langue: true },
      },
      structurePreferee: {
        select: { id: true, nom: true, type: true, prefecture: true, adresse: true, telephone: true },
      },
    },
  });

  if (!patient) throw new NotFoundError('Profil patient non trouve');
  return patient;
}

// ── AMÉLIORATION : $transaction pour garantir la cohérence ──
export async function updateMyProfile(userId: string, dto: UpdatePatientDto) {
  const patient = await prisma.patientProfile.findUnique({ where: { idUtilisateur: userId } });
  if (!patient) throw new NotFoundError('Profil patient non trouve');

  const updated = await prisma.$transaction(async (tx) => {
    if (dto.prenom || dto.nom || dto.email || dto.langue || dto.photoUrl) {
      await tx.utilisateur.update({
        where: { id: userId },
        data: {
          ...(dto.prenom && { prenom: dto.prenom }),
          ...(dto.nom && { nom: dto.nom }),
          ...(dto.email && { email: dto.email }),
          ...(dto.langue && { langue: dto.langue }),
          ...(dto.photoUrl && { photoUrl: dto.photoUrl }),
        },
      });
    }

    return tx.patientProfile.update({
      where: { idUtilisateur: userId },
      data: {
        ...(dto.groupeSanguin && { groupeSanguin: dto.groupeSanguin }),
        ...(dto.allergies && { allergies: dto.allergies }),
        ...(dto.maladiesChroniques && { maladiesChroniques: dto.maladiesChroniques }),
        ...(dto.sousPrefecture && { sousPrefecture: dto.sousPrefecture }),
        ...(dto.village && { village: dto.village }),
        ...(dto.urgenceNom && { urgenceNom: dto.urgenceNom }),
        ...(dto.urgenceTelephone && { urgenceTelephone: dto.urgenceTelephone }),
      },
      include: {
        utilisateur: {
          select: { id: true, telephone: true, email: true, prenom: true, nom: true, photoUrl: true, langue: true },
        },
      },
    });
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'PatientProfile',
    entityId: updated.id,
    operation: SyncOperation.UPDATE,
    idUtilisateur: userId,
    payload: dto,
  });

  return updated;
}

export async function exportPatientDossier(userId: string) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    include: {
      utilisateur: {
        select: {
          id: true, telephone: true, email: true, prenom: true, nom: true,
          photoUrl: true, langue: true, role: true, creeLe: true,
        },
      },
      consultations: {
        include: { constantes: true, diagnostics: true, ordonnances: { include: { medicament: true } } },
        orderBy: { consulteeLE: 'desc' },
      },
      vaccinations: true,
      factures: { orderBy: { creeLe: 'desc' } },
    },
  });

  if (!patient) throw new NotFoundError('Patient non trouve');
  return patient;
}

export async function updateStructurePreferee(userId: string, idStructure: string | null) {
  const patient = await prisma.patientProfile.findUnique({ where: { idUtilisateur: userId } });
  if (!patient) throw new NotFoundError('Profil patient non trouve');

  if (idStructure) {
    const structure = await prisma.structureSante.findUnique({ where: { id: idStructure } });
    if (!structure) throw new NotFoundError('Structure non trouvee');
    if (!structure.estActive) throw new ValidationError("Cette structure n'est plus active");
  }

  const updated = await prisma.patientProfile.update({
    where: { idUtilisateur: userId },
    data: { idStructurePreferee: idStructure },
    include: {
      structurePreferee: {
        select: { id: true, nom: true, type: true, prefecture: true },
      },
    },
  });

  await recordSyncEvent({
    scope: 'medical',
    entityType: 'PatientProfile',
    entityId: updated.id,
    operation: SyncOperation.UPDATE,
    idUtilisateur: userId,
    payload: { idStructurePreferee: idStructure },
  });

  return updated;
}
