import { ConsentScope, Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import type {
  ConsentementView, EvenementConsentementView, TexteConsentementView,
} from '@baobaoheath/shared-types';

/**
 * Consentement versionne (EF-02-01/03/07).
 *
 * ## Ce que ce service repare
 *
 * Avant lui, un consentement etait **un seul etat, mute sur place**. Trois
 * choses manquaient, et chacune compte :
 *
 *   - **ce que la personne avait sous les yeux.** Un consentement ne vaut que
 *     pour ce qui a ete explique. Sans garder le texte exact, on ne peut ni
 *     prouver ce qui a ete accepte, ni le remontrer a l'interesse ;
 *   - **l'histoire.** Un retrait ecrasait l'accord : on voyait le refus
 *     d'aujourd'hui, jamais l'accord d'hier ni le nombre de changements d'avis ;
 *   - **la difference entre un accord et une case cochee a sa place.** Dans la
 *     base du 2026-10-04, deux des quatre consentements avaient ete poses par
 *     le systeme a la creation du dossier, sans que personne ne voie rien.
 *
 * ## La langue fait partie du texte
 *
 * Un texte en francais montre a quelqu'un qui lit le pular n'est pas un
 * consentement eclaire. On enregistre donc **la langue reellement presentee**,
 * meme quand ce n'est pas celle du patient : la trace dit alors la verite, et
 * le manque de traduction se voit au lieu de se cacher.
 */

/** La langue de repli quand la portee n'est pas traduite. */
export const LANGUE_DE_REPLI = 'fr';

type TexteBrut = {
  id: string;
  scope: ConsentScope;
  langue: string;
  version: number;
  titre: string;
  corps: string;
  publieLe: Date | null;
};

const CHAMPS_TEXTE = {
  id: true, scope: true, langue: true, version: true,
  titre: true, corps: true, publieLe: true,
} satisfies Prisma.TexteConsentementSelect;

/**
 * Le texte en vigueur pour une portee et une langue.
 *
 * **La version en vigueur est la plus recemment publiee**, et non la plus
 * grande : un numero de version se saisit, une date de publication
 * s'enregistre. Si les deux divergeaient, c'est la date qui dit ce qui a ete
 * reellement mis a l'ecran.
 *
 * Rend aussi la langue effectivement trouvee, qui peut ne pas etre celle
 * demandee — l'appelant doit pouvoir le dire au patient.
 */
export async function texteEnVigueur(
  scope: ConsentScope,
  langue: string
): Promise<{ texte: TexteBrut; langueDemandee: string } | null> {
  const dansLaLangue = await prisma.texteConsentement.findFirst({
    where: { scope, langue, publieLe: { not: null } },
    orderBy: { publieLe: 'desc' },
    select: CHAMPS_TEXTE,
  });
  if (dansLaLangue) return { texte: dansLaLangue, langueDemandee: langue };

  if (langue === LANGUE_DE_REPLI) return null;

  const repli = await prisma.texteConsentement.findFirst({
    where: { scope, langue: LANGUE_DE_REPLI, publieLe: { not: null } },
    orderBy: { publieLe: 'desc' },
    select: CHAMPS_TEXTE,
  });
  return repli ? { texte: repli, langueDemandee: langue } : null;
}

export function vueTexte(t: TexteBrut, langueDemandee: string): TexteConsentementView {
  return {
    id: t.id,
    scope: t.scope,
    langue: t.langue,
    version: t.version,
    titre: t.titre,
    corps: t.corps,
    publieLe: t.publieLe?.toISOString() ?? null,
    // **Dit quand le patient ne lit pas le texte dans sa langue.** Le taire
    // ferait passer pour eclaire un consentement qui ne l'est pas.
    dansUneAutreLangue: t.langue !== langueDemandee,
  };
}

/**
 * Publier une nouvelle version d'un texte.
 *
 * La version est calculee, pas donnee : deux administrateurs qui publient en
 * meme temps ne doivent pas se marcher dessus, et l'unicite
 * `(scope, langue, version)` les departage.
 */
export async function publier(
  auteur: { userId: string },
  dto: { scope: ConsentScope; langue: string; titre: string; corps: string }
): Promise<TexteConsentementView> {
  const derniere = await prisma.texteConsentement.findFirst({
    where: { scope: dto.scope, langue: dto.langue },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const t = await prisma.texteConsentement.create({
    data: {
      scope: dto.scope,
      langue: dto.langue,
      version: (derniere?.version ?? 0) + 1,
      titre: dto.titre.trim(),
      corps: dto.corps.trim(),
      publieLe: new Date(),
      idPubliePar: auteur.userId,
    },
    select: CHAMPS_TEXTE,
  });
  return vueTexte(t, dto.langue);
}

/** Les textes d'une portee, versions anciennes comprises. */
export async function versions(scope?: ConsentScope): Promise<TexteConsentementView[]> {
  const ts = await prisma.texteConsentement.findMany({
    where: scope ? { scope } : {},
    orderBy: [{ scope: 'asc' }, { langue: 'asc' }, { version: 'desc' }],
    select: CHAMPS_TEXTE,
  });
  return ts.map((t) => vueTexte(t, t.langue));
}

/**
 * Faut-il redemander son accord au patient ?
 *
 * Fonction pure, exportee : c'est elle qui decide ce que l'ecran affiche, et
 * elle porte une decision qui n'est pas evidente.
 *
 * **Un texte plus recent ne revoque pas l'accord donne.** Revoquer d'office
 * couperait l'acces au dossier de soins de tous les patients le jour ou un
 * administrateur corrige une faute d'orthographe — et un acces coupe, en
 * soins, ce n'est pas un desagrement. On demande donc un renouvellement, on ne
 * l'impose pas. La limite est assumee et dite a l'ecran : tant que le patient
 * n'a pas repondu, c'est l'ancienne version qui fait foi.
 */
export function etatDuTexte(
  versionAccordee: number | null,
  versionEnVigueur: number | null
): 'A_JOUR' | 'TEXTE_PLUS_RECENT' | 'JAMAIS_RECUEILLI' {
  if (versionAccordee === null) return 'JAMAIS_RECUEILLI';
  if (versionEnVigueur !== null && versionEnVigueur > versionAccordee) return 'TEXTE_PLUS_RECENT';
  return 'A_JOUR';
}

const CHAMPS_CONSENTEMENT = {
  scope: true, actif: true, donneLe: true, retireLe: true, source: true, commentaire: true,
  texte: { select: CHAMPS_TEXTE },
} satisfies Prisma.ConsentementPatientSelect;

/**
 * Les consentements d'un patient, avec le texte qu'il avait sous les yeux.
 *
 * Toutes les portees sont rendues, meme celles sur lesquelles il ne s'est
 * jamais prononce : une portee absente de l'ecran est une question qu'on ne
 * lui a jamais posee.
 */
export async function mesConsentements(
  idPatient: string,
  langue: string
): Promise<ConsentementView[]> {
  const [poses, enVigueur] = await Promise.all([
    prisma.consentementPatient.findMany({
      where: { idPatient },
      select: CHAMPS_CONSENTEMENT,
    }),
    Promise.all(
      Object.values(ConsentScope).map(async (scope) => ({
        scope,
        trouve: await texteEnVigueur(scope, langue),
      }))
    ),
  ]);

  const parScope = new Map(poses.map((c) => [c.scope, c]));
  const textes = new Map(enVigueur.map((e) => [e.scope, e.trouve]));

  return Object.values(ConsentScope).map((scope) => {
    const c = parScope.get(scope);
    const vigueur = textes.get(scope) ?? null;

    return {
      scope,
      actif: c?.actif ?? false,
      repondu: c !== undefined,
      donneLe: c?.donneLe.toISOString() ?? null,
      retireLe: c?.retireLe?.toISOString() ?? null,
      source: c?.source ?? null,
      // Le texte accepte, tel qu'il etait — pas le texte d'aujourd'hui.
      texteAccepte: c?.texte ? vueTexte(c.texte, c.texte.langue) : null,
      texteEnVigueur: vigueur ? vueTexte(vigueur.texte, vigueur.langueDemandee) : null,
      etat: etatDuTexte(c?.texte?.version ?? null, vigueur?.texte.version ?? null),
    };
  });
}

/**
 * Enregistrer un accord ou un retrait.
 *
 * **Deux ecritures, une transaction** : l'evenement, qui ne s'efface jamais,
 * et l'etat courant, qui sert aux controles d'acces. Si l'etat et l'historique
 * divergeaient, c'est l'historique qui dirait la verite — mais on ne les
 * laisse pas diverger.
 *
 * **Accorder exige un texte publie.** On ne peut pas consentir a rien. Un
 * retrait, lui, est toujours possible : refuser un retrait faute de
 * documentation serait retenir quelqu'un contre son gre.
 */
export async function enregistrer(
  idPatient: string,
  idAuteur: string,
  dto: { scope: ConsentScope; accorde: boolean; langue: string; source?: string; commentaire?: string }
): Promise<{ consentement: ConsentementView } | { refus: 'AUCUN_TEXTE_PUBLIE' }> {
  const trouve = await texteEnVigueur(dto.scope, dto.langue);
  if (dto.accorde && !trouve) return { refus: 'AUCUN_TEXTE_PUBLIE' };

  const source = dto.source ?? 'WEB';
  const maintenant = new Date();
  // Un retrait ne pointe pas vers le texte d'aujourd'hui : on retire son
  // accord a ce qu'on avait accepte, pas a ce qui est affiche maintenant.
  const idTexte = dto.accorde ? trouve!.texte.id : null;

  await prisma.$transaction(async (tx) => {
    await tx.evenementConsentement.create({
      data: {
        idPatient,
        scope: dto.scope,
        sens: dto.accorde ? 'ACCORDE' : 'RETIRE',
        idTexte,
        source,
        commentaire: dto.commentaire?.trim() || null,
        idAuteur,
      },
    });

    await tx.consentementPatient.upsert({
      where: { idPatient_scope: { idPatient, scope: dto.scope } },
      update: {
        actif: dto.accorde,
        // **Le retrait prend effet tout de suite** (EF-02-07) : aucun delai,
        // aucune file d'attente. Le controle d'acces relit cette ligne a
        // chaque demande.
        retireLe: dto.accorde ? null : maintenant,
        donneLe: dto.accorde ? maintenant : undefined,
        source,
        commentaire: dto.commentaire?.trim() || null,
        // Un retrait garde le texte auquel il se rapporte, pour que l'ecran
        // puisse montrer a quoi la personne avait dit oui.
        ...(dto.accorde ? { idTexte } : {}),
      },
      create: {
        idPatient,
        idUtilisateur: idAuteur,
        scope: dto.scope,
        actif: dto.accorde,
        retireLe: dto.accorde ? null : maintenant,
        source,
        commentaire: dto.commentaire?.trim() || null,
        idTexte,
      },
    });
  });

  const tous = await mesConsentements(idPatient, dto.langue);
  return { consentement: tous.find((c) => c.scope === dto.scope)! };
}

/**
 * L'histoire des consentements d'un patient.
 *
 * C'est elle qui donne un sens au mot « versionne » : on y lit les changements
 * d'avis, et le texte qui etait a l'ecran a chaque fois. En ajout seul — deux
 * declencheurs PostgreSQL refusent UPDATE, DELETE et TRUNCATE.
 */
export async function historique(
  idPatient: string,
  scope?: ConsentScope
): Promise<EvenementConsentementView[]> {
  const es = await prisma.evenementConsentement.findMany({
    where: { idPatient, ...(scope ? { scope } : {}) },
    orderBy: { creeLe: 'desc' },
    take: 200,
    select: {
      id: true, scope: true, sens: true, source: true, commentaire: true, creeLe: true,
      texte: { select: { version: true, langue: true, titre: true } },
      auteur: { select: { prenom: true, nom: true } },
    },
  });

  return es.map((e) => ({
    id: e.id,
    scope: e.scope,
    sens: e.sens,
    source: e.source,
    commentaire: e.commentaire,
    creeLe: e.creeLe.toISOString(),
    versionTexte: e.texte?.version ?? null,
    langueTexte: e.texte?.langue ?? null,
    titreTexte: e.texte?.titre ?? null,
    parQui: `${e.auteur.prenom} ${e.auteur.nom}`,
  }));
}
