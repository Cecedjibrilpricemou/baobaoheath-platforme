// Les bornes du pool de connexions PostgreSQL.
//
// node-postgres n'en pose aucune par defaut qui protege l'API :
// `connectionTimeoutMillis` vaut 0, c'est-a-dire qu'une requete attend une
// connexion **indefiniment** quand le pool est epuise ou que la base ne
// repond plus. L'utilisateur voit un ecran qui tourne, et les requetes
// suivantes s'empilent derriere. Mieux vaut une erreur en cinq secondes.
//
// Separe de config/prisma.ts pour etre testable sans creer de client.
import type { PoolConfig } from 'pg';

type Env = Record<string, string | undefined>;

export const DEFAUTS_POOL = {
  /** Connexions simultanees. Celui de node-postgres, rendu explicite et reglable. */
  max: 10,
  /** Attente maximale d'une connexion libre avant erreur. */
  connectionTimeoutMillis: 5_000,
  /** Une connexion inactive depuis 30 s est rendue a PostgreSQL. */
  idleTimeoutMillis: 30_000,
  /** Duree maximale d'une requete cote serveur : une requete emballee ne bloque pas une connexion pour toujours. */
  statement_timeout: 30_000,
} as const;

/**
 * Un entier strictement positif, ou le defaut. **Jamais 0** : pour ces
 * options, 0 veut dire « pas de limite », exactement ce qu'on veut eviter.
 */
function entierPositif(valeur: string | undefined, defaut: number): number {
  const n = Number(valeur);
  return Number.isInteger(n) && n > 0 ? n : defaut;
}

export function optionsPool(env: Env = process.env): PoolConfig {
  return {
    connectionString: env['DATABASE_URL'],
    max: entierPositif(env['PG_POOL_MAX'], DEFAUTS_POOL.max),
    connectionTimeoutMillis: entierPositif(env['PG_CONNECTION_TIMEOUT_MS'], DEFAUTS_POOL.connectionTimeoutMillis),
    idleTimeoutMillis: entierPositif(env['PG_IDLE_TIMEOUT_MS'], DEFAUTS_POOL.idleTimeoutMillis),
    statement_timeout: entierPositif(env['PG_STATEMENT_TIMEOUT_MS'], DEFAUTS_POOL.statement_timeout),
  };
}

/**
 * Une connexion inactive coupee par PostgreSQL (redemarrage, coupure reseau)
 * fait emettre `error` au pool. **Sans ecouteur, Node fait tomber le
 * processus** : une API entiere arretee pour une connexion qui n'etait meme
 * pas utilisee. Le pool remplace la connexion tout seul ; il suffit de le
 * savoir et de le journaliser.
 */
export function surveillerPool(
  pool: { on(evenement: 'error', ecouteur: (erreur: Error) => void): unknown },
  journal: { error(message: string, meta?: Record<string, unknown>): unknown },
): void {
  pool.on('error', (erreur: Error) => {
    journal.error('[PostgreSQL] connexion inactive perdue ; le pool la remplacera', { erreur: erreur.message });
  });
}
