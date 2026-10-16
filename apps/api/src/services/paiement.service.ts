import { prisma } from '../config/prisma';
import {
  ConfirmerPaiementDto,
  InitierPaiementDto,
  PayerCommandeDto,
  PaiementFilters,
} from '../types/paiement.types';
import * as chapchap from './chapchap.service';
import { initierPaiementSimule } from './payment-provider.service';
import { getValeursParametres } from './parametres.service';
import { JwtPayload } from '../types/auth.types';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { logger } from '../config/logger';
import type { ADeReglerView, FactureView } from '@baobaoheath/shared-types';
import { avancerApresPaiement } from './commande.service';

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
/**
 * Payer le panier d'une commande de pharmacie.
 *
 * **Le montant vient de la base, jamais du client.** Il a ete fige au
 * chiffrage par l'officine ; un montant propose par le navigateur est un
 * montant qu'on peut baisser.
 *
 * Tout le reste est le circuit existant : une `Facture` portee par la
 * commande, une operation ChapChap prefixee `FAC-`, et
 * `appliquerStatutPasserelle` comme point unique de decision. Ouvrir un
 * second circuit de paiement a cote de celui qui marche aurait double les
 * endroits ou de l'argent peut se perdre.
 */
export async function initierPaiementCommande(
  userId: string,
  idCommande: string,
  dto: PayerCommandeDto,
) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: {
      id: true, statut: true, montantTotalGnf: true, numero: true,
      facture: { select: { id: true, statut: true } },
      ordonnance: {
        select: {
          numero: true,
          consultation: { select: { patient: { select: { id: true, idUtilisateur: true } } } },
        },
      },
    },
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');

  const patient = commande.ordonnance.consultation.patient;
  if (patient.idUtilisateur !== userId) {
    throw new ForbiddenError("Acces refuse - ce n'est pas votre commande");
  }
  if (commande.facture?.statut === 'PAYEE') {
    throw new ValidationError('Cette commande a deja ete payee');
  }
  if (commande.statut !== 'A_PAYER' || commande.montantTotalGnf == null) {
    throw new ValidationError(
      "Cette commande n'est pas encore chiffree : la pharmacie doit d'abord en fixer le montant.",
    );
  }

  await assertModePaiementActif(dto.modePaiement);
  const montantGnf = commande.montantTotalGnf;

  const inclusions = {
    patient: { include: { utilisateur: { select: { prenom: true, nom: true, telephone: true } } } },
    consultation: true,
  };

  const facture = commande.facture
    ? await prisma.facture.update({
        where: { id: commande.facture.id },
        data: { montantGnf, modePaiement: dto.modePaiement, numeroOperateur: dto.numeroOperateur },
        include: inclusions,
      })
    : await prisma.facture.create({
        data: {
          idPatient: patient.id,
          idCommande: commande.id,
          montantGnf,
          modePaiement: dto.modePaiement,
          numeroOperateur: dto.numeroOperateur,
          statut: 'EN_ATTENTE',
        },
        include: inclusions,
      });

  // Les especes ne passent par aucune passerelle : le pharmacien encaisse au
  // comptoir et confirme la facture.
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
      + `Reglez ce montant en especes a la pharmacie.`,
    );
  }

  const operation = await chapchap.creerOperation({
    montantGnf,
    orderId: `FAC-${facture.id}`,
    description: `Pharmacie — ordonnance ${commande.ordonnance.numero}`,
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
 * Ce qui suit une facture qui vient d'etre payee.
 *
 * **Deux chemins menent a une facture payee**, et c'est ce qui a failli
 * coincer : la passerelle par `appliquerStatutPasserelle`, et le guichet par
 * `confirmerPaiement`, qui ecrivait `PAYEE` directement. La consequence
 * n'etait branchee que sur le premier — une commande reglee en especes serait
 * restee bloquee a « a payer » pour toujours, alors que l'argent etait dans
 * le tiroir. En Guinee les especes sont le moyen dominant : ce n'etait pas un
 * cas de bord.
 *
 * L'appel ne leve pas. Un rappel de passerelle qui echouerait ici serait
 * rejoue indefiniment alors que l'argent, lui, est bien arrive.
 */
async function apresFacturePayee(idFacture: string, idCommande: string | null): Promise<void> {
  if (!idCommande) return;
  try {
    await avancerApresPaiement(idCommande);
  } catch (e) {
    logger.error('[PAIEMENT] commande payee mais non avancee', {
      idFacture, idCommande, erreur: (e as Error).message,
    });
  }
}

export async function appliquerStatutPasserelle(
  idFacture: string,
  statut: string,
  details?: { referenceTransaction?: string | null; moyenPaiement?: string | null },
): Promise<{ changee: boolean; dejaPayee: boolean }> {
  const facture = await prisma.facture.findUnique({
    where: { id: idFacture },
    select: { id: true, statut: true, statutOperateur: true, idCommande: true },
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
  await apresFacturePayee(idFacture, facture.idCommande);
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
      commande: { select: { idPharmacie: true } },
    },
  });

  if (!facture) throw new NotFoundError('Facture non trouvee');
  if (facture.statut === 'PAYEE') throw new ValidationError('Cette facture a deja ete payee');

  if (!ADMIN_ROLES.has(user.role)) {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.userId },
      select: { idStructure: true },
    });
    // **Une facture de commande n'a pas de consultation.** Le controle ne
    // regardait que `consultation.asc.idStructure` : pour une commande il
    // valait `undefined`, donc la comparaison echouait toujours et personne
    // hors administration ne pouvait encaisser au comptoir. C'est la
    // pharmacie qui tient la commande qui le peut.
    const structureAttendue = facture.commande
      ? facture.commande.idPharmacie
      : facture.consultation?.asc?.idStructure;
    if (!structureAttendue || utilisateur?.idStructure !== structureAttendue) {
      throw new ForbiddenError('Vous ne pouvez confirmer que les paiements de votre structure');
    }
  }

  const payee = await prisma.facture.update({
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

  // Le meme endroit que la passerelle : une commande reglee au comptoir
  // avance comme une commande reglee par mobile money.
  await apresFacturePayee(idFacture, facture.idCommande);
  return payee;
}

/**
 * Encaisser au comptoir le panier d'une commande.
 *
 * **Sans ceci, la demonstration s'arretait a « a payer ».** Les especes sont
 * le moyen dominant, et le rappel de la passerelle exige une adresse HTTPS
 * publique qui n'existe pas encore : il fallait un chemin qui ne depende de
 * rien d'autre que du tiroir-caisse.
 *
 * L'officine n'a pas a connaitre l'identifiant de la facture : elle a la
 * commande sous les yeux, et c'est le serveur qui retrouve l'une par l'autre.
 * Le controle de propriete est celui de la commande — c'est la pharmacie qui
 * la tient qui encaisse.
 */
export async function encaisserCommandeAuComptoir(
  user: JwtPayload,
  idCommande: string,
  reference: string,
) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: { id: true, idPharmacie: true, facture: { select: { id: true, statut: true } } },
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.userId },
    select: { idStructure: true },
  });
  if (!commande.idPharmacie || utilisateur?.idStructure !== commande.idPharmacie) {
    throw new ForbiddenError("Cette commande n'est pas la votre");
  }
  if (!commande.facture) {
    throw new ValidationError(
      "Le patient n'a pas encore ouvert son paiement : il n'y a aucune facture a encaisser.",
    );
  }

  return confirmerPaiement(user, commande.facture.id, { referenceOperateur: reference });
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

