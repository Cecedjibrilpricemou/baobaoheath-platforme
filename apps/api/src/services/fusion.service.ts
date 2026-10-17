import { prisma } from '../config/prisma';
import { Prisma } from '../config/generated/client/client';
import type { FusionView, LigneFusionView, MotifRefusFusion } from '@baobaoheath/shared-types';

/**
 * Fusion de deux dossiers patients (EF-01-06).
 *
 * **L'operation la plus dangereuse du produit.** Fusionner deux personnes
 * distinctes melange leurs dossiers medicaux : l'allergie de l'une devient
 * celle de l'autre, et personne ne s'en apercoit avant une prescription. Rien
 * n'est donc automatique — la detection (EF-01-05) propose, un agent decide,
 * et tout est reversible.
 *
 * ## Ce qui bouge, et ce qui ne bouge pas
 *
 * **Le journal d'audit ne bouge pas.** Un acces au dossier absorbe etait un
 * acces au dossier absorbe ; le reattribuer au survivant ferait dire au
 * journal que quelqu'un a ouvert un dossier qu'il n'a jamais ouvert. C'est
 * une falsification, et les declencheurs PostgreSQL de EF-12-04 la refusent
 * de toute facon. Les lectures du journal patient suivent donc le lien de
 * fusion au lieu de deplacer les lignes.
 *
 * **Le dossier absorbe n'est jamais supprime.** Il garde son identifiant, son
 * code QR et son compte : une personne qui presente son ancienne carte doit
 * etre retrouvee.
 *
 * ## La reversibilite n'est pas une promesse, c'est une liste
 *
 * Chaque ligne deplacee est enregistree. Annuler, c'est remettre exactement
 * ce qui a ete bouge — et rien d'autre : ce qui a ete ajoute au dossier
 * survivant apres la fusion lui reste.
 */

/**
 * Les tables dont les lignes suivent le patient.
 *
 * **Cette liste est volontairement explicite.** La deduire des relations
 * Prisma ferait entrer un jour une table qu'on n'a pas examinee — et la
 * premiere candidate serait le journal d'audit, qu'il ne faut surtout pas
 * deplacer.
 */
const TABLES_A_DEPLACER = [
  'consultations',
  'vaccinations',
  'demandes_rendez_vous',
  'rendez_vous',
  'factures',
  'episodes_soins',
  'demandes_analyse',
  'ventes_comptoir',
  'contrats_assurance',
  'controles_eligibilite',
  'demandes_rgpd',
] as const;

export type TableDeplacable = (typeof TABLES_A_DEPLACER)[number];

/** Le nombre minimal de caracteres d'un motif, comme pour une suspension. */
export const MOTIF_MIN = 10;

type DossierPourFusion = {
  id: string;
  niveauIdentite: string;
  numeroPiece: string | null;
  idFusionneDans: string | null;
};

/**
 * Pourquoi cette fusion ne peut pas etre faite, ou `null` si elle le peut.
 *
 * Fonction pure, exportee et testee a part : c'est elle qui tient les refus,
 * et un refus manquant se traduit par deux dossiers medicaux melanges.
 */
export function motifDeRefus(
  principal: DossierPourFusion | null,
  absorbe: DossierPourFusion | null,
  motif: string
): MotifRefusFusion | null {
  if (!principal || !absorbe) return 'DOSSIER_INTROUVABLE';
  if (principal.id === absorbe.id) return 'MEME_DOSSIER';
  if (motif.trim().length < MOTIF_MIN) return 'MOTIF_TROP_COURT';

  // Pas de chaine : la base le refuse aussi, mais un message clair vaut mieux
  // qu'une erreur de declencheur remontee a l'agent.
  if (principal.idFusionneDans || absorbe.idFusionneDans) return 'DEJA_FUSIONNE';

  // **Deux pieces d'identite differentes, toutes deux verifiees.** Un agent a
  // vu une piece pour chacun, et elles ne portent pas le meme numero. Une
  // machine ne peut pas dire laquelle est la bonne : ou bien ce sont deux
  // personnes, ou bien l'une des deux verifications est fausse. Dans les deux
  // cas, c'est un humain qui doit trancher, piece en main.
  const deuxVerifiees =
    principal.niveauIdentite === 'VERIFIEE' && absorbe.niveauIdentite === 'VERIFIEE';
  if (deuxVerifiees && principal.numeroPiece !== absorbe.numeroPiece) {
    return 'DEUX_PIECES_DIFFERENTES';
  }

  return null;
}

/**
 * Ce que deviennent deux consentements qui portent sur le meme usage.
 *
 * **Le plus restrictif l'emporte, quelle que soit sa date.** La contrainte
 * `@@unique([idPatient, scope])` interdit de garder les deux, et il faut donc
 * choisir. Elargir un acces sans que le patient l'ait dit montrerait des
 * donnees qui ne devaient pas l'etre, et cela ne se rattrape pas ; un
 * consentement retire a tort se redonne en une phrase.
 *
 * L'asymetrie est voulue, et elle est dite a l'agent : la fusion rapporte les
 * usages qu'elle a restreints, pour qu'il puisse redemander au patient.
 */
