// src/services/commande.service.ts
// P6 / EF-07 — appel aux pharmacies du quartier et attribution de la commande.
// Processus complet : docs/PARCOURS-COMMANDE-LIVRAISON.md
//
// Le principe retenu avec le porteur du projet : dès l'ordonnance prête, les
// pharmacies **partenaires du quartier du patient** sont interrogées sur un
// point unique — détenez-vous la totalité des produits ? La première qui
// répond oui prend la commande, et les autres perdent la main.
//
// « La première » impose une attribution atomique : deux pharmacies qui
// répondent à la même seconde ne doivent pas croire toutes deux avoir gagné.
// Le verrou est porté par `Commande.idPharmacie` et pris par un `updateMany`
// conditionnel — celui qui obtient `count === 1` a la commande, les autres
// obtiennent 0 et l'apprennent immédiatement.
import {
  ModeRemise,
  StatutCommande,
  StatutOrdonnance,
  TypeStructure,
} from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { JwtPayload } from '../types/auth.types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/app-error';
import { prochainNumero } from './numero.service';
import { notifierSansBloquer } from './notification.service';

const COMMANDE_INCLUDE = {
  ordonnance: {
    include: {
      lignes: { include: { medicament: true } },
      consultation: {
        include: {
          patient: { include: { utilisateur: { select: { id: true, prenom: true, nom: true } } } },
        },
      },
    },
  },
  pharmacie: { select: { id: true, nom: true, prefecture: true, commune: true, quartier: true } },
  reponses: {
    include: { structure: { select: { id: true, nom: true } } },
    orderBy: { repondueLe: 'asc' },
  },
} as const;

/**
 * Les pharmacies partenaires du quartier du patient.
 *
 * Si le patient n'a pas de quartier renseigné, on ne cherche pas ailleurs :
 * élargir le périmètre est une question ouverte (voir le document de
 * parcours), et deviner reviendrait à solliciter des pharmacies qui n'ont
 * aucune raison d'être concernées.
 */
export async function pharmaciesDuQuartier(quartier: string | null) {
  if (!quartier) return [];
  return prisma.structureSante.findMany({
    where: {
      type: TypeStructure.PHARMACIE,
      estActive: true,
      estPartenaire: true,
      quartier,
    },
    select: { id: true, nom: true },
  });
}

/**
 * Lance la recherche d'une pharmacie pour une ordonnance signée.
 *
 * Une ordonnance non signée n'a pas à circuler : elle n'est pas opposable, et
 * aucune pharmacie ne pourrait la servir.
 */
export async function lancerRecherchePharmacie(idOrdonnance: string) {
  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id: idOrdonnance },
    include: {
      commande: { select: { id: true } },
      lignes: { select: { id: true } },
      consultation: {
        select: {
          patient: {
            select: { quartier: true, utilisateur: { select: { id: true } } },
          },
          idMedecinValideur: true,
        },
      },
    },
  });
  if (!ordonnance) throw new NotFoundError('Ordonnance non trouvee');
  if (ordonnance.commande) throw new ConflictError('Une commande existe deja pour cette ordonnance');
  if (!ordonnance.signeLe) throw new ValidationError('Ordonnance non signee : elle ne peut pas circuler');
  if (ordonnance.lignes.length === 0) {
    throw new ValidationError('Ordonnance sans medicament');
  }

  const quartier = ordonnance.consultation.patient.quartier;
  const pharmacies = await pharmaciesDuQuartier(quartier);

  const commande = await prisma.commande.create({
    data: {
      numero: await prochainNumero('CM'),
      idOrdonnance,
      quartierRecherche: quartier,
      // Aucune pharmacie partenaire dans le quartier : il n'y a personne a
      // interroger. Le resultat est le meme que si nul n'avait repondu — le
      // patient repart avec son ordonnance.
      statut: pharmacies.length === 0 ? StatutCommande.SANS_PHARMACIE : StatutCommande.RECHERCHE_PHARMACIE,
    },
  });

  if (pharmacies.length === 0) {
    await avertirIndisponibilite(commande.id);
    return getCommande(commande.id);
  }

  await Promise.all(
    pharmacies.map((p) =>
      notifierSansBloquer({
        idUtilisateur: p.id,
        type: 'COMMANDE_A_SERVIR',
        titre: 'Nouvelle ordonnance a servir',
        contenu: `Ordonnance ${ordonnance.numero} — disposez-vous de tous les produits ?`,
        lienAction: '/pharmacien/commandes',
        metadonnees: { idCommande: commande.id, numero: commande.numero },
      })
    )
  );

  return getCommande(commande.id);
}

/**
 * Réponse d'une pharmacie à l'appel.
 *
 * Répondre « oui » tente de prendre la commande. La prise est atomique : le
 * `updateMany` ne touche la ligne que si `idPharmacie` est encore nul. Deux
 * pharmacies simultanées donnent donc un gagnant et un perdant, jamais deux
 * gagnants.
 */
