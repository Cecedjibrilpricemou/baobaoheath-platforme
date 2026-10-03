// Ce que le patient lit dans son journal d'acces (EF-02-08).
//
// L'ecran affichait `GET /:id` dans une balise `<code>`. Un journal illisible
// ne remplit pas l'obligation de transparence : il la simule.
//
// L'API rend des **cles de traduction**, pas du texte : l'application est
// bilingue, et une phrase francaise figee s'afficherait telle quelle a un
// patient ayant choisi l'anglais. Ce fichier verrouille donc deux choses — le
// choix de la cle, et le fait qu'elle existe reellement dans les deux
// langues, avec une formulation neutre.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libelleAcces, toutesLesCles } from '../src/services/libelle-acces';
import { motInterditDans } from '../src/services/message-sortant.service';

const I18N = join(__dirname, '../../web/src/app/shared/i18n');

function traductions(langue: 'fr' | 'en'): Record<string, string> {
  const brut = JSON.parse(readFileSync(join(I18N, `${langue}.json`), 'utf8')) as unknown;
  const plat: Record<string, string> = {};
  const parcourir = (noeud: unknown, prefixe: string) => {
    if (typeof noeud === 'string') { plat[prefixe] = noeud; return; }
    if (!noeud || typeof noeud !== 'object') return;
    for (const [k, v] of Object.entries(noeud as Record<string, unknown>)) {
      parcourir(v, prefixe ? `${prefixe}.${k}` : k);
    }
  };
  parcourir(brut, '');
  return plat;
}

const FR = traductions('fr');
const EN = traductions('en');

// ── Le choix de la cle ───────────────────────────────────────────────

describe('libelleAcces : l objet suit la ressource', () => {
  it.each([
    ['patients', 'RECORD'],
    ['consultations', 'CONSULTATION'],
    ['ordonnances', 'DOCUMENT'],
    ['vaccinations', 'IMMUNISATION'],
    ['commandes', 'PHARMACY_ORDER'],
    ['assurance', 'INSURANCE'],
  ])('%s -> %s', (ressource, attendu) => {
    expect(libelleAcces({ action: 'GET /:id', ressource }, false).objet).toBe(
      `PATIENT.CONSENTS.ACCESS_OBJECT.${attendu}`
    );
  });

  // Regle : ne pas pretendre plus de precision qu'on en a. Une ressource
  // inconnue — ou mal enregistree, ce qui est arrive 120 fois dans la base de
  // demonstration — reste designee largement.
  it.each(['unknown', 'me', 'cmxyz123', ''])(
    'une ressource inconnue (« %s ») retombe sur le dossier entier',
    (ressource) => {
      expect(libelleAcces({ action: 'GET /:id', ressource }, false).objet).toBe(
        'PATIENT.CONSENTS.ACCESS_OBJECT.RECORD'
      );
    }
  );
});

describe('libelleAcces : le verbe suit la methode HTTP', () => {
  it.each([
    ['GET /:id', 'READ'],
    ['POST /', 'CREATE'],
    ['PUT /:id', 'UPDATE'],
    ['PATCH /:id', 'UPDATE'],
    ['DELETE /:id', 'DELETE'],
  ])('%s -> %s', (action, attendu) => {
    expect(libelleAcces({ action, ressource: 'patients' }, false).cle).toBe(
      `PATIENT.CONSENTS.ACCESS_LABEL.${attendu}`
    );
  });

  // Une methode imprevue ne doit pas pretendre une ecriture qui n'a pas eu
  // lieu : la lecture est l'hypothese la moins affirmative.
  it.each(['HEAD /:id', 'OPTIONS /', '', 'n importe quoi'])(
    'une action imprevue (« %s ») est traitee comme une lecture',
    (action) => {
      expect(libelleAcces({ action, ressource: 'patients' }, false).cle).toBe(
        'PATIENT.CONSENTS.ACCESS_LABEL.READ'
      );
    }
  );
});

// ── Le scan du QR, le geste le plus concret du journal ───────────────
//
// Il n'etait pas trace avant le 2026-09-29, et pas rattache au patient avant
// le 2026-10-03. Le patient se souvient d'avoir presente son code au
// comptoir : il doit pouvoir le retrouver ici.

describe('libelleAcces : le scan d un code au comptoir', () => {
  it.each([
    ['GET /scan/:qrCode', 'laboratoire'],
    ['GET /scan/:qrCode', 'pharmacien'],
    ['GET /qr/:qrCode', 'patients'],
  ])('%s sur %s est nomme comme un scan', (action, ressource) => {
    expect(libelleAcces({ action, ressource }, false).cle).toBe(
      'PATIENT.CONSENTS.ACCESS_LABEL.SCAN'
    );
  });

  // La phrase se suffit a elle-meme : lui donner un objet produirait
  // « Votre code a ete scanne au comptoir votre dossier ».
  it('ne porte aucun objet', () => {
    expect(libelleAcces({ action: 'GET /scan/:qrCode', ressource: 'laboratoire' }, false).objet).toBe('');
  });
});

// ── Mes acces et ceux des autres ─────────────────────────────────────

