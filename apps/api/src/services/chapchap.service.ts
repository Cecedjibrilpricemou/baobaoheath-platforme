// Chap Chap Pay : la passerelle de paiement (Guinee).
//
// Elle remplace la simulation de `payment-provider.service.ts`, qui fabriquait
// une reference et n'appelait personne.
//
// **Trois choses commandent la forme de ce module.**
//
// 1. *Le rappel ne fait pas foi a lui seul.* ChapChap previent par webhook,
//    mais l'URL doit etre publique et en HTTPS — en developpement, aucun rappel
//    n'atteint `localhost`. On sait donc toujours relire le statut
//    (`lireOperation`), et c'est cette lecture qui tranche. Un paiement dont on
//    dependrait d'un rappel qui peut ne jamais venir, c'est un patient qui a
//    paye et qu'on fait payer deux fois.
//
// 2. *La signature se verifie sur les octets exacts du corps.* Re-serialiser
//    le JSON produit d'autres octets et invalide la signature : la
//    verification doit precede toute lecture du contenu.
//
// 3. *`success` est definitif et n'arrive qu'une fois.* Plusieurs rappels
//    peuvent se succeder pour une meme operation, dans n'importe quel ordre —
//    la documentation donne l'exemple d'un `canceled` suivi d'un `success`.
//    Rien ne doit redescendre un paiement acquis.
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../config/logger';
import { AppError, ValidationError } from '../utils/app-error';

/** Les statuts que ChapChap peut rendre, pour une operation E-Commerce. */
export type StatutChapChap =
  | 'new' | 'pending' | 'success' | 'canceled' | 'failed' | 'error' | 'expired';

export interface OperationChapChap {
  operationId: string;
  orderId?: string | null;
  montantGnf: number;
  urlPaiement: string;
  /** Absent a la creation : le payeur n'a pas encore choisi. */
  statut?: StatutChapChap;
  /** Le moyen retenu par le payeur : `orange_money`, `mtn_momo`, `paycard`... */
  moyenPaiement?: string | null;
  referenceTransaction?: string | null;
}

/**
 * La configuration, lue a l'appel et non au chargement du module : un test
 * doit pouvoir la changer, et une cle absente doit se dire au moment ou on
 * s'en sert, pas faire echouer le demarrage du serveur entier.
 */
export function configurationChapChap() {
  return {
    baseUrl: process.env['CHAPCHAP_BASE_URL'] ?? 'https://chapchappay.com/api',
    cleApi: process.env['CHAPCHAP_API_KEY'] ?? '',
    cleHmac: process.env['CHAPCHAP_HMAC_KEY'] ?? '',
    urlRappel: process.env['CHAPCHAP_CALLBACK_URL'] ?? '',
    /**
     * `deduct` : la commission est retiree de ce que la structure recoit.
     * `add` : elle s'ajoute a ce que le patient paie.
     *
     * **`deduct` par defaut, et c'est un choix.** Un patient a qui l'on
     * annonce « consultation : 25 000 » et que la passerelle debite de 25 800
     * conteste au guichet, avec raison.
     */
    fraisPortesPar: (process.env['CHAPCHAP_FEE_HANDLING'] ?? 'deduct') as 'deduct' | 'add',
  };
}

export function chapchapEstConfigure(): boolean {
  return configurationChapChap().cleApi.length > 0;
}

/** Ce que ChapChap renvoie en erreur : `message`, parfois `error`. */
function messageDErreur(corps: unknown, defaut: string): string {
  const c = corps as { message?: string; error?: string; errors?: Record<string, string> };
  if (c?.errors) {
    const premier = Object.values(c.errors)[0];
    if (premier) return premier;
  }
  return c?.message ?? c?.error ?? defaut;
}

async function appeler(
  chemin: string,
  options: { methode: 'GET' | 'POST'; corps?: unknown },
): Promise<unknown> {
  const { baseUrl, cleApi } = configurationChapChap();
  if (!cleApi) {
    throw new AppError('Passerelle de paiement non configuree', 503);
  }

  // Un operateur mobile qui ne repond pas doit rendre la main : sans delai,
  // la requete du patient resterait ouverte jusqu'au timeout du navigateur.
  const horloge = AbortSignal.timeout(20_000);

  let reponse: Response;
  try {
    reponse = await fetch(baseUrl + chemin, {
      method: options.methode,
      headers: {
        'CCP-Api-Key': cleApi,
        ...(options.corps ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.corps ? { body: JSON.stringify(options.corps) } : {}),
      signal: horloge,
    });
  } catch (e) {
    logger.error('[CHAPCHAP] injoignable', { chemin, erreur: (e as Error).message });
    throw new AppError('La passerelle de paiement est injoignable', 503);
  }

  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    logger.warn('[CHAPCHAP] refus', { chemin, statut: reponse.status, corps });
    // 401 cote ChapChap est une erreur de configuration **chez nous** : la
    // renvoyer telle quelle ferait croire au patient qu'il n'est pas connecte.
    if (reponse.status === 401 || reponse.status >= 500) {
      throw new AppError('La passerelle de paiement a refuse la demande', 502);
    }
    throw new ValidationError(messageDErreur(corps, 'Demande de paiement refusee'));
  }
  return corps;
}

