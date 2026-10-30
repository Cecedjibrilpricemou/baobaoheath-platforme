// Le pool de connexions PostgreSQL.
//
// **Le constat (revue du 30/10).** Le pool etait cree sans aucune borne :
// `new Pool({ connectionString })`. Avec node-postgres, cela veut dire :
//
// - `connectionTimeoutMillis: 0` — une requete qui n'obtient pas de connexion
//   **attend indefiniment**. C'est la cause probable du `/health` reste
//   bloque 30 secondes et du 500 intermittent observes pendant la revue ;
// - aucun ecouteur `error` — quand PostgreSQL coupe une connexion inactive
//   (redemarrage, reseau), node-postgres emet `error` sur le pool, et un
//   EventEmitter sans ecouteur fait **tomber le processus**.
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { optionsPool, surveillerPool } from '../src/config/pool-options';

describe('optionsPool', () => {
  const URL = 'postgresql://u:p@localhost:5432/db';

  it("borne l'attente d'une connexion : jamais d'attente infinie", () => {
    const o = optionsPool({ DATABASE_URL: URL });
    expect(o.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(o.connectionTimeoutMillis).toBeLessThanOrEqual(10_000);
  });

  it('borne la taille du pool et libere les connexions inactives', () => {
    const o = optionsPool({ DATABASE_URL: URL });
    expect(o.max).toBeGreaterThan(0);
    expect(o.idleTimeoutMillis).toBeGreaterThan(0);
  });

  it('borne aussi la duree d une requete cote serveur', () => {
    const o = optionsPool({ DATABASE_URL: URL });
    expect(o.statement_timeout).toBeGreaterThan(0);
  });

  it('se regle par variables d environnement', () => {
    const o = optionsPool({
      DATABASE_URL: URL, PG_POOL_MAX: '25', PG_CONNECTION_TIMEOUT_MS: '3000',
      PG_IDLE_TIMEOUT_MS: '20000', PG_STATEMENT_TIMEOUT_MS: '15000',
    });
    expect(o).toMatchObject({ max: 25, connectionTimeoutMillis: 3000, idleTimeoutMillis: 20000, statement_timeout: 15000 });
  });

  it('ignore une valeur absurde et garde le defaut, plutot que de desactiver la borne', () => {
    const defauts = optionsPool({ DATABASE_URL: URL });
    for (const v of ['0', '-5', 'abc', '']) {
      const o = optionsPool({ DATABASE_URL: URL, PG_CONNECTION_TIMEOUT_MS: v, PG_POOL_MAX: v });
      expect(o.connectionTimeoutMillis).toBe(defauts.connectionTimeoutMillis);
      expect(o.max).toBe(defauts.max);
    }
  });
});

describe('surveillerPool', () => {
  it("une connexion perdue est journalisee et ne fait pas tomber le processus", () => {
    const pool = new EventEmitter();
    const journal = { error: jest.fn() };
    surveillerPool(pool, journal);

    // Sans ecouteur, cette ligne leverait l'erreur et ferait tomber le test.
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(journal.error).toHaveBeenCalledWith(
      expect.stringContaining('PostgreSQL'),
      expect.objectContaining({ erreur: 'terminating connection due to administrator command' }),
    );
  });
});

describe('config/prisma.ts', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'config', 'prisma.ts'), 'utf8');

  it('construit le pool avec optionsPool et le surveille', () => {
    expect(source).toMatch(/new Pool\(optionsPool\(\)\)/);
    expect(source).toMatch(/surveillerPool\(pool/);
  });
});
