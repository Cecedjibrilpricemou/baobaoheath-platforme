// Le mot de passe temporaire remis au comptoir (EF-03-01).
//
// **Il est dicté à voix haute, parfois dans le bruit, puis retapé sur un
// clavier de téléphone.** Une majuscule ou un caractère spécial y coûte trois
// gestes et une faute de frappe. La sécurité ne vient pas de sa complexité :
// elle vient du fait qu'il est temporaire et que le patient doit le changer à
// sa première connexion.

jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

import { genererMotDePasseTemp } from '../src/services/hopital.service';

const ECHANTILLON = Array.from({ length: 2000 }, () => genererMotDePasseTemp());

describe('genererMotDePasseTemp', () => {
  it('fait huit caractères : quatre lettres puis quatre chiffres', () => {
    expect(ECHANTILLON.every((p) => /^[a-z]{4}[0-9]{4}$/.test(p))).toBe(true);
  });

  // `l` et `1`, `o` et `0` : quatre caractères qui se confondent à l'oral
  // comme à l'écrit. Les retirer coûte un peu d'entropie et évite un patient
  // qui ne peut pas se connecter.
  it('évite les caractères qui se confondent', () => {
    const fautifs = ECHANTILLON.filter((p) => /[lo10]/.test(p));
    expect(fautifs).toEqual([]);
  });

  it('ne se répète pas', () => {
    expect(new Set(ECHANTILLON).size).toBe(ECHANTILLON.length);
  });

  // La longueur minimale acceptée par la plateforme est de six caractères :
  // un mot de passe généré plus court serait refusé à la connexion suivante.
  it('reste au-dessus du minimum de la plateforme', () => {
    expect(ECHANTILLON.every((p) => p.length >= 6)).toBe(true);
  });
});
