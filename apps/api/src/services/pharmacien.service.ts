import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma';
import { Role, StatutOrdonnance, TypeStructure } from '../config/generated/client/client';
import { hashPassword } from '../utils/password.utils';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { getValeursParametres } from './parametres.service';
import { estExpiree, motifDeRefus, recalculerStatut } from './ordonnance.service';
import type {
  OrdonnanceDelivranceView,
  OrdonnanceEnAttenteView,
  VerificationOrdonnanceView,
} from '@baobaoheath/shared-types';

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
    throw new ForbiddenError('Pharmacien sans structure assignee');
  }
  if (pharmacien.structure.type !== TypeStructure.PHARMACIE) {
    throw new ValidationError('La structure assignee n est pas une pharmacie');
  }

  // Les gardes ci-dessus garantissent la structure ; le type le dit aussi.
  return { ...pharmacien, structure: pharmacien.structure };
}

type OrdonnanceAvecLignes = {
  id: string;
  numero: string;
  statut: StatutOrdonnance;
  valideJusquau: Date;
  signeLe: Date | null;
  creeLe: Date;
  signataire: { prenom: string; nom: string } | null;
  lignes: {
    id: string;
    posologie: string;
    frequence: string;
    dureeJours: number;
    quantite: number;
    statut: StatutOrdonnance;
    instructions: string | null;
    medicament: { id: string; dci: string; nomCommercial: string | null; forme: string; dosage: string; prixUnitaireGnf: number };
  }[];
};

/**
 * Assemble la vue comptoir d'une ordonnance. `totalGnf` ne compte que les
 * lignes restant a delivrer : afficher le total prescrit ferait payer deux
 * fois un traitement deja entame dans une autre officine.
 */
function vueDelivrance(
  o: OrdonnanceAvecLignes,
  allergies: string[],
  agentDefaut: { prenom: string; nom: string } | null
): OrdonnanceDelivranceView {
  const signataire = o.signataire ?? agentDefaut;
  const lignes = o.lignes.map((l) => {
    const alerteAllergie = allergies.some(
      (a) =>
        a.toLowerCase() === l.medicament.dci.toLowerCase() ||
        (!!l.medicament.nomCommercial && a.toLowerCase() === l.medicament.nomCommercial.toLowerCase())
    );
    return {
      id: l.id,
      posologie: l.posologie,
      frequence: l.frequence,
      dureeJours: l.dureeJours,
      quantite: l.quantite,
      statut: l.statut as OrdonnanceDelivranceView['statut'],
      instructions: l.instructions,
      medicament: l.medicament,
      prixTotalGnf: l.quantite * l.medicament.prixUnitaireGnf,
      alerteAllergie,
    };
  });

  return {
    id: o.id,
    numero: o.numero,
    statut: o.statut as OrdonnanceDelivranceView['statut'],
    valideJusquau: o.valideJusquau.toISOString(),
    expiree: estExpiree(o),
    signeLe: o.signeLe ? o.signeLe.toISOString() : null,
    medecinNom: signataire ? `${signataire.prenom} ${signataire.nom}` : 'Inconnu',
    lignes,
    totalGnf: lignes
      .filter((l) => l.statut !== StatutOrdonnance.DELIVREE)
      .reduce((somme, l) => somme + l.prixTotalGnf, 0),
  };
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
          asc: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
          ordonnances: {
            // Une ordonnance partiellement servie reste a servir : la limiter
            // a EN_ATTENTE ferait disparaitre du comptoir le reste d'un
            // traitement deja entame ailleurs.
            where: {
              statut: {
                in: [StatutOrdonnance.EN_ATTENTE, StatutOrdonnance.PARTIELLEMENT_SERVIE],
              },
            },
            include: {
              lignes: { include: { medicament: true } },
              signataire: { select: { prenom: true, nom: true } },
            },
          },
        },
        orderBy: { consulteeLE: 'desc' },
        take: 5,
      },
    },
  });
  if (!patient) throw new NotFoundError('Patient non trouve');

  const ordonnances = patient.consultations.flatMap((c) =>
    c.ordonnances.map((o) =>
      vueDelivrance(o, patient.allergies, c.asc?.utilisateur ?? null)
    )
  );

  return {
    patient: {
      prenom: patient.utilisateur.prenom,
      nom: patient.utilisateur.nom,
      dateNaissance: patient.dateNaissance.toISOString(),
      sexe: patient.sexe,
      groupeSanguin: patient.groupeSanguin ?? undefined,
      allergiesCritiques: patient.allergies,
    },
    ordonnances,
    totalOrdonnances: ordonnances.length,
  };
}

