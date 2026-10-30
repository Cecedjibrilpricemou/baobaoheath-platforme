// Les mots de passe des scripts de semis (seed.ts, seed-demo.ts).
//
// **Aucune valeur par defaut, et c'est voulu.** Le depot est public : une
// valeur par defaut serait un mot de passe connu de tous, exactement ce que
// ce module remplace. Le mot de passe se choisit hors du depot (gestionnaire
// de mots de passe) et se passe a l'appel, ou dans apps/api/.env :
//
//   SEED_SUPER_ADMIN_PASSWORD=... npm run prisma:seed
//   SEED_DEMO_PASSWORD=...        npm run prisma:seed:demo
//
// Separe des scripts pour etre testable : les importer lancerait le semis.

export const LONGUEUR_MIN_MOT_DE_PASSE_DEMO = 12;

type Env = Record<string, string | undefined>;

function lireMotDePasseObligatoire(variable: string, commande: string, portee: string, env: Env): string {
  const valeur = env[variable] ?? '';
  if (!valeur) {
    throw new Error(
      `${variable} est absente : ce script a besoin d'un mot de passe choisi hors du depot. `
      + `Exemple : ${variable}=... ${commande}`,
    );
  }
  if (valeur.length < LONGUEUR_MIN_MOT_DE_PASSE_DEMO) {
    throw new Error(
      `${variable} doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE_DEMO} caracteres : il ouvre ${portee}.`,
    );
  }
  return valeur;
}

/** Le mot de passe commun des douze comptes de demonstration (seed-demo.ts). */
export function lireMotDePasseDemo(env: Env = process.env): string {
  return lireMotDePasseObligatoire('SEED_DEMO_PASSWORD', 'npm run prisma:seed:demo', 'douze comptes professionnels', env);
}

/** Le mot de passe du super administrateur cree par seed.ts. */
export function lireMotDePasseSuperAdmin(env: Env = process.env): string {
  return lireMotDePasseObligatoire('SEED_SUPER_ADMIN_PASSWORD', 'npm run prisma:seed', 'le compte qui administre toute la plateforme', env);
}