describe('libelleAcces : distinguer ses propres acces', () => {
  it.each([
    ['GET /me', 'READ_BY_ME'],
    ['POST /', 'CREATE_BY_ME'],
    ['PUT /me/consents', 'UPDATE_BY_ME'],
    ['DELETE /:id', 'DELETE_BY_ME'],
    ['GET /scan/:qrCode', 'SCAN_BY_ME'],
  ])('%s par le patient lui-meme -> %s', (action, attendu) => {
    expect(libelleAcces({ action, ressource: 'patients' }, true).cle).toBe(
      `PATIENT.CONSENTS.ACCESS_LABEL.${attendu}`
    );
  });

  // Sans cette difference, les 273 consultations du patient noieraient les
  // deux acces d'un tiers dans la base de demonstration.
  it('les deux cles ne se confondent jamais', () => {
    for (const action of ['GET /:id', 'POST /', 'PUT /:id', 'DELETE /:id', 'GET /scan/:qrCode']) {
      const acces = { action, ressource: 'consultations' };
      expect(libelleAcces(acces, true).cle).not.toBe(libelleAcces(acces, false).cle);
    }
  });
});

// ── Les cles existent vraiment, dans les deux langues ────────────────
//
// Le systeme d'i18n rend la cle elle-meme quand elle manque : le patient
// verrait « PATIENT.CONSENTS.ACCESS_LABEL.READ » dans son journal. Ce test
// est le seul qui peut l'empecher, l'API et le front etant compiles
// separement.

describe('chaque cle produite existe en francais et en anglais', () => {
  it.each(toutesLesCles())('%s', (cle) => {
    expect({ cle, fr: typeof FR[cle] }).toEqual({ cle, fr: 'string' });
    expect({ cle, en: typeof EN[cle] }).toEqual({ cle, en: 'string' });
  });

  // Une phrase qui attend `{{objet}}` et une traduction qui ne le porte pas
  // perdrait l'objet en silence.
  it.each(toutesLesCles().filter((c) => c.includes('ACCESS_LABEL') && !c.includes('SCAN')))(
    '%s interpole bien son objet dans les deux langues',
    (cle) => {
      expect({ cle, fr: FR[cle]?.includes('{{objet}}') }).toEqual({ cle, fr: true });
      expect({ cle, en: EN[cle]?.includes('{{objet}}') }).toEqual({ cle, en: true });
    }
  );

  // Les phrases de scan se suffisent a elles-memes : un `{{objet}}` y
  // resterait vide a l'ecran.
  it.each(toutesLesCles().filter((c) => c.includes('SCAN')))(
    '%s ne reclame pas d objet',
    (cle) => {
      expect({ cle, fr: FR[cle]?.includes('{{objet}}') }).toEqual({ cle, fr: false });
      expect({ cle, en: EN[cle]?.includes('{{objet}}') }).toEqual({ cle, en: false });
    }
  );
});

// ── La neutralite, eprouvee par le garde-fou qui existe deja ─────────
//
// EF-11-02 interdit tout contenu medical dans un message sortant. Un libelle
// d'acces n'est pas un SMS — il se lit apres authentification — mais il
// s'affiche parfois sur un ecran partage. On soumet donc les traductions
// reelles au meme filtre, plutot que d'affirmer qu'elles sont neutres.

describe('aucune traduction ne nomme de contenu medical', () => {
  const phrases = toutesLesCles().map((cle) => [cle, FR[cle] ?? ''] as [string, string]);

  it.each(phrases)('%s', (_cle, phrase) => {
    expect(motInterditDans(phrase)).toBeNull();
  });

  // Ce test a d'abord echoue, et c'est pour cela qu'il est ici : « une
  // ordonnance de votre dossier » et « une commande de medicaments » etaient
  // mes premieres formulations, et le filtre les a refusees — « ordonnance »
  // et « medicament » sont des mots interdits. Les objets ont ete rendus
  // generaux plutot que de creer un second standard de neutralite.
  it('les ressources medicales passent le filtre dans leur formulation retenue', () => {
    for (const ressource of ['ordonnances', 'vaccinations', 'commandes', 'laboratoire', 'resultats']) {
      const { objet } = libelleAcces({ action: 'GET /:id', ressource }, false);
      expect({ ressource, mot: motInterditDans(FR[objet] ?? '') }).toEqual({ ressource, mot: null });
    }
  });
});

// ── Ce qu'un patient doit pouvoir lire ───────────────────────────────

describe('les phrases francaises sont redigees, pas bricolees', () => {
  // La premiere version n'avait aucun accent, alors que tout le reste de
  // l'interface en a. Un journal ecrit en francais approximatif se lit comme
  // une sortie de machine, pas comme une information destinee a quelqu'un.
  it('portent les accents du francais', () => {
    const avecAccent = toutesLesCles().filter((c) => /[éèêàçôûï]/.test(FR[c] ?? ''));
    expect(avecAccent.length).toBeGreaterThan(8);
  });

  it('commencent par une majuscule pour les phrases, une minuscule pour les objets', () => {
    for (const cle of toutesLesCles()) {
      const phrase = FR[cle] ?? '';
      const attendu = cle.includes('ACCESS_LABEL') ? /^[A-Z{]/ : /^[a-z]/;
      expect({ cle, ok: attendu.test(phrase) }).toEqual({ cle, ok: true });
    }
  });

  it('aucune n est vide, dans aucune des deux langues', () => {
    for (const cle of toutesLesCles()) {
      expect({ cle, fr: (FR[cle] ?? '').length > 0 }).toEqual({ cle, fr: true });
      expect({ cle, en: (EN[cle] ?? '').length > 0 }).toEqual({ cle, en: true });
    }
  });
});
