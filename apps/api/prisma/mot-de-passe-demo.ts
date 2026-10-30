// Le mot de passe commun des comptes de demonstration (seed-demo.ts).
//
// **Aucune valeur par defaut, et c'est voulu.** Le depot est public : une
// valeur par defaut serait un mot de passe connu de tous, exactement ce que
// ce module remplace. Le mot de passe se choisit hors du depot (gestionnaire
// de mots de passe) et se passe a l'appel :
//
//   SEED_DEMO_PASSWORD=... npm run prisma:seed:demo
//
// Separe de seed-demo.ts pour etre testable : importer seed-demo lancerait le
// semis lui-meme.

export const LONGUEUR_MIN_MOT_DE_PASSE_DEMO = 12;

export function lireMotDePasseDemo(env: Record<string, string | undefined> = process.env): string {
  const valeur = env['SEED_DEMO_PASSWORD'] ?? '';
  if (!valeur) {
    throw new Error(
      'SEED_DEMO_PASSWORD est absente : le jeu de demonstration a besoin d\'un mot de passe choisi hors du depot. '
      + 'Exemple : SEED_DEMO_PASSWORD=... npm run prisma:seed:demo',
    );
  }
  if (valeur.length < LONGUEUR_MIN_MOT_DE_PASSE_DEMO) {
    throw new Error(
      `SEED_DEMO_PASSWORD doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE_DEMO} caracteres : `
      + 'il ouvre douze comptes professionnels.',
    );
  }
  return valeur;
}
