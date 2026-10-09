import { prisma } from '../config/prisma';
import {
  ConfirmerPaiementDto,
  InitierPaiementDto,
  PaiementFilters,
} from '../types/paiement.types';
import * as chapchap from './chapchap.service';
import { initierPaiementSimule } from './payment-provider.service';
import { getValeursParametres } from './parametres.service';
import { JwtPayload } from '../types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { logger } from '../config/logger';
import type { FactureView } from '@baobaoheath/shared-types';

const ADMIN_ROLES = new Set(['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']);

/**
 * Ce qu'une facture montre au patient.
 *
 * **Une vue explicite plutot que l'objet Prisma tel quel.** Le front la typait
 * avec `montant`, `devise` et `methode` — trois champs qui n'ont jamais
 * existe cote API : il lisait du vide sans que rien ne le signale. Un
 * convertisseur nomme rend le contrat verifiable par le compilateur des deux
 * cotes.
 */
type FactureComplete = {
  id: string; idConsultation?: string | null; montantGnf: number; statut: string;
  modePaiement: string | null; numeroOperateur: string | null;
  referenceOperateur: string | null; urlPaiement: string | null;
  statutOperateur: string | null; payeeLe: Date | null; creeLe: Date;
  consultation?: { motifPrincipal?: string | null; consulteeLE?: Date | null } | null;
};

export function versFactureView(f: FactureComplete): FactureView {
  return {
    id: f.id,
    idConsultation: f.idConsultation ?? null,
    montantGnf: f.montantGnf,
    statut: f.statut as FactureView['statut'],
    modePaiement: (f.modePaiement as FactureView['modePaiement']) ?? null,
    numeroOperateur: f.numeroOperateur,
    referenceOperateur: f.referenceOperateur,
    // Le lien ne sert plus une fois la facture reglee : le rendre inviterait
    // a repayer.
    urlPaiement: f.statut === 'PAYEE' ? null : f.urlPaiement,
    statutOperateur: f.statutOperateur,
    payeeLe: f.payeeLe,
    creeLe: f.creeLe,
    consultation: f.consultation
      ? {
          motifPrincipal: f.consultation.motifPrincipal ?? null,
          consulteeLE: f.consultation.consulteeLE ?? null,
        }
      : null,
  };
}

const MAX_MONTANT_GNF = 10_000_000;

/**
 * Chap Chap Pay refuse en dessous de 3 000 GNF (verifie contre leur bac a
 * sable : 2 999 est refuse, 3 000 passe).
 *
 * Le dire ici plutot que de laisser remonter leur message : le patient lirait
 * « Le montant doit etre superieur ou egal a 3 000 GNF » sans savoir que cela
 * vient de la passerelle et non de sa consultation.
 */
const MIN_MONTANT_PASSERELLE_GNF = 3_000;

// Le super-admin peut desactiver un mode de paiement depuis la page
// Parametres (onglet Facturation) : on le refuse ici, pas seulement dans l'UI.
async function assertModePaiementActif(modePaiement: InitierPaiementDto['modePaiement']) {
  const { facturation } = await getValeursParametres();
  const actif = {
    ESPECES: facturation.paiementEspeces,
    ORANGE_MONEY: facturation.paiementOrangeMoney,
    MTN_MOMO: facturation.paiementMomo,
  }[modePaiement];
  if (actif === false) {
    throw new ValidationError(`Le mode de paiement ${modePaiement} est desactive par l'administrateur`);
  }
}

/**
 * Ouvrir le paiement d'une consultation.
 *
 * **La facture est creee avant d'appeler la passerelle, et reutilisee ensuite.**
 * L'inverse — refuser quand une facture existe deja — bloquait toute reprise :
 * une passerelle injoignable laissait le patient avec une facture qu'il ne
 * pouvait plus payer. Ici, une facture encore en attente sert de nouveau, avec
 * une nouvelle operation.
 *
 * En especes, aucune passerelle n'intervient : l'agent encaisse et confirme.
 */
