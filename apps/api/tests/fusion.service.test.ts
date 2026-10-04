// Fusion de dossiers patients (EF-01-06).
//
// **L'opération la plus dangereuse du produit.** Fusionner deux personnes
// distinctes mélange leurs dossiers médicaux : l'allergie de l'une devient
// celle de l'autre, et personne ne s'en aperçoit avant une prescription.
//
// Ces cas tiennent trois choses :
//   - les refus, qui sont la seule barrière avant le mélange ;
//   - le sens dans lequel se résout un désaccord de consentement ;
//   - le fait que « réversible » désigne une liste, et non une intention.

import {
  consentementApresFusion, motifDeRefus, MOTIF_MIN,
} from '../src/services/fusion.service';

const MOTIF = 'Même personne, vérifié sur la pièce';

const dossier = (p: Partial<{
  id: string; niveauIdentite: string; numeroPiece: string | null; idFusionneDans: string | null;
}> = {}) => ({
  id: 'a', niveauIdentite: 'PROVISOIRE', numeroPiece: null, idFusionneDans: null, ...p,
});

describe('motifDeRefus', () => {
  it('laisse passer une fusion ordinaire', () => {
    expect(motifDeRefus(dossier({ id: 'a' }), dossier({ id: 'b' }), MOTIF)).toBeNull();
  });

  it.each([
    ['le dossier principal', null, dossier({ id: 'b' })],
    ['le dossier absorbé', dossier({ id: 'a' }), null],
    ['les deux', null, null],
  ])('refuse quand %s est introuvable', (_, a, b) => {
    expect(motifDeRefus(a, b, MOTIF)).toBe('DOSSIER_INTROUVABLE');
  });

  // Une faute de copie d'identifiant déplacerait toutes les lignes d'un
  // dossier vers lui-même, et l'annulation n'aurait plus de sens.
  it('refuse de fusionner un dossier avec lui-même', () => {
    expect(motifDeRefus(dossier({ id: 'a' }), dossier({ id: 'a' }), MOTIF)).toBe('MEME_DOSSIER');
  });

  // Un acte de cette portée sans motif n'est pas contestable.
  it('refuse un motif qui ne dit rien', () => {
    expect(motifDeRefus(dossier({ id: 'a' }), dossier({ id: 'b' }), 'doublon'))
      .toBe('MOTIF_TROP_COURT');
  });

  it('compte le motif sans ses espaces', () => {
    const espaces = '   ' + 'doublon' + '   ';
    expect(espaces.length).toBeGreaterThan(MOTIF_MIN);
    expect(motifDeRefus(dossier({ id: 'a' }), dossier({ id: 'b' }), espaces))
      .toBe('MOTIF_TROP_COURT');
  });

  // Pas de chaîne : A absorbé par B, lui-même absorbé par C, obligerait toute
  // lecture à suivre une chaîne de longueur inconnue, et l'annulation de la
  // première fusion rendrait des lignes à un dossier qui n'existe plus comme
  // tel. Trois doublons se traitent sans chaîne : A absorbe B, puis A absorbe C.
  it.each([
    ['le principal', { idFusionneDans: 'z' }, {}],
    ['l absorbé', {}, { idFusionneDans: 'z' }],
  ])('refuse quand %s est déjà fusionné', (_, pa, pb) => {
    expect(motifDeRefus(dossier({ id: 'a', ...pa }), dossier({ id: 'b', ...pb }), MOTIF))
      .toBe('DEJA_FUSIONNE');
  });

  // ── Le refus qui protège le plus ─────────────────────────────────
  //
  // Deux agents ont chacun vu une pièce, et les numéros diffèrent. **Ou bien
  // ce sont deux personnes, ou bien une des deux vérifications est fausse.**
  // Une machine ne peut pas dire laquelle : c'est un humain, pièce en main,
  // qui doit trancher. Fusionner ici mélangerait deux dossiers médicaux sur
  // la foi d'une ressemblance de nom.
  it('refuse deux identités vérifiées sur deux pièces différentes', () => {
    const r = motifDeRefus(
      dossier({ id: 'a', niveauIdentite: 'VERIFIEE', numeroPiece: 'GN-AB-1234567' }),
      dossier({ id: 'b', niveauIdentite: 'VERIFIEE', numeroPiece: 'GN-XY-9876543' }),
      MOTIF
    );
    expect(r).toBe('DEUX_PIECES_DIFFERENTES');
  });

  it('accepte deux identités vérifiées sur la même pièce', () => {
    const r = motifDeRefus(
      dossier({ id: 'a', niveauIdentite: 'VERIFIEE', numeroPiece: 'GN-AB-1234567' }),
      dossier({ id: 'b', niveauIdentite: 'VERIFIEE', numeroPiece: 'GN-AB-1234567' }),
      MOTIF
    );
    expect(r).toBeNull();
  });

  // Une seule identité vérifiée ne pose pas ce problème : il n'y a rien à
  // opposer. C'est même le cas le plus courant — un dossier provisoire créé
  // en double, qu'on rattache au dossier vérifié.
  it.each([
    ['le principal est vérifié', 'VERIFIEE', 'PROVISOIRE'],
    ['l absorbé est vérifié', 'PROVISOIRE', 'VERIFIEE'],
  ])('accepte quand %s seulement', (_, na, nb) => {
    const r = motifDeRefus(
      dossier({ id: 'a', niveauIdentite: na, numeroPiece: na === 'VERIFIEE' ? 'GN-1' : null }),
      dossier({ id: 'b', niveauIdentite: nb, numeroPiece: nb === 'VERIFIEE' ? 'GN-2' : null }),
      MOTIF
    );
    expect(r).toBeNull();
  });

  // L'ordre des refus compte : un motif vide sur un dossier introuvable doit
  // d'abord dire que le dossier n'existe pas, sinon l'agent corrige son motif
  // pour rien.
  it('dit d abord ce qui est le plus déterminant', () => {
    expect(motifDeRefus(null, dossier({ id: 'b' }), '')).toBe('DOSSIER_INTROUVABLE');
    expect(motifDeRefus(dossier({ id: 'a' }), dossier({ id: 'a' }), '')).toBe('MEME_DOSSIER');
  });
});

