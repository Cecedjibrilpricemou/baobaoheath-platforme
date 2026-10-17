/**
 * L'API, en developpement.
 *
 * **L'adresse se deduit de l'hote qui a servi la page**, elle n'est pas
 * ecrite en dur. `http://localhost:3000` ne marche que depuis la machine qui
 * fait tourner l'API : ouvrir l'application depuis un second poste du reseau
 * local chargeait bien les ecrans, puis `localhost` y designait ce second
 * poste — et aucun appel n'aboutissait. C'est exactement la situation d'une
 * demonstration a deux ecrans, un pour le patient et un pour les
 * professionnels.
 *
 * Ecrire l'adresse IP en dur reglait le cas du jour et cassait le lendemain,
 * au premier renouvellement de bail DHCP. La deduire ne casse jamais : la
 * page vient de quelque part, et l'API est au meme endroit sur le port 3000.
 *
 * En production, `environment.prod.ts` utilise un chemin relatif : l'API vit
 * derriere le meme serveur que le front, et rien de tout ceci ne s'applique.
 */
const hote = typeof window !== 'undefined' && window.location.hostname
  ? window.location.hostname
  : 'localhost';

export const environment = {
  production: false,
  apiUrl: `http://${hote}:3000/api/v1`,
};