export async function repondreDisponibilite(
  user: JwtPayload,
  idCommande: string,
  aTousLesProduits: boolean
) {
  const pharmacie = await pharmacieDuPharmacien(user.userId);

  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: { id: true, statut: true, idPharmacie: true, quartierRecherche: true, numero: true },
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');

  // Une pharmacie d'un autre quartier n'a pas ete sollicitee.
  if (commande.quartierRecherche && pharmacie.quartier !== commande.quartierRecherche) {
    throw new ForbiddenError("Cette commande ne releve pas de votre quartier");
  }
  if (commande.statut === StatutCommande.ANNULEE) {
    throw new ValidationError('Commande annulee');
  }
  if (commande.idPharmacie && commande.idPharmacie !== pharmacie.id) {
    throw new ConflictError('Une autre pharmacie a deja pris cette commande');
  }

  await prisma.reponsePharmacie.upsert({
    where: { idCommande_idStructure: { idCommande, idStructure: pharmacie.id } },
    update: { aTousLesProduits, repondueLe: new Date() },
    create: { idCommande, idStructure: pharmacie.id, aTousLesProduits },
  });

  if (!aTousLesProduits) {
    await verifierEpuisementDesReponses(idCommande);
    return getCommande(idCommande);
  }

  // ── Prise atomique ────────────────────────────────────────────────
  const prise = await prisma.commande.updateMany({
    where: { id: idCommande, idPharmacie: null, statut: StatutCommande.RECHERCHE_PHARMACIE },
    data: {
      idPharmacie: pharmacie.id,
      statut: StatutCommande.PRISE_EN_CHARGE,
      priseEnChargeLe: new Date(),
    },
  });
  if (prise.count === 0) {
    throw new ConflictError('Une autre pharmacie a ete plus rapide');
  }

  await notifierPriseEnCharge(idCommande, pharmacie.nom);
  return getCommande(idCommande);
}

/**
 * Une pharmacie se rétracte après avoir pris la commande : elle n'avait pas
 * tout, finalement. Le verrou se rouvre et les autres retrouvent la main.
 */
export async function retirerPriseEnCharge(user: JwtPayload, idCommande: string, motif: string) {
  const pharmacie = await pharmacieDuPharmacien(user.userId);

  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: { id: true, idPharmacie: true, statut: true },
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');
  if (commande.idPharmacie !== pharmacie.id) {
    throw new ForbiddenError("Cette commande n'est pas la votre");
  }
  if (commande.statut !== StatutCommande.PRISE_EN_CHARGE) {
    throw new ValidationError('Cette commande ne peut plus etre rendue');
  }

  await prisma.$transaction([
    prisma.reponsePharmacie.update({
      where: { idCommande_idStructure: { idCommande, idStructure: pharmacie.id } },
      data: { aTousLesProduits: false, retracteeLe: new Date() },
    }),
    prisma.commande.update({
      where: { id: idCommande },
      data: {
        idPharmacie: null,
        priseEnChargeLe: null,
        statut: StatutCommande.RECHERCHE_PHARMACIE,
      },
    }),
  ]);

  await journaliserRetractation(idCommande, pharmacie.nom, motif);
  await verifierEpuisementDesReponses(idCommande);
  return getCommande(idCommande);
}

/** Le patient choisit comment il récupère ses produits. */
export async function choisirModeRemise(user: JwtPayload, idCommande: string, mode: ModeRemise) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    include: { ordonnance: { select: { consultation: { select: { patient: { select: { idUtilisateur: true } } } } } } },
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');
  if (commande.ordonnance.consultation.patient.idUtilisateur !== user.userId) {
    throw new ForbiddenError('Cette commande ne vous appartient pas');
  }
  if (commande.statut !== StatutCommande.PRISE_EN_CHARGE) {
    throw new ValidationError('Aucune pharmacie n a encore pris cette commande');
  }

  await prisma.commande.update({ where: { id: idCommande }, data: { modeRemise: mode } });
  return getCommande(idCommande);
}

export async function getCommande(idCommande: string) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    include: COMMANDE_INCLUDE,
  });
  if (!commande) throw new NotFoundError('Commande non trouvee');
  return commande;
}

/** La file du comptoir : ce que cette pharmacie doit traiter ou a pris. */
export async function commandesDeLaPharmacie(user: JwtPayload) {
  const pharmacie = await pharmacieDuPharmacien(user.userId);
  return prisma.commande.findMany({
    where: {
      OR: [
        // Les appels en cours de son quartier, qu'elle n'a pas encore refuses.
        {
          statut: StatutCommande.RECHERCHE_PHARMACIE,
          quartierRecherche: pharmacie.quartier,
          reponses: { none: { idStructure: pharmacie.id, aTousLesProduits: false } },
        },
        // Et celles qu'elle a prises.
        { idPharmacie: pharmacie.id },
      ],
    },
    include: COMMANDE_INCLUDE,
    orderBy: { creeLe: 'desc' },
    take: 50,
  });
}

