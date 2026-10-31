import { ValidationError } from './app-error';

/**
 * La longueur minimale d'un mot de passe, selon le compte.
 *
 * **12 caracteres pour tout compte qui n'est pas un patient.** Un medecin
 * ouvre les dossiers d'une structure, un pharmacien tient une caisse, un
 * administrateur national voit tout le pays : six caracteres ne suffisent
 * pas a proteger cela.
 *
 * **6 pour un patient.** Il tape sur un telephone, souvent le mot de passe
 * remis au comptoir, et n'ouvre que son propre dossier. Exiger davantage
 * ferait des comptes que personne n'arrive a ouvrir.
 *
 * Un role inconnu suit la regle la plus stricte : un role ajoute plus tard
 * ne doit pas heriter par oubli de la regle la plus faible.
 */
export const LONGUEUR_MIN_PATIENT = 6;
export const LONGUEUR_MIN_PROFESSIONNEL = 12;

export function longueurMinimale(role: string): number {
  return role === 'PATIENT' ? LONGUEUR_MIN_PATIENT : LONGUEUR_MIN_PROFESSIONNEL;
}

export function assertMotDePasseConforme(motDePasse: string, role: string): void {
  const minimum = longueurMinimale(role);
  if (motDePasse.length < minimum) {
    throw new ValidationError(`Le mot de passe doit contenir au moins ${minimum} caractères.`);
  }
}