/**
 * Delivrance d'un medicament de l'ordonnance. L'unite est la ligne, pas le
 * document : une officine peut n'avoir qu'une partie du traitement (EF-07-07).
 * Le document est controle avant toute sortie de stock — non signe, expire ou
 * annule, rien ne sort.
 */
export async function delivrerLigneOrdonnance(
  ligneId: string,
  pharmacienId: string,
  dto: { modePaiement?: string; quantiteDelivree?: number }
) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  const ligne = await prisma.ligneOrdonnance.findUnique({
    where: { id: ligneId },
    include: { medicament: true, ordonnance: true },
  });
  if (!ligne) throw new NotFoundError('Ligne d ordonnance non trouvee');

  // EF-05-07/08 : le controle porte sur le document, pas sur la ligne.
  const refus = motifDeRefus(ligne.ordonnance);
  if (refus) throw new ValidationError(refus);

  if (ligne.statut !== StatutOrdonnance.EN_ATTENTE) {
    throw new ValidationError('Ce medicament a deja ete delivre');
  }

  const quantiteDelivree = dto.quantiteDelivree ?? ligne.quantite;
  if (quantiteDelivree > ligne.quantite) {
    throw new ValidationError('La quantite delivree ne peut pas depasser la quantite prescrite');
  }

  const stock = await prisma.stock.findFirst({
    where: {
      idMedicament: ligne.idMedicament,
      idStructure: pharmacien.idStructure,
    },
  });
  if (!stock) throw new ValidationError('Stock insuffisant pour delivrer ce medicament');

  const ligneDelivree = await prisma.$transaction(async (tx) => {
    // Decrement conditionnel : echoue si le stock est passe sous le seuil
    // depuis la lecture ci-dessus.
    const decremented = await tx.stock.updateMany({
      where: { id: stock.id, quantite: { gte: quantiteDelivree } },
      data: { quantite: { decrement: quantiteDelivree } },
    });
    if (decremented.count === 0) throw new ValidationError('Stock insuffisant pour delivrer ce medicament');

    const maj = await tx.ligneOrdonnance.update({
      where: { id: ligneId },
      data: { statut: StatutOrdonnance.DELIVREE },
      include: { medicament: true },
    });

    // Le statut du document suit ses lignes : SERVIE quand la derniere sort.
    await recalculerStatut(ligne.idOrdonnance, tx);
    return maj;
  });

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: ligne.idOrdonnance },
    select: { numero: true, statut: true },
  });

  return {
    ...ligneDelivree,
    numeroOrdonnance: ordonnance?.numero ?? null,
    statutOrdonnance: ordonnance?.statut ?? null,
    quantiteDelivree,
    montantGnf: quantiteDelivree * ligneDelivree.medicament.prixUnitaireGnf,
  };
}

/**
 * EF-07-01 : controle d'une ordonnance presentee au comptoir sans QR patient.
 * Le numero seul ne suffit pas — il est sequentiel, donc devinable ; le code
 * de verification prouve que le porteur a bien l'ordonnance.
 */
export async function verifierOrdonnance(
  pharmacienId: string,
  dto: { numero: string; codeVerification: string }
): Promise<VerificationOrdonnanceView> {
  await getPharmacienAvecStructure(pharmacienId);

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { numero: dto.numero.trim().toUpperCase() },
    include: {
      lignes: { include: { medicament: true } },
      signataire: { select: { prenom: true, nom: true } },
      consultation: {
        include: {
          asc: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
          patient: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
        },
      },
    },
  });

  // Numero inconnu et code faux donnent la meme reponse : distinguer les deux
  // permettrait d'enumerer les numeros valides.
  const codeAttendu = ordonnance?.codeVerification ?? '';
  const codeFourni = dto.codeVerification.trim().toUpperCase();
  if (!ordonnance || codeAttendu !== codeFourni) {
    return { valide: false, motif: 'Numero ou code de verification incorrect' };
  }

  const refus = motifDeRefus(ordonnance);
  const patient = ordonnance.consultation.patient;
  const vue = vueDelivrance(ordonnance, patient.allergies, ordonnance.consultation.asc?.utilisateur ?? null);

  return {
    valide: refus === null,
    motif: refus ?? undefined,
    ordonnance: vue,
    patient: {
      prenom: patient.utilisateur.prenom,
      nom: patient.utilisateur.nom,
      dateNaissance: patient.dateNaissance.toISOString(),
      sexe: patient.sexe,
      groupeSanguin: patient.groupeSanguin ?? undefined,
      allergiesCritiques: patient.allergies,
    },
  };
}