export async function initierPaiement(userId: string, dto: InitierPaiementDto) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: dto.idConsultation },
    include: { patient: true, facture: true },
  });

  if (!consultation) throw new NotFoundError('Consultation non trouvee');
  if (consultation.patient.idUtilisateur !== userId) {
    throw new ForbiddenError("Acces refuse - ce n'est pas votre consultation");
  }
  if (consultation.facture?.statut === 'PAYEE') {
    throw new ValidationError('Cette consultation a deja ete payee');
  }

  await assertModePaiementActif(dto.modePaiement);

  // Le tarif du serveur prime ; a defaut, le montant propose est plafonne.
  const montantGnf = consultation.tarifGnf != null && consultation.tarifGnf > 0
    ? consultation.tarifGnf
    : Math.min(dto.montantGnf, MAX_MONTANT_GNF);

  const inclusions = {
    patient: { include: { utilisateur: { select: { prenom: true, nom: true, telephone: true } } } },
    consultation: true,
  };

  // La facture existe des maintenant : une consultation facturee l'est, que le
  // paiement aboutisse ou non.
  const facture = consultation.facture
    ? await prisma.facture.update({
        where: { id: consultation.facture.id },
        data: { montantGnf, modePaiement: dto.modePaiement, numeroOperateur: dto.numeroOperateur },
        include: inclusions,
      })
    : await prisma.facture.create({
        data: {
          idPatient: consultation.patient.id,
          idConsultation: dto.idConsultation,
          montantGnf,
          modePaiement: dto.modePaiement,
          numeroOperateur: dto.numeroOperateur,
          statut: 'EN_ATTENTE',
        },
        include: inclusions,
      });

  // Les especes ne passent par aucune passerelle : l'agent encaisse au
  // guichet et confirme la facture.
  if (dto.modePaiement === 'ESPECES' || !chapchap.chapchapEstConfigure()) {
    if (dto.modePaiement !== 'ESPECES') {
      logger.warn('[PAIEMENT] passerelle non configuree : repli sur la simulation');
    }
    const simule = await initierPaiementSimule({
      modePaiement: dto.modePaiement,
      montantGnf,
      numeroOperateur: dto.numeroOperateur,
    });
    return prisma.facture.update({
      where: { id: facture.id },
      data: { referenceOperateur: simule.referenceOperateur ?? null },
      include: inclusions,
    });
  }

  if (montantGnf < MIN_MONTANT_PASSERELLE_GNF) {
    throw new ValidationError(
      `Le paiement mobile demande au moins ${MIN_MONTANT_PASSERELLE_GNF.toLocaleString('fr-FR')} GNF. `
      + `Reglez ce montant en especes au guichet.`,
    );
  }

  const operation = await chapchap.creerOperation({
    montantGnf,
    // Notre identifiant de facture, prefixe : le rappel sert aussi les ventes
    // de pharmacie, et c'est ce prefixe qui dit laquelle des deux il vise.
    orderId: `FAC-${facture.id}`,
    description: `Consultation du ${consultation.creeLe.toLocaleDateString('fr-FR')}`,
  });

  return prisma.facture.update({
    where: { id: facture.id },
    data: {
      referenceOperateur: operation.operationId,
      urlPaiement: operation.urlPaiement,
      statutOperateur: 'new',
    },
    include: inclusions,
  });
}

/**
 * Appliquer un statut de passerelle a une facture.
 *
 * **Point unique.** Le rappel et la relecture de statut arrivent tous deux
 * ici : deux chemins qui decideraient separement finiraient par diverger, et
 * c'est de l'argent.
 *
 * **Un paiement acquis ne redescend jamais.** La documentation de ChapChap
 * donne l'exemple d'un `canceled` suivi d'un `success` ; l'inverse est tout
 * aussi possible si un rappel tardif arrive apres coup. `success` est
 * definitif.
 */
export async function appliquerStatutPasserelle(
  idFacture: string,
  statut: string,
  details?: { referenceTransaction?: string | null; moyenPaiement?: string | null },
): Promise<{ changee: boolean; dejaPayee: boolean }> {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    select: { id: true, statut: true, statutOperateur: true },
  });
  if (!facture) throw new NotFoundError('Facture non trouvee');

  if (facture.statut === 'PAYEE') {
    // Rien a faire, et surtout rien a defaire : c'est le cas normal d'un
    // rappel rejoue ou d'une relecture apres coup.
    return { changee: false, dejaPayee: true };
  }

  if (!chapchap.estPaye(statut)) {
    // On garde la trace de l'echec sans toucher au statut de la facture :
    // elle reste payable, le patient recommence.
    if (facture.statutOperateur === statut) return { changee: false, dejaPayee: false };
    await prisma.facture.update({ where: { id: idFacture }, data: { statutOperateur: statut } });
    return { changee: true, dejaPayee: false };
  }

  await prisma.facture.update({
    where: { id: idFacture },
    data: {
      statut: 'PAYEE',
      statutOperateur: statut,
      payeeLe: new Date(),
      ...(details?.referenceTransaction ? { referenceOperateur: details.referenceTransaction } : {}),
    },
  });
  logger.info('[PAIEMENT] facture payee par la passerelle', { idFacture, statut });
  return { changee: true, dejaPayee: false };
}