export function consentementApresFusion(
  duPrincipal: { actif: boolean },
  deLAbsorbe: { actif: boolean }
): { actif: boolean; restreint: boolean } {
  const actif = duPrincipal.actif && deLAbsorbe.actif;
  return { actif, restreint: actif !== duPrincipal.actif };
}

const SELECTION = {
  id: true,
  niveauIdentite: true,
  numeroPiece: true,
  idFusionneDans: true,
} satisfies Prisma.PatientProfileSelect;

/**
 * Fusionner `idAbsorbe` dans `idPrincipal`.
 *
 * Tout se fait dans une transaction : une fusion a moitie faite laisserait un
 * dossier medical coupe en deux, ce qui est precisement ce qu'on repare.
 */
export async function fusionner(
  auteur: { userId: string },
  idPrincipal: string,
  idAbsorbe: string,
  motif: string
): Promise<{ fusion: FusionView } | { refus: MotifRefusFusion }> {
  const [principal, absorbe] = await Promise.all([
    prisma.patientProfile.findUnique({ where: { id: idPrincipal }, select: SELECTION }),
    prisma.patientProfile.findUnique({ where: { id: idAbsorbe }, select: SELECTION }),
  ]);

  const refus = motifDeRefus(
    principal as DossierPourFusion | null,
    absorbe as DossierPourFusion | null,
    motif
  );
  if (refus) return { refus };

  const fusion = await prisma.$transaction(async (tx) => {
    const f = await tx.fusionDossier.create({
      data: {
        motif: motif.trim(),
        idPrincipal,
        idAbsorbe,
        idFusionnePar: auteur.userId,
      },
      select: { id: true },
    });

    const lignes: Prisma.LigneFusionCreateManyInput[] = [];

    // ── Les lignes qui suivent le patient ────────────────────────────
    for (const table of TABLES_A_DEPLACER) {
      const ids = await tx.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "${table}" WHERE "idPatient" = $1`,
        idAbsorbe
      );
      if (ids.length === 0) continue;
      await tx.$executeRawUnsafe(
        `UPDATE "${table}" SET "idPatient" = $1 WHERE "idPatient" = $2`,
        idPrincipal,
        idAbsorbe
      );
      for (const { id } of ids) {
        lignes.push({ idFusion: f.id, tableCible: table, idLigne: id, operation: 'DEPLACEMENT' });
      }
    }

    // ── Les consentements, un par un ─────────────────────────────────
    //
    // Ils ne peuvent pas etre deplaces en bloc : `@@unique([idPatient, scope])`
    // refuserait des que les deux dossiers portent le meme usage.
    const [ceuxDuPrincipal, ceuxDeLAbsorbe] = await Promise.all([
      tx.consentementPatient.findMany({
        where: { idPatient: idPrincipal },
        select: { id: true, scope: true, actif: true, retireLe: true },
      }),
      tx.consentementPatient.findMany({
        where: { idPatient: idAbsorbe },
        select: { id: true, scope: true, actif: true },
      }),
    ]);
    const parScope = new Map(ceuxDuPrincipal.map((c) => [c.scope, c]));

    for (const venant of ceuxDeLAbsorbe) {
      const existant = parScope.get(venant.scope);

      if (!existant) {
        // Le survivant n'a rien dit sur cet usage : la ligne le rejoint.
        await tx.consentementPatient.update({
          where: { id: venant.id },
          data: { idPatient: idPrincipal },
        });
        lignes.push({
          idFusion: f.id, tableCible: 'consentements_patient',
          idLigne: venant.id, operation: 'DEPLACEMENT',
        });
        continue;
      }

      const { actif, restreint } = consentementApresFusion(existant, venant);
      if (!restreint) continue;

      await tx.consentementPatient.update({
        where: { id: existant.id },
        data: { actif, retireLe: new Date() },
      });
      lignes.push({
        idFusion: f.id,
        tableCible: 'consentements_patient',
        idLigne: existant.id,
        operation: 'RESTRICTION_CONSENTEMENT',
        // De quoi remettre la ligne exactement telle qu'elle etait.
        valeurAvant: { actif: existant.actif, retireLe: existant.retireLe?.toISOString() ?? null },
      });
    }

    if (lignes.length > 0) await tx.ligneFusion.createMany({ data: lignes });

    await tx.patientProfile.update({
      where: { id: idAbsorbe },
      data: { idFusionneDans: idPrincipal, fusionneLe: new Date() },
    });

    return f.id;
  });

  return { fusion: await detail(fusion) };
}

/**
 * Defaire une fusion.
 *
 * On ne devine rien : on relit la liste de ce qui a ete deplace et on le rend.
 * Ce qui a ete ajoute au dossier survivant depuis la fusion n'y figure pas, et
 * lui reste donc — c'est le comportement voulu.
 */
export async function annuler(
  auteur: { userId: string },
  idFusion: string,
  motifAnnulation: string
): Promise<{ fusion: FusionView } | { refus: MotifRefusFusion }> {
  const f = await prisma.fusionDossier.findUnique({
    where: { id: idFusion },
    select: {
      id: true, statut: true, idPrincipal: true, idAbsorbe: true,
      lignes: { select: { tableCible: true, idLigne: true, operation: true, valeurAvant: true } },
    },
  });
  if (!f) return { refus: 'FUSION_INTROUVABLE' };
  if (f.statut === 'ANNULEE') return { refus: 'DEJA_ANNULEE' };
  if (motifAnnulation.trim().length < MOTIF_MIN) return { refus: 'MOTIF_TROP_COURT' };

  await prisma.$transaction(async (tx) => {
    for (const l of f.lignes) {
      if (l.operation === 'DEPLACEMENT') {
        await tx.$executeRawUnsafe(
          `UPDATE "${l.tableCible}" SET "idPatient" = $1 WHERE "id" = $2`,
          f.idAbsorbe,
          l.idLigne
        );
        continue;
      }

      // Une restriction de consentement : on remet la ligne telle qu'elle
      // etait, pas telle qu'on suppose qu'elle devrait etre.
      const avant = l.valeurAvant as { actif: boolean; retireLe: string | null } | null;
      if (!avant) continue;
      await tx.consentementPatient.update({
        where: { id: l.idLigne },
        data: { actif: avant.actif, retireLe: avant.retireLe ? new Date(avant.retireLe) : null },
      });
    }

    await tx.patientProfile.update({
      where: { id: f.idAbsorbe },
      data: { idFusionneDans: null, fusionneLe: null },
    });

    await tx.fusionDossier.update({
      where: { id: f.id },
      data: {
        statut: 'ANNULEE',
        annuleeLe: new Date(),
        motifAnnulation: motifAnnulation.trim(),
        idAnnuleePar: auteur.userId,
      },
    });
  });

  return { fusion: await detail(idFusion) };
}

const SELECTION_VUE = {
  id: true, motif: true, statut: true, fusionneLe: true,
  motifAnnulation: true, annuleeLe: true,
  principal: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
  absorbe: { select: { id: true, utilisateur: { select: { prenom: true, nom: true } } } },
  fusionnePar: { select: { prenom: true, nom: true } },
  annuleePar: { select: { prenom: true, nom: true } },
  lignes: { select: { tableCible: true, operation: true } },
} satisfies Prisma.FusionDossierSelect;

function vue(f: Prisma.FusionDossierGetPayload<{ select: typeof SELECTION_VUE }>): FusionView {
  // Ce que l'agent lit : combien de lignes ont bouge, et dans quelles tables.
  const parTable = new Map<string, LigneFusionView>();
  for (const l of f.lignes) {
    const cle = `${l.tableCible}|${l.operation}`;
    const deja = parTable.get(cle);
    if (deja) deja.nombre += 1;
    else parTable.set(cle, { tableCible: l.tableCible, operation: l.operation, nombre: 1 });
  }

  return {
    id: f.id,
    motif: f.motif,
    statut: f.statut,
    fusionneLe: f.fusionneLe.toISOString(),
    fusionnePar: `${f.fusionnePar.prenom} ${f.fusionnePar.nom}`,
    motifAnnulation: f.motifAnnulation,
    annuleeLe: f.annuleeLe?.toISOString() ?? null,
    annuleePar: f.annuleePar ? `${f.annuleePar.prenom} ${f.annuleePar.nom}` : null,
    principal: {
      id: f.principal.id,
      nomComplet: `${f.principal.utilisateur.prenom} ${f.principal.utilisateur.nom}`,
    },
    absorbe: {
      id: f.absorbe.id,
      nomComplet: `${f.absorbe.utilisateur.prenom} ${f.absorbe.utilisateur.nom}`,
    },
    lignes: [...parTable.values()].sort((a, b) => b.nombre - a.nombre),
  };
}

async function detail(idFusion: string): Promise<FusionView> {
  const f = await prisma.fusionDossier.findUniqueOrThrow({
    where: { id: idFusion },
    select: SELECTION_VUE,
  });
  return vue(f);
}

/** L'historique des fusions d'un dossier, annulations comprises. */
export async function pourPatient(idPatient: string): Promise<FusionView[]> {
  const fs = await prisma.fusionDossier.findMany({
    where: { OR: [{ idPrincipal: idPatient }, { idAbsorbe: idPatient }] },
    select: SELECTION_VUE,
    orderBy: { fusionneLe: 'desc' },
  });
  return fs.map(vue);
}

/**
 * Le dossier qui porte reellement l'histoire, en suivant le lien de fusion.
 *
 * **C'est ce qui fait qu'une ancienne carte continue de fonctionner.** Une
 * personne dont le dossier a ete absorbe presente son code QR : on doit
 * l'amener au dossier survivant, pas a un dossier vide.
 *
 * Il n'y a jamais de chaine — un declencheur PostgreSQL l'interdit — donc un
 * seul saut suffit, et c'est verifie par un test.
 */
export async function resoudre(idPatient: string): Promise<string> {
  const p = await prisma.patientProfile.findUnique({
    where: { id: idPatient },
    select: { idFusionneDans: true },
  });
  return p?.idFusionneDans ?? idPatient;
}