export async function getStocksPharmacie(pharmacienId: string) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  return prisma.stock.findMany({
    where: { idStructure: pharmacien.idStructure },
    include: { medicament: true },
    orderBy: { quantite: 'asc' },
  });
}

// Une ordonnance n'est rattachee a aucune pharmacie avant sa delivrance : on
// restreint donc la liste a la prefecture de la pharmacie, plutot que
// d'exposer toutes les ordonnances du pays avec le nom des patients.
export async function getOrdonnances(pharmacienId: string): Promise<OrdonnanceEnAttenteView[]> {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);

  const ordonnances = await prisma.ordonnance.findMany({
    where: {
      statut: {
        in: [StatutOrdonnance.EN_ATTENTE, StatutOrdonnance.PARTIELLEMENT_SERVIE],
      },
      // Une ordonnance non signee n'est pas opposable : elle n'a rien a faire
      // dans la file du comptoir.
      signeLe: { not: null },
      consultation: { patient: { prefecture: pharmacien.structure.prefecture } },
    },
    select: {
      id: true,
      numero: true,
      statut: true,
      valideJusquau: true,
      creeLe: true,
      signeLe: true,
      lignes: {
        where: { statut: StatutOrdonnance.EN_ATTENTE },
        select: {
          medicament: { select: { id: true, dci: true, nomCommercial: true, forme: true, dosage: true } },
        },
      },
      consultation: {
        select: {
          patient: {
            select: { qrCode: true, utilisateur: { select: { prenom: true, nom: true } } },
          },
        },
      },
    },
    orderBy: { creeLe: 'desc' },
    take: 50,
  });

  return ordonnances.map(({ consultation, lignes, ...o }) => ({
    ...o,
    expiree: estExpiree(o),
    medicaments: lignes.map((l) => l.medicament),
    patient: {
      prenom: consultation.patient.utilisateur.prenom,
      nom: consultation.patient.utilisateur.nom,
      qrCode: consultation.patient.qrCode,
    },
  }));
}

export async function reapprovisionnerStock(pharmacienId: string, dto: {
  idMedicament: string;
  quantiteAjoutee: number;
  datePeremption?: string;
  margeGnf?: number;
  unite?: string;
}) {
  const pharmacien = await getPharmacienAvecStructure(pharmacienId);
  if (dto.quantiteAjoutee <= 0) throw new ValidationError('La quantite doit etre superieure a 0');

  const medicament = await prisma.medicament.findUnique({ where: { id: dto.idMedicament } });
  if (!medicament) throw new NotFoundError('Medicament non trouve');

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

  // Sans marge saisie, on applique la marge par defaut de la plateforme
  // (Parametres > Facturation) au prix national de reference du medicament.
  const { facturation } = await getValeursParametres();
  const margeParDefautGnf = Math.round(medicament.prixUnitaireGnf * facturation.margePct / 100);

  return prisma.stock.create({
    data: {
      idMedicament: dto.idMedicament,
      idStructure: pharmacien.idStructure,
      quantite: dto.quantiteAjoutee,
      seuilAlerte: 10,
      unite: dto.unite ?? 'unite',
      datePeremption: dto.datePeremption ? new Date(dto.datePeremption) : null,
      margeGnf: dto.margeGnf ?? margeParDefautGnf,
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
    throw new ForbiddenError('Seul le pharmacien responsable peut creer des agents');
  }

  const existingTel = await prisma.utilisateur.findUnique({ where: { telephone: dto.telephone } });
  if (existingTel) throw new ConflictError('Ce numero de telephone est deja utilise');

  if (dto.email) {
    const existingEmail = await prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictError('Cette adresse email est deja utilisee');
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