// ── Le désaccord de consentement ─────────────────────────────────────
//
// `@@unique([idPatient, scope])` interdit de garder les deux lignes. Il faut
// donc choisir, et le sens du choix n'est pas neutre.

describe('consentementApresFusion', () => {
  it('garde l accord quand les deux dossiers sont d accord', () => {
    expect(consentementApresFusion({ actif: true }, { actif: true }))
      .toEqual({ actif: true, restreint: false });
  });

  it('garde le refus quand les deux refusent', () => {
    expect(consentementApresFusion({ actif: false }, { actif: false }))
      .toEqual({ actif: false, restreint: false });
  });

  // **Le point le plus important de ce fichier.** Élargir un accès sans que le
  // patient l'ait dit montrerait des données qui ne devaient pas l'être, et
  // cela ne se rattrape pas. Un consentement retiré à tort se redonne en une
  // phrase. L'asymétrie est voulue.
  it('fait gagner le refus sur l accord', () => {
    expect(consentementApresFusion({ actif: true }, { actif: false }))
      .toEqual({ actif: false, restreint: true });
  });

  // Et dans l'autre sens, rien n'est élargi : le dossier survivant refusait,
  // il continue de refuser, même si le dossier absorbé avait accepté.
  it('n élargit jamais un accès', () => {
    expect(consentementApresFusion({ actif: false }, { actif: true }))
      .toEqual({ actif: false, restreint: false });
  });

  // `restreint` ne dit pas « il y a un désaccord » : il dit « la ligne du
  // dossier survivant a changé ». C'est ce qui décide si on l'enregistre pour
  // pouvoir la remettre, et ce qu'on rapporte à l'agent.
  it('ne signale une restriction que lorsque la ligne du survivant change', () => {
    expect(consentementApresFusion({ actif: false }, { actif: true }).restreint).toBe(false);
    expect(consentementApresFusion({ actif: true }, { actif: false }).restreint).toBe(true);
  });
});
