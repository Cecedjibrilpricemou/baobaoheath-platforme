// Le logo de la plateforme.
//
// **Le constat (revue du 30/10).** Un logo SVG etait enregistre tel quel dans
// `uploads/logos/`, servi publiquement sur la meme origine que l'API. Un SVG
// est un document : il peut porter un `<script>`, un gestionnaire `onload`,
// une entite XML ou une reference externe. Ouvert directement, il s'execute
// dans l'origine de l'API.
//
// Desormais un SVG est **converti en PNG** : une image matricielle ne porte
// plus de code. Avant la conversion, les constructions dangereuses sont
// refusees, pour ne pas confier a la bibliotheque de rendu un document hostile.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'keneya-logos-'));

jest.mock('../src/middlewares/upload.middleware', () => ({
  AVATARS_DIR: dossier, AVATARS_PUBLIC_PATH: '/uploads/avatars',
  LOGOS_DIR: dossier, LOGOS_PUBLIC_PATH: '/uploads/logos',
}));
jest.mock('../src/services/parametres.service', () => ({
  modifierLogo: jest.fn(async (_id: string, url: string) => ({ logoUrl: url })),
}));

import { uploadLogoController } from '../src/controllers/upload.controller';
import { ValidationError } from '../src/utils/app-error';

const SIGNATURE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG_PROPRE = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#2D7D46"/></svg>';

function requete(contenu: string, mimetype = 'image/svg+xml') {
  return {
    file: { buffer: Buffer.from(contenu, 'utf8'), mimetype },
    user: { userId: 'admin' },
    protocol: 'http',
    get: () => 'localhost:3000',
  } as never;
}

function reponse() {
  const r = { statut: 0, corps: undefined as unknown };
  return {
    r,
    res: { status(s: number) { r.statut = s; return this; }, json(c: unknown) { r.corps = c; return this; } } as never,
  };
}

afterAll(() => rmSync(dossier, { recursive: true, force: true }));
beforeEach(() => { for (const f of readdirSync(dossier)) rmSync(join(dossier, f)); });

describe('un SVG propre', () => {
  it('est converti en PNG : aucun fichier .svg ecrit, et un PNG reel', async () => {
    const { r, res } = reponse();
    await uploadLogoController(requete(SVG_PROPRE), res);

    const ecrits = readdirSync(dossier);
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).toMatch(/\.png$/);
    expect(readFileSync(join(dossier, ecrits[0]!)).subarray(0, 8).equals(SIGNATURE_PNG)).toBe(true);
    expect(JSON.stringify(r.corps)).toMatch(/\.png"/);
  });
});

// Chaque SVG ci-dessous a des dimensions et un contenu dessinable : sans le
// filtre, sharp le rendrait sans erreur. C'est donc bien le filtre qui refuse.
describe('un SVG hostile est refuse, rien n est ecrit', () => {
  it.each([
    ['un script', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#000"/><script>alert(document.cookie)</script></svg>'],
    ['un gestionnaire d evenement', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" onload="alert(1)"><rect width="1" height="1"/></svg>'],
    ['un objet etranger HTML', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><foreignObject><iframe src="https://x.test"/></foreignObject></svg>'],
    ['une entite XML', '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><text>&x;</text></svg>'],
    ['une reference externe', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="file:///C:/Windows/win.ini" width="10" height="10"/></svg>'],
    ['un lien javascript', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><a href="javascript:alert(1)"><rect width="9" height="9"/></a></svg>'],
  ])('%s', async (_nom, contenu) => {
    const { res } = reponse();
    await expect(uploadLogoController(requete(contenu), res)).rejects.toBeInstanceOf(ValidationError);
    expect(readdirSync(dossier)).toHaveLength(0);
  });
});