// ── Interne ─────────────────────────────────────────────────────────

async function pharmacieDuPharmacien(userId: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    include: { structure: true },
  });
  if (!utilisateur?.structure) throw new ForbiddenError('Compte sans structure assignee');
  if (utilisateur.structure.type !== TypeStructure.PHARMACIE) {
    throw new ValidationError("La structure assignee n est pas une pharmacie");
  }
  if (!utilisateur.structure.estPartenaire) {
    throw new ForbiddenError('Votre pharmacie n est pas partenaire de la plateforme');
  }
  return utilisateur.structure;
}

/**
 * Toutes les pharmacies sollicitées ont répondu « non » : il n'y a plus rien à
 * attendre. Le patient et le médecin sont avertis, et le patient reprend son
 * ordonnance.
 */
async function verifierEpuisementDesReponses(idCommande: string) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: { quartierRecherche: true, statut: true, reponses: { select: { aTousLesProduits: true } } },
  });
  if (!commande || commande.statut !== StatutCommande.RECHERCHE_PHARMACIE) return;

  const sollicitees = await pharmaciesDuQuartier(commande.quartierRecherche);
  const refus = commande.reponses.filter((r) => !r.aTousLesProduits).length;
  if (sollicitees.length === 0 || refus < sollicitees.length) return;

  await prisma.commande.update({
    where: { id: idCommande },
    data: { statut: StatutCommande.SANS_PHARMACIE },
  });
  await avertirIndisponibilite(idCommande);
}

/** Patient et médecin avertis : aucune pharmacie n'a la totalité. */
async function avertirIndisponibilite(idCommande: string) {
  const destinataires = await destinatairesDeLaCommande(idCommande);
  if (!destinataires) return;

  for (const idUtilisateur of destinataires.utilisateurs) {
    await notifierSansBloquer({
      idUtilisateur,
      type: 'COMMANDE_SANS_PHARMACIE',
      titre: 'Aucune pharmacie ne dispose de tous les produits',
      contenu:
        `Ordonnance ${destinataires.numeroOrdonnance} : aucune pharmacie partenaire du quartier ` +
        `ne detient la totalite. L'ordonnance reste valable et peut etre presentee ailleurs.`,
      lienAction: '/patient/ordonnances',
      metadonnees: { idCommande },
    });
  }
}

async function notifierPriseEnCharge(idCommande: string, nomPharmacie: string) {
  const destinataires = await destinatairesDeLaCommande(idCommande);
  if (!destinataires) return;

  for (const idUtilisateur of destinataires.utilisateurs) {
    await notifierSansBloquer({
      idUtilisateur,
      type: 'COMMANDE_PRISE_EN_CHARGE',
      titre: 'Votre commande est prise en charge',
      contenu: `${nomPharmacie} dispose de tous les produits de l'ordonnance ${destinataires.numeroOrdonnance}.`,
      lienAction: '/patient/ordonnances',
      metadonnees: { idCommande },
    });
  }
}

/**
 * Le patient **et** le médecin prescripteur : le cahier des charges veut que
 * le prescripteur sache ce qu'il advient de son ordonnance.
 */
async function destinatairesDeLaCommande(idCommande: string) {
  const commande = await prisma.commande.findUnique({
    where: { id: idCommande },
    select: {
      ordonnance: {
        select: {
          numero: true,
          signePar: true,
          consultation: {
            select: {
              idMedecinValideur: true,
              patient: { select: { idUtilisateur: true } },
            },
          },
        },
      },
    },
  });
  if (!commande) return null;

  const o = commande.ordonnance;
  const utilisateurs = [
    o.consultation.patient.idUtilisateur,
    o.signePar ?? o.consultation.idMedecinValideur,
  ].filter((v): v is string => Boolean(v));

  return { utilisateurs: [...new Set(utilisateurs)], numeroOrdonnance: o.numero };
}

async function journaliserRetractation(idCommande: string, nomPharmacie: string, motif: string) {
  const destinataires = await destinatairesDeLaCommande(idCommande);
  if (!destinataires) return;

  for (const idUtilisateur of destinataires.utilisateurs) {
    await notifierSansBloquer({
      idUtilisateur,
      type: 'COMMANDE_A_SERVIR',
      titre: 'La pharmacie a rendu la commande',
      contenu: `${nomPharmacie} ne peut finalement pas servir l'ordonnance ${destinataires.numeroOrdonnance} : ${motif}`,
      lienAction: '/patient/ordonnances',
      metadonnees: { idCommande },
    });
  }
}

/** Réexporté pour les écrans : le statut d'une ordonnance côté commande. */
export async function commandeDeLOrdonnance(idOrdonnance: string) {
  return prisma.commande.findUnique({
    where: { idOrdonnance },
    include: COMMANDE_INCLUDE,
  });
}

export { StatutCommande, ModeRemise, StatutOrdonnance };