/**
 * Cree le lien de paiement vers lequel envoyer le patient.
 *
 * `orderId` est **notre** identifiant de facture : il permet de relire le
 * statut sans avoir garde l'identifiant de ChapChap, et de retrouver la
 * facture quand un rappel arrive.
 */
export async function creerOperation(dto: {
  montantGnf: number;
  orderId: string;
  description?: string;
  urlRetour?: string;
  urlAnnulation?: string;
}): Promise<OperationChapChap> {
  const { urlRappel, fraisPortesPar } = configurationChapChap();

  const brut = (await appeler('/ecommerce/create', {
    methode: 'POST',
    corps: {
      amount: dto.montantGnf,
      order_id: dto.orderId,
      fee_handling: fraisPortesPar,
      ...(dto.description ? { description: dto.description } : {}),
      // Sans URL de rappel, ChapChap n'envoie rien : on relira le statut.
      ...(urlRappel ? { callback_url: urlRappel } : {}),
      ...(dto.urlRetour ? { return_url: dto.urlRetour } : {}),
      ...(dto.urlAnnulation ? { cancel_url: dto.urlAnnulation } : {}),
    },
  })) as {
    operation_id: string; order_id?: string | null;
    amount: number; payment_url: string;
  };

  logger.info('[CHAPCHAP] operation creee', {
    operationId: brut.operation_id, orderId: dto.orderId, montantGnf: dto.montantGnf,
  });

  return {
    operationId: brut.operation_id,
    orderId: brut.order_id ?? dto.orderId,
    montantGnf: Math.round(brut.amount),
    urlPaiement: brut.payment_url,
  };
}

/**
 * Relit le statut d'une operation.
 *
 * **C'est la source de verite.** Le webhook accelere, cette lecture tranche :
 * elle fonctionne meme quand aucun rappel n'est jamais arrive.
 */
export async function lireOperation(operationId: string): Promise<OperationChapChap> {
  const brut = (await appeler(`/ecommerce/${encodeURIComponent(operationId)}`, {
    methode: 'GET',
  })) as {
    operation_id: string; order_id?: string | null; amount: number; payment_url: string;
    status?: { code?: string; payment_method?: string | null };
    transaction?: { payment_reference?: string | null; payment_method?: string | null } | null;
  };

  return {
    operationId: brut.operation_id,
    orderId: brut.order_id ?? null,
    montantGnf: Math.round(brut.amount),
    urlPaiement: brut.payment_url,
    statut: (brut.status?.code as StatutChapChap | undefined) ?? undefined,
    moyenPaiement: brut.transaction?.payment_method ?? brut.status?.payment_method ?? null,
    referenceTransaction: brut.transaction?.payment_reference ?? null,
  };
}

/**
 * Verifie la signature d'un rappel.
 *
 * **Sur les octets exacts du corps HTTP, avant toute lecture du JSON.**
 * Re-serialiser le contenu produit d'autres octets — un espace, un ordre de
 * cles — et la signature ne correspondrait plus.
 *
 * La comparaison est a temps constant : une comparaison ordinaire s'arrete au
 * premier octet different, et ce temps de reponse laisse deviner la signature
 * attendue, octet par octet.
 */
export function verifierSignature(corpsBrut: Buffer | string, signatureRecue: string): boolean {
  const { cleHmac } = configurationChapChap();
  if (!cleHmac || !signatureRecue) return false;

  const attendue = createHmac('sha256', cleHmac).update(corpsBrut).digest('hex');

  // Une signature de longueur differente, ou non hexadecimale, ferait lever
  // `timingSafeEqual` : on la refuse avant.
  if (!/^[0-9a-f]+$/i.test(signatureRecue)) return false;
  const a = Buffer.from(attendue, 'hex');
  const b = Buffer.from(signatureRecue.toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Ce qu'un statut ChapChap veut dire pour une facture.
 *
 * **Seul `success` change l'etat d'une facture.** Un paiement annule, echoue
 * ou expire laisse la facture payable : le patient recommence. La marquer
 * annulee l'obligerait a repasser par le guichet pour un simple code mal
 * saisi.
 */
export function estPaye(statut: StatutChapChap | string | undefined): boolean {
  return statut === 'success';
}

/** Vrai tant que l'issue n'est pas connue : rien a decider encore. */
export function estEnCours(statut: StatutChapChap | string | undefined): boolean {
  return statut === 'new' || statut === 'pending';
}
