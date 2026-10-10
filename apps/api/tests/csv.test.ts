// Ecrire un CSV qu'Excel ouvre correctement.
//
// Le pendant de `analyserCsv`. Ce fichier verrouille ce qu'un export doit
// supporter — et nomme le defaut qui l'a motive : l'export d'analytics
// joignait sur `,` sans echappement, donc un motif de consultation contenant
// une virgule decalait toutes les colonnes suivantes, en silence.
import { BOM_UTF8, champCsv, enCsv, SEPARATEUR_CSV } from '../src/utils/csv';
import { analyserCsv } from '../src/services/referentiel.service';

describe('champCsv', () => {
  it.each([
    ['un texte simple', 'Alpha', 'Alpha'],
    ['un nombre', 42, '42'],
    ['zero, qui n est pas vide', 0, '0'],
    ['faux, qui n est pas vide', false, 'false'],
  ])('%s -> %s', (_nom, valeur, attendu) => {
    expect(champCsv(valeur)).toBe(attendu);
  });

  // « null » affiche tel quel dans un tableur est un defaut classique, et il
  // se remarque tard : l'operateur le prend pour une valeur.
  it.each([null, undefined])('rend une cellule vide pour %s', (valeur) => {
    expect(champCsv(valeur)).toBe('');
  });

  it('entoure un champ qui contient le separateur', () => {
    expect(champCsv('Fievre; toux')).toBe('"Fievre; toux"');
  });

  it('double les guillemets interieurs', () => {
    expect(champCsv('dit "Alpha" ici')).toBe('"dit ""Alpha"" ici"');
  });

  it.each(['deux\nlignes', 'retour\r\nwindows'])('entoure un champ multiligne (%j)', (valeur) => {
    expect(champCsv(valeur).startsWith('"')).toBe(true);
  });

  // Sans guillemets, « 2026 » et «  2026 » se relisent identiques : l'espace
  // de bord disparait silencieusement.
  it('preserve un espace de bord en l entourant', () => {
    expect(champCsv('  Alpha  ')).toBe('"  Alpha  "');
  });

  it('ecrit une date en ISO, le seul format sans ambiguite jour/mois', () => {
    expect(champCsv(new Date('2026-10-03T14:30:00.000Z'))).toBe('2026-10-03T14:30:00.000Z');
  });

  // Avec un separateur virgule, c'est la virgule qui declenche les
  // guillemets, et le point-virgule devient un caractere ordinaire.
  it('suit le separateur qu on lui donne', () => {
    expect(champCsv('a,b', ',')).toBe('"a,b"');
    expect(champCsv('a;b', ',')).toBe('a;b');
  });

  // ── Ce qu'Excel prend pour une formule ────────────────────────────
  //
  // Trouve sur l'export reel des structures : `+224620000300` arrivait dans
  // le tableur comme `224620000300`. Excel evalue la cellule, l'indicatif
  // disparait, et rien ne le signale.

  it('protege un numero de telephone guineen, qui commence par +224', () => {
    expect(champCsv('+224620000300')).toBe("'+224620000300");
  });

  it.each(['=1+1', '=HYPERLINK("http://ailleurs";"cliquez")', '-2+3', '@SUM(A1)', '\tfuite'])(
    'neutralise une tete de formule (%j)',
    (valeur) => {
      expect(champCsv(valeur).replace(/^"/, '').startsWith("'")).toBe(true);
    }
  );

  // Le cas qui donne son interet a la regle : un nom de produit saisi au
  // comptoir, et un administrateur qui exporte la liste. Sans neutralisation,
  // la formule s'executerait chez lui, avec ses droits.
  it('ne laisse pas une formule saisie au comptoir arriver vivante dans le fichier', () => {
    const csv = enCsv(['produit'], [['=cmd|\' /c calc\'!A1']]);
    expect(csv).not.toContain(';=');
    expect(csv).toContain("'=cmd");
  });

  // **Un vrai nombre reste un nombre.** L'apostrophe en ferait du texte, et
  // une colonne de montants ne se sommerait plus dans le tableur.
  it.each([-5000, 42, 0])('laisse un nombre sommable (%s)', (valeur) => {
    expect(champCsv(valeur)).toBe(String(valeur));
  });

  it('ne touche pas une tete inoffensive', () => {
    expect(champCsv('Pharmacie Pricemou')).toBe('Pharmacie Pricemou');
    expect(champCsv('2026-10-03T14:30:00.000Z')).toBe('2026-10-03T14:30:00.000Z');
  });
});

describe('enCsv', () => {
  it('commence par le BOM, sans lequel Excel se trompe d encodage', () => {
    expect(enCsv(['code'], [['A']]).startsWith(BOM_UTF8)).toBe(true);
  });

  it('separe par des points-virgules, ce qu attend Excel en francais', () => {
    expect(SEPARATEUR_CSV).toBe(';');
    expect(enCsv(['a', 'b'], [['1', '2']])).toContain('a;b');
  });

  it('termine les lignes par CRLF', () => {
    const csv = enCsv(['a'], [['1'], ['2']]);
    expect(csv.replace(BOM_UTF8, '')).toBe('a\r\n1\r\n2\r\n');
  });

  it('rend un fichier avec seulement l en-tete quand il n y a aucune ligne', () => {
    expect(enCsv(['a', 'b'], []).replace(BOM_UTF8, '')).toBe('a;b\r\n');
  });
});

// ── L'aller-retour : ce qu'on ecrit doit se relire ───────────────────
//
// Le projet porte deja un analyseur de CSV, ecrit pour l'import des
// referentiels. Le faire relire ce que l'ecrivain produit est la verification
// la plus severe disponible, et elle ne coute rien.

describe('ce qui est ecrit se relit a l identique', () => {
  it('rend les memes valeurs apres un aller-retour', () => {
    const lignes = [
      ['A', 'Fievre; toux', 'dit "Alpha" ici'],
      ['B', 'deux\nlignes', '  espaces  '],
      ['C', '', 'normal'],
    ];
    const csv = enCsv(['code', 'motif', 'note'], lignes);
    const relu = analyserCsv(csv);

    expect(relu.separateur).toBe(';');
    expect(relu.entetes).toEqual(['code', 'motif', 'note']);
    expect(relu.lignes.map((l) => l.champs['code'])).toEqual(['A', 'B', 'C']);
    expect(relu.lignes[0]?.champs['motif']).toBe('Fievre; toux');
    expect(relu.lignes[0]?.champs['note']).toBe('dit "Alpha" ici');
    expect(relu.lignes[1]?.champs['motif']).toBe('deux\nlignes');
  });

  // **Le prix de la neutralisation, dit explicitement.** Une valeur a tete de
  // formule ne revient pas identique : elle revient avec son apostrophe. On
  // l'assume — la valeur reste entiere et lisible, alors qu'un indicatif
  // mange par Excel est perdu sans trace. Un import qui relirait nos propres
  // exports doit retirer cette apostrophe de tete.
  it('rend une tete de formule avec son apostrophe, et rien de perdu', () => {
    const csv = enCsv(['tel'], [['+224620000300']]);
    const relu = analyserCsv(csv);
    const lu = relu.lignes[0]?.champs['tel'];
    expect(lu).toBe("'+224620000300");
    expect(lu?.slice(1)).toBe('+224620000300');
  });

  // Le defaut exact de l'export d'analytics, nomme : « Fievre, toux » joint
  // sur une virgule sans echappement produisait une colonne de plus, et tout
  // ce qui suivait glissait d'un cran. Personne ne le voyait, parce que le
  // fichier s'ouvrait quand meme.
  it('ne decale pas les colonnes quand un champ contient le separateur', () => {
    const csv = enCsv(
      ['date', 'patient', 'motif', 'statut'],
      [['2026-10-03', 'Maomou Conde', 'Fievre; toux; cephalees', 'TERMINEE']]
    );
    const relu = analyserCsv(csv);
    expect(relu.lignes[0]?.champs).toEqual({
      date: '2026-10-03',
      patient: 'Maomou Conde',
      motif: 'Fievre; toux; cephalees',
      statut: 'TERMINEE',
    });
  });
});