/**
 * Ce que le patient doit encore.
 *
 * **Les consultations, pas les factures.** Rien ne facture automatiquement :
 * la facture naît quand le paiement s'ouvre. Partir des factures laisserait
 * invisible tout ce qui n'a jamais ete paye — ce qu'on vient justement
 * regarder.
 *
 * Une consultation sans tarif n'est pas due : gratuite, prise en charge, ou
 * simplement pas encore chiffree. On ne reclame pas un montant qu'on ignore.
 */
export async function aRegler(userId: string): Promise<ADeReglerView[]> {
  const patient = await prisma.patientProfile.findUnique({
    where: { idUtilisateur: userId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError('Profil patient non trouve');

  const consultations = await prisma.consultation.findMany({
    where: {
      idPatient: patient.id,
      tarifGnf: { gt: 0 },
      // Une facture acquittee sort de la liste : elle n'est plus due.
      OR: [{ facture: null }, { facture: { statut: { not: 'PAYEE' } } }],
    },
    select: {
      id: true, motifPrincipal: true, consulteeLE: true, tarifGnf: true,
      facture: {
        select: {
          id: true, idConsultation: true, montantGnf: true, statut: true,
          modePaiement: true, numeroOperateur: true, referenceOperateur: true,
          urlPaiement: true, statutOperateur: true, payeeLe: true, creeLe: true,
        },
      },
    },
    orderBy: { creeLe: 'desc' },
  });

  return consultations.map((c) => ({
    idConsultation: c.id,
    motif: c.motifPrincipal,
    consulteeLE: c.consulteeLE,
    montantGnf: c.tarifGnf ?? 0,
    facture: c.facture ? versFactureView({ ...c.facture, consultation: null }) : null,
  }));
}
