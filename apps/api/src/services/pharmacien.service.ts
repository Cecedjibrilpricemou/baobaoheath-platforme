import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma';
import { Role, StatutOrdonnance, TypeStructure } from '../config/generated/client/client';
import { hashPassword } from '../utils/password.utils';

type CreateAgentPharmacieDto = {
  telephone: string;
  email?: string;
  prenom: string;
  nom: string;
  motDePasse?: string;
};

function genererMotDePasseTemp(): string {
  return `BaoBao@${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

async function getPharmacienAvecStructure(pharmacienId: string) {
  const pharmacien = await prisma.utilisateur.findUnique({
    where: { id: pharmacienId },
    include: {
      structure: true,
      pharmacienProfile: true,
    },
  });

  if (!pharmacien?.idStructure || !pharmacien.structure) {
    throw new Error('Pharmacien sans structure assignee');
  }
  if (pharmacien.structure.type !== TypeStructure.PHARMACIE) {
    throw new Error('La structure assignee n est pas une pharmacie');
  }

  return pharmacien;
}

export async function scanPatient(qrCode: string, pharmacienId: string) {
  await getPharmacienAvecStructure(pharmacienId);

  const patient = await prisma.patientProfile.findUnique({
    where: { qrCode },
    include: {
      utilisateur: { select: { id: true, prenom: true, nom: true, telephone: true } },
      consultations: {
        where: { statut: 'TERMINEE' },
        include: {
          ordonnances: {
            where: { statut: StatutOrdonnance.EN_ATTENTE },
            include: { medicament: true },
          },
        },
        orderBy: { consulteeLE: 'desc' },
        take: 5,
      },
    },
  });
  if (!patient) throw new Error('Patient non trouve');
  return patient;
}

export async function delivrerOrdonnance(
  ordonnanceId: string,
  pharmacienId: string,
  _dto: { modePaiement?: string }
) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: ordonnanceId },
    include: { medicament: true },
  });
  if (!ordonnance) throw new Error('Ordonnance non trouvee');
  if (ordonnance.statut !== StatutOrdonnance.EN_ATTENTE) {
    throw new Error('Cette ordonnance ne peut plus etre delivree');
  }

  const stock = await prisma.stock.findFirst({
    where: {
      idMedicament: ordonnance.idMedicament,
      idStructure: pharmacien.idStructure,
    },
  });
  if (!stock) throw new Error('Stock insuffisant pour delivrer cette ordonnance');

  const updatedOrdonnance = await prisma.$transaction(async (tx) => {
    // Atomic check-and-decrement: fails if quantity dropped below threshold since we checked
    const decremented = await tx.stock.updateMany({
      where: { id: stock.id, quantite: { gte: ordonnance.quantite } },
      data: { quantite: { decrement: ordonnance.quantite } },
    });
    if (decremented.count === 0) throw new Error('Stock insuffisant pour delivrer cette ordonnance');

    return tx.ordonnance.update({
      where: { id: ordonnanceId },
      data: { statut: StatutOrdonnance.DELIVREE },
      include: { medicament: true },
    });
  });

  return updatedOrdonnance;
}

export async function getStocksPharmacie(pharmacienId: string) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  return prisma.stock.findMany({
    where: { idStructure: pharmacien.idStructure },
    include: { medicament: true },
    orderBy: { quantite: 'asc' },
  });
}

export async function getOrdonnances(pharmacienId: string) {
  await getPharmacienAvecStructure(pharmacienId);

  return prisma.ordonnance.findMany({
    where: { statut: StatutOrdonnance.EN_ATTENTE },
    include: {
      medicament: true,
      consultation: {
        include: {
          patient: {
            include: { utilisateur: { select: { prenom: true, nom: true, telephone: true } } },
          },
        },
      },
    },
    orderBy: { creeLe: 'desc' },
    take: 50,
  });
}

export async function reapprovisionnerStock(pharmacienId: string, dto: {
  idMedicament: string;
  quantiteAjoutee: number;
  datePeremption?: string;
  margeGnf?: number;
  unite?: string;
}) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);
  if (dto.quantiteAjoutee <= 0) throw new Error('La quantite doit etre superieure a 0');

  const medicament = await prisma.medicament.findUnique({ where: { id: dto.idMedicament } });
  if (!medicament) throw new Error('Medicament non trouve');

  const stockExistant = await prisma.stock.findFirst({
    where: {
      idMedicament: dto.idMedicament,
      idStructure: pharmacien.idStructure,
    },
  });

  if (stockExistant) {
    return prisma.stock.update({
      where: { id: stockExistant.id },
      data: {
        quantite: { increment: dto.quantiteAjoutee },
        ...(dto.unite && { unite: dto.unite }),
        ...(dto.datePeremption && { datePeremption: new Date(dto.datePeremption) }),
        ...(dto.margeGnf !== undefined && { margeGnf: dto.margeGnf }),
      },
      include: { medicament: true },
    });
  }

  return prisma.stock.create({
    data: {
      idMedicament: dto.idMedicament,
      idStructure: pharmacien.idStructure,
      quantite: dto.quantiteAjoutee,
      seuilAlerte: 10,
      unite: dto.unite ?? 'unite',
      datePeremption: dto.datePeremption ? new Date(dto.datePeremption) : null,
      margeGnf: dto.margeGnf ?? 0,
    },
    include: { medicament: true },
  });
}

export async function getMedicaments() {
  return prisma.medicament.findMany({
    where: { estActif: true },
    orderBy: { dci: 'asc' },
  });
}

export async function getAgentsPharmacie(pharmacienId: string) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  return prisma.utilisateur.findMany({
    where: {
      idStructure: pharmacien.idStructure,
      role: Role.PHARMACIEN,
      estActif: true,
    },
    select: {
      id: true,
      telephone: true,
      email: true,
      prenom: true,
      nom: true,
      role: true,
      creeLe: true,
      derniereConnexion: true,
      pharmacienProfile: { select: { estResponsable: true } },
    },
    orderBy: { creeLe: 'desc' },
  });
}

export async function creerAgentPharmacie(pharmacienId: string, dto: CreateAgentPharmacieDto) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);
  if (!pharmacien.pharmacienProfile?.estResponsable) {
    throw new Error('Seul le pharmacien responsable peut creer des agents');
  }

  const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
  if (existingTel) throw new Error('Ce numero de telephone est deja utilise');

  if (dto.email) {
    const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new Error('Cette adresse email est deja utilisee');
  }

  const motDePasseTemp = dto.motDePasse || genererMotDePasseTemp();
  const motDePasseHash = await hashPassword(motDePasseTemp);
  const isTemporaire = !dto.motDePasse;

  const agent = await prisma.$transaction(async (tx) => {
    const user = await tx.utilisateur.create({
      data: {
        telephone: dto.telephone,
        email: dto.email ?? null,
        motDePasseHash,
        prenom: dto.prenom,
        nom: dto.nom,
        role: Role.PHARMACIEN,
        idStructure: pharmacien.idStructure,
        doitChangerMotDePasse: isTemporaire,
      },
    });

    await tx.pharmacienProfile.create({
      data: {
        idUtilisateur: user.id,
        idStructure: pharmacien.idStructure,
        estResponsable: false,
      },
    });

    return user;
  });

  return {
    agent: {
      id: agent.id,
      telephone: agent.telephone,
      email: agent.email,
      prenom: agent.prenom,
      nom: agent.nom,
      role: agent.role,
    },
    motDePasseTemporaire: isTemporaire ? motDePasseTemp : undefined,
  };
}

export async function trouverPharmaciesProches(prefecture: string) {
  return prisma.structureSante.findMany({
    where: { type: TypeStructure.PHARMACIE, prefecture, estActive: true },
    select: { id: true, nom: true, adresse: true, telephone: true, latitude: true, longitude: true },
  });
}