export async function verifierStatutPaiement(userId: string, idFacture: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: { prenom: true, nom: true },
          },
        },
      },
      consultation: true,
    },
  });

  if (!facture) throw new NotFoundError('Facture non trouvee');
  if (facture.patient.idUtilisateur !== userId) throw new ForbiddenError('Acces refuse');

  // **La relecture tranche, le rappel accelere.** Un webhook peut ne jamais
  // arriver : URL injoignable, serveur redemarre, ou simplement developpement
  // en local ou aucune adresse publique n'existe. Interroger la passerelle
  // quand l'issue n'est pas encore connue ferme ce trou — sans quoi un patient
  // qui a paye resterait debiteur.
  if (facture.statut !== 'PAYEE' && facture.referenceOperateur && chapchap.chapchapEstConfigure()) {
    try {
      const operation = await chapchap.lireOperation(facture.referenceOperateur);
      if (operation.statut && operation.statut !== facture.statutOperateur) {
        await appliquerStatutPasserelle(facture.id, operation.statut, {
          referenceTransaction: operation.referenceTransaction,
          moyenPaiement: operation.moyenPaiement,
        });
        return prisma.facture.findUniqueOrThrow({
          where: { id: idFacture },
          include: {
            patient: { include: { utilisateur: { select: { prenom: true, nom: true } } } },
            consultation: true,
          },
        });
      }
    } catch (e) {
      // Une passerelle injoignable ne doit pas empecher de lire sa facture :
      // on rend ce qu'on sait, et l'ecran le dira.
      logger.warn('[PAIEMENT] relecture du statut impossible', {
        idFacture, erreur: (e as Error).message,
      });
    }
  }

  return facture;
}

export async function confirmerPaiement(user: JwtPayload, idFacture: string, dto: ConfirmerPaiementDto) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: {
      consultation: {
        include: { asc: { select: { idStructure: true } } },
      },
    },
  });

  if (!facture) throw new NotFoundError('Facture non trouvee');
  if (facture.statut === 'PAYEE') throw new ValidationError('Cette facture a deja ete payee');

  if (!ADMIN_ROLES.has(user.role)) {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.userId },
      select: { idStructure: true },
    });
    const consultationStructure = facture.consultation?.asc?.idStructure;
    if (!utilisateur?.idStructure || utilisateur.idStructure !== consultationStructure) {
      throw new ForbiddenError('Vous ne pouvez confirmer que les paiements de votre structure');
    }
  }

  return prisma.facture.update({
    where: { id: idFacture },
    data: {
      statut: 'PAYEE',
      referenceOperateur: dto.referenceOperateur,
      payeeLe: new Date(),
    },
    include: {
      patient: {
        include: {
          utilisateur: {
            select: { prenom: true, nom: true, telephone: true },
          },
        },
      },
    },
  });
}

export async function getHistoriquePaiements(userId: string, filters: PaiementFilters) {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
  });

  if (!patient) throw new NotFoundError('Profil patient non trouve');

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    idPatient: patient.id,
    ...(filters.statut && { statut: filters.statut }),
    ...(filters.modePaiement && { modePaiement: filters.modePaiement }),
  };

  const [factures, total] = await Promise.all([
    prisma.facture.findMany({
      where,
      skip,
      take: limit,
      include: {
        consultation: {
          select: {
            motifPrincipal: true,
            consulteeLE: true,
          },
        },
      },
      orderBy: { creeLe: 'desc' },
    }),
    prisma.facture.count({ where }),
  ]);

  return {
    data: factures,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function annulerPaiement(userId: string, idFacture: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    include: { patient: true },
  });

  if (!facture) throw new NotFoundError('Facture non trouvee');
  if (facture.patient.idUtilisateur !== userId) throw new ForbiddenError('Acces refuse');
  if (facture.statut === 'PAYEE') throw new ValidationError("Impossible d'annuler une facture deja payee");

  return prisma.facture.update({
    where: { id: idFacture },
    data: { statut: 'ANNULEE' },
  });
}
