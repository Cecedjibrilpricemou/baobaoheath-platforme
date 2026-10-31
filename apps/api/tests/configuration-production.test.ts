// La configuration de production : ce que le conteneur expose, et ce que
// l'API renvoie en clair.
//
// **Le constat.** `docker/docker-compose.yml` lancait l'API en
// `NODE_ENV=development`, avec le mot de passe Postgres ecrit en dur, et
// publiait Postgres et Redis (sans mot de passe) sur toutes les interfaces.
// Hors production, et sans variable pour l'interdire, l'API renvoyait le code
// OTP dans la reponse de connexion : la double authentification ne servait
// plus a rien. Il n'existait pas d'autre fichier compose.
import { readFileSync } from 'fs';
import { join } from 'path';
import { peutRenvoyerOtpEnClair } from '../src/utils/otp-developpement';

describe('peutRenvoyerOtpEnClair — opt-in explicite', () => {
  it('refuse par defaut, sans variable', () => {
    expect(peutRenvoyerOtpEnClair({ NODE_ENV: 'development' })).toBe(false);
  });

  it('refuse pour toute valeur autre que "true"', () => {
    for (const valeur of ['', '1', 'yes', 'TRUE', 'false', 'oui']) {
      expect(peutRenvoyerOtpEnClair({ NODE_ENV: 'development', EMAIL_OTP_DEV_FALLBACK: valeur })).toBe(false);
    }
  });

  it('accepte en developpement quand la variable vaut exactement "true"', () => {
    expect(peutRenvoyerOtpEnClair({ NODE_ENV: 'development', EMAIL_OTP_DEV_FALLBACK: 'true' })).toBe(true);
  });

  it('refuse toujours en production, meme avec la variable', () => {
    expect(peutRenvoyerOtpEnClair({ NODE_ENV: 'production', EMAIL_OTP_DEV_FALLBACK: 'true' })).toBe(false);
  });
});

describe('auth.service', () => {
  it("passe par peutRenvoyerOtpEnClair, et n'a plus de test « !== 'false' »", () => {
    const source = readFileSync(join(__dirname, '..', 'src', 'services', 'auth.service.ts'), 'utf8');
    expect(source).toMatch(/peutRenvoyerOtpEnClair\(\)/);
    expect(source).not.toMatch(/EMAIL_OTP_DEV_FALLBACK\s*!==\s*'false'/);
  });
});

describe('docker/docker-compose.prod.yml', () => {
  const chemin = join(__dirname, '..', '..', '..', 'docker', 'docker-compose.prod.yml');
  // Sous Windows, git peut extraire le fichier en CRLF : sans cette
  // normalisation, `service()` ne trouvait plus aucun bloc.
  const compose = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');

  /** Le bloc d'un service : de son nom au service suivant (meme indentation). */
  function service(nom: string): string {
    const m = compose.match(new RegExp(`\\n  ${nom}:\\n([\\s\\S]*?)(?=\\n  [a-z][\\w-]*:\\n|\\nvolumes:|$)`));
    if (!m) throw new Error(`service ${nom} introuvable`);
    return m[1]!;
  }

  it("lance l'API en production", () => {
    expect(service('api')).toMatch(/NODE_ENV:\s*production/);
    expect(compose).not.toMatch(/NODE_ENV:\s*development/);
  });

  it("n'active jamais l'OTP en clair", () => {
    expect(compose).not.toMatch(/EMAIL_OTP_DEV_FALLBACK/);
  });

  it("n'ecrit aucun mot de passe en dur : tout secret est une variable obligatoire", () => {
    expect(compose).not.toMatch(/baobao_password/);
    for (const secret of ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'JWT_SECRET', 'DB_ENCRYPTION_KEY']) {
      expect(compose).toMatch(new RegExp(`\\$\\{${secret}:\\?`));
    }
  });

  it("ne publie Postgres que sur l'interface locale du serveur", () => {
    const ports = service('postgres').match(/ports:\s*\n((?:\s+- .*\n?)+)/)?.[1] ?? '';
    for (const ligne of ports.split('\n').filter((l) => l.trim().startsWith('-'))) {
      expect(ligne).toMatch(/127\.0\.0\.1:/);
    }
  });

  it('ne publie pas Redis, et lui impose un mot de passe', () => {
    const redis = service('redis');
    expect(redis).not.toMatch(/ports:/);
    expect(redis).toMatch(/--requirepass/);
  });

  it("donne a l'API l'adresse Redis avec son mot de passe", () => {
    expect(service('api')).toMatch(/REDIS_URL:\s*redis:\/\/:\$\{REDIS_PASSWORD/);
  });
});
