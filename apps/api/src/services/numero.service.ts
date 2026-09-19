// src/services/numero.service.ts
// Numeros lisibles et continus pour les pieces du parcours : EP-2026-000123
// (episode), DA-2026-000045 (demande d'analyse), EC- (echantillon), plus tard OR- (ordonnance),
// CM- (commande), LV- (livraison). Un compteur par prefixe et par annee,
// incremente en une seule instruction SQL : deux agents qui admettent un
// patient au meme instant ne peuvent pas obtenir le meme numero.
import { prisma } from '../config/prisma';

export type PrefixeNumero = 'EP' | 'DA' | 'EC' | 'OR' | 'CM' | 'LV';

// Seule capacite requise : $queryRaw. Le client Prisma (etendu) et le client
// de transaction la fournissent tous deux.
type Client = Pick<typeof prisma, '$queryRaw'>;

export async function prochainNumero(prefixe: PrefixeNumero, client: Client = prisma, date = new Date()): Promise<string> {
  const annee = date.getFullYear();
  const cle = `${prefixe}-${annee}`;
  // INSERT ... ON CONFLICT ... RETURNING : atomique, meme sous forte concurrence.
  const lignes = await client.$queryRaw<{ valeur: number }[]>`
    INSERT INTO compteurs (cle, valeur) VALUES (${cle}, 1)
    ON CONFLICT (cle) DO UPDATE SET valeur = compteurs.valeur + 1
    RETURNING valeur
  `;
  const valeur = lignes[0]?.valeur ?? 1;
  return `${prefixe}-${annee}-${String(valeur).padStart(6, '0')}`;
}
