/**
 * Renvoyer le code OTP dans la reponse de connexion, au lieu de l'envoyer
 * par e-mail : utile sur un poste de developpement sans compte Gmail.
 *
 * **Opt-in explicite, et jamais en production.** La regle etait l'inverse :
 * actif hors production tant que la variable ne valait pas `false`. Un
 * conteneur lance en `NODE_ENV=development` — c'etait le cas du seul fichier
 * compose — renvoyait donc le code a quiconque connaissait un mot de passe,
 * et la double authentification ne protegeait plus rien.
 *
 * Il faut desormais `EMAIL_OTP_DEV_FALLBACK=true`, exactement. `.env.example`
 * et les configurations Playwright le posent deja.
 */
export function peutRenvoyerOtpEnClair(env: Record<string, string | undefined> = process.env): boolean {
  return env['NODE_ENV'] !== 'production' && env['EMAIL_OTP_DEV_FALLBACK'] === 'true';
}
