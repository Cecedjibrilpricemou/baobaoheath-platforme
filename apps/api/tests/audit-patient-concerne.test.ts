// Qui a consulte mon dossier ? (EF-02-08)
//
// Jusqu'au 2026-10-03, la reponse ne se trouvait qu'en fouillant
// `metadonnees`, du JSON non indexe : le scan d'un QR au comptoir ne laissait
// le patient que dans `metadonnees.params.qrCode`. Le journal savait QUI avait
// agi et QUAND, mais pas SUR QUI.
//
// Ce fichier verrouille les cinq facons de determiner le patient concerne —
// et, tout aussi important, les cas ou le journal ne doit **pas** en inventer
// un.
import type { AuthRequest } from '../src/middlewares/auth.middleware';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    patientProfile: { findUnique: jest.fn() },
    consultation: { findUnique: jest.fn() },
    episodeSoins: { findUnique: jest.fn() },
    vaccination: { findUnique: jest.fn() },
    ordonnance: { findUnique: jest.fn() },
    journalAudit: { create: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    patientProfile: { findUnique: M };
    consultation: { findUnique: M };
    episodeSoins: { findUnique: M };
    vaccination: { findUnique: M };
    ordonnance: { findUnique: M };
    journalAudit: { create: M };
  };
};

import { patientConcerne, ressourceDeLaRequete } from '../src/services/audit.service';

/**
 * Une requete reduite a ce que le resolveur regarde.
 *
 * `path` est **tronque du prefixe de montage**, comme Express le fait
 * reellement dans un routeur monte : pour `/api/v1/patients/abc`, le
 * middleware voit `/abc`. La premiere version de ce fichier donnait le chemin
 * complet dans `path`, donc les tests passaient alors que le code ne pouvait
 * pas fonctionner en service. Verifie contre l'API reelle le 2026-10-03 : la
 * lecture de fiche par un medecin ne nommait aucun patient.
 */
function requete(partiel: {
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  role?: string;
}): AuthRequest {
  const complet = partiel.path;
  // Ce que Express laisse voir au handler : le chemin prive de son prefixe.
  const monte = complet.replace(/^\/api\/v1\/[^/]+/, '') || '/';
  return {
    path: monte,
    originalUrl: complet,
    params: partiel.params ?? {},
    query: partiel.query ?? {},
    body: partiel.body ?? {},
    user: { userId: 'u-lecteur', role: partiel.role ?? 'MEDECIN', sessionId: 's1' },
  } as unknown as AuthRequest;
}

beforeEach(() => {
  jest.resetAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue(null);
  prisma.consultation.findUnique.mockResolvedValue(null);
  prisma.episodeSoins.findUnique.mockResolvedValue(null);
  prisma.vaccination.findUnique.mockResolvedValue(null);
  prisma.ordonnance.findUnique.mockResolvedValue(null);
});

// ── Le piege du chemin tronque ───────────────────────────────────────
//
// Express tronque `req.url`, donc `req.path`, du prefixe de montage. Le
// resolveur doit lire `req.originalUrl`, qui n'est jamais modifie. Ce
// describe ne passe par aucun utilitaire : il fabrique la requete telle
// qu'Express la presente, pour qu'un retour a `req.path` echoue ici.

describe('le chemin que le resolveur doit lire', () => {
  it('resout la fiche patient alors que path est tronque du prefixe', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-tronque' });
    const r = {
      path: '/p-tronque', // ce que voit le handler
      originalUrl: '/api/v1/patients/p-tronque', // ce qui a reellement ete demande
      params: { id: 'p-tronque' },
      query: {},
      body: {},
      user: { userId: 'u-lecteur', role: 'MEDECIN', sessionId: 's1' },
    } as unknown as AuthRequest;
    await expect(patientConcerne(r)).resolves.toBe('p-tronque');
  });

  it('resout la consultation alors que path ne porte que l identifiant', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ idPatient: 'p-via-consult' });
    const r = {
      path: '/c1',
      originalUrl: '/api/v1/consultations/c1',
      params: { id: 'c1' },
      query: {},
      body: {},
      user: { userId: 'u-lecteur', role: 'MEDECIN', sessionId: 's1' },
    } as unknown as AuthRequest;
    await expect(patientConcerne(r)).resolves.toBe('p-via-consult');
  });

  // La ressource est la colonne sur laquelle une enquete filtrera (EF-12-05).
  // Elle etait fausse en service : `resourceFromPath` cherche le segment
  // « v1 », absent du chemin tronque, et retombait sur le premier segment
  // restant — d'ou 288 lignes de ressource « me » et 120 « unknown » dans la
  // base de demonstration du 2026-10-03.
  it.each([
    ['une fiche patient', 'patients', '/p1', '/api/v1/patients/p1'],
    ['une consultation', 'consultations', '/c1', '/api/v1/consultations/c1'],
    ['son propre dossier', 'patients', '/me', '/api/v1/patients/me'],
    ['une sous-ressource', 'patients', '/me/consultations', '/api/v1/patients/me/consultations'],
    ['un scan de laboratoire', 'laboratoire', '/scan/QR-1', '/api/v1/laboratoire/scan/QR-1'],
    ['une racine de routeur', 'consultations', '/', '/api/v1/consultations/'],
    // Sans retirer la chaine de requete, la ressource vaudrait
    // « patients?page=1 » et aucun filtre ne la retrouverait.
    ['une liste paginee', 'patients', '/', '/api/v1/patients?page=1&limit=20'],
    ['une recherche', 'patients', '/recherche', '/api/v1/patients/recherche?search=Diallo'],
  ])('%s est enregistree sous la ressource « %s »', (_nom, attendu, path, originalUrl) => {
    const r = { path, originalUrl, params: {}, query: {}, body: {} } as unknown as AuthRequest;
    expect(ressourceDeLaRequete(r)).toBe(attendu);
  });
});

// ── Cas 1 : le patient est donne explicitement ───────────────────────

describe('un idPatient donne explicitement', () => {
  it.each(['params', 'query', 'body'] as const)('est lu depuis %s', async (ou) => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-explicite' });
    const r = requete({ path: '/api/v1/consultations', [ou]: { idPatient: 'p-explicite' } });
    await expect(patientConcerne(r)).resolves.toBe('p-explicite');
  });

  // Le piege a eviter : la cle etrangere est en RESTRICT, donc un identifiant
  // inexistant ferait echouer l'ecriture du journal — et l'acces ne serait
  // pas trace du tout. Envoyer un idPatient fantaisiste suffirait a effacer
  // sa propre trace.
  it("n'est pas retenu s'il ne designe aucun patient", async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    const r = requete({ path: '/api/v1/consultations', body: { idPatient: 'p-inexistant' } });
    await expect(patientConcerne(r)).resolves.toBeNull();
  });

  it('est verifie en base avant d etre retenu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p1' });
    await patientConcerne(requete({ path: '/api/v1/consultations', body: { idPatient: 'p1' } }));
    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      select: { id: true },
    });
  });
});

// ── Cas 2 : le QR scanne au comptoir ─────────────────────────────────

describe('le scan d un QR au comptoir', () => {
  // C'est le trou nomme le 2026-09-29 et reste ouvert deux semaines.
  it('remonte au patient par son qrCode', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-scanne' });
    const r = requete({ path: '/api/v1/laboratoire/scan/QR-1', params: { qrCode: 'QR-1' } });
    await expect(patientConcerne(r)).resolves.toBe('p-scanne');
    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { qrCode: 'QR-1' },
      select: { id: true },
    });
  });

  it('ne retient rien d un QR inconnu', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    const r = requete({ path: '/api/v1/pharmacien/scan/QR-FAUX', params: { qrCode: 'QR-FAUX' } });
    await expect(patientConcerne(r)).resolves.toBeNull();
  });
});

// ── Cas 3 : la ressource EST le patient ──────────────────────────────

describe('une lecture de fiche patient', () => {
  it('retient l identifiant de l URL', async () => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-vu' });
    const r = requete({ path: '/api/v1/patients/p-vu', params: { id: 'p-vu' } });
    await expect(patientConcerne(r)).resolves.toBe('p-vu');
  });

  it("ne retient rien d'un identifiant qui ne designe aucun patient", async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    const r = requete({ path: '/api/v1/patients/n-importe-quoi', params: { id: 'n-importe-quoi' } });
    await expect(patientConcerne(r)).resolves.toBeNull();
  });
});

// ── Cas 4 : une ressource rattachee a un patient ─────────────────────

describe('une ressource rattachee a un patient', () => {
  it('remonte depuis une consultation', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ idPatient: 'p-consult' });
    const r = requete({ path: '/api/v1/consultations/c1', params: { id: 'c1' } });
    await expect(patientConcerne(r)).resolves.toBe('p-consult');
  });

  it('remonte depuis un episode de soins', async () => {
    prisma.episodeSoins.findUnique.mockResolvedValue({ idPatient: 'p-episode' });
    const r = requete({ path: '/api/v1/episodes/e1', params: { id: 'e1' } });
    await expect(patientConcerne(r)).resolves.toBe('p-episode');
  });

  it('remonte depuis une vaccination', async () => {
    prisma.vaccination.findUnique.mockResolvedValue({ idPatient: 'p-vaccin' });
    const r = requete({ path: '/api/v1/vaccinations/v1', params: { id: 'v1' } });
    await expect(patientConcerne(r)).resolves.toBe('p-vaccin');
  });

  // L'ordonnance n'a pas d'idPatient : elle appartient a une consultation,
  // qui le porte. C'est une consequence du choix de modele — l'ordonnance est
  // un document, pas un medicament.
  it('remonte depuis une ordonnance, par sa consultation', async () => {
    prisma.ordonnance.findUnique.mockResolvedValue({ consultation: { idPatient: 'p-ordo' } });
    const r = requete({ path: '/api/v1/ordonnances/o1', params: { id: 'o1' } });
    await expect(patientConcerne(r)).resolves.toBe('p-ordo');
  });

  it('ne retient rien si la ressource n existe pas', async () => {
    prisma.consultation.findUnique.mockResolvedValue(null);
    const r = requete({ path: '/api/v1/consultations/inconnue', params: { id: 'inconnue' } });
    await expect(patientConcerne(r)).resolves.toBeNull();
  });
});

// ── Cas 5 : le patient lit son propre dossier ────────────────────────

describe('le patient qui lit son propre dossier', () => {
  // Ces acces comptent : le journal doit distinguer « j'ai ouvert mon
  // dossier » de « quelqu'un d'autre l'a ouvert », et pour cela il faut les
  // deux. Dans la base de demonstration, les routes /me/... representaient a
  // elles seules 273 lectures sans patient nomme.
  it.each([
    '/api/v1/patients/me',
    '/api/v1/patients/me/consultations',
    '/api/v1/patients/me/episodes',
    '/api/v1/patients/me/resultats/evolution',
  ])('est reconnu sur %s', async (path) => {
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 'p-moi' });
    await expect(patientConcerne(requete({ path, role: 'PATIENT' }))).resolves.toBe('p-moi');
    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { idUtilisateur: 'u-lecteur' },
      select: { id: true },
    });
  });

  it("n'invente rien si le compte patient n a pas de profil", async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);
    await expect(
      patientConcerne(requete({ path: '/api/v1/patients/me', role: 'PATIENT' }))
    ).resolves.toBeNull();
  });

  // Un soignant sur une route de liste n'est pas un patient : son propre
  // profil ne doit pas etre cherche, et surtout pas attribue.
  it.each(['MEDECIN', 'PHARMACIEN', 'TECHNICIEN_LABO', 'ADMIN_NATIONAL'])(
    'ne s applique pas a %s',
    async (role) => {
      await expect(
        patientConcerne(requete({ path: '/api/v1/consultations', role }))
      ).resolves.toBeNull();
      expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
    }
  );
});

// ── Ce que le journal refuse de deviner ──────────────────────────────
//
// Une route de liste ou de recherche ne touche pas un dossier mais plusieurs,
// ou aucun. Lui attribuer un patient serait mentir. Ces lignes restent
// tracees — avec leur auteur, leur heure et leurs criteres dans
// `metadonnees` — mais sans patient nomme.

describe('ce que le resolveur n invente pas', () => {
  it.each([
    ['une recherche de patients', '/api/v1/patients/recherche'],
    ['une liste de consultations', '/api/v1/consultations'],
    ['un import de referentiel', '/api/v1/referentiels/interactions/import'],
    ['une modification de parametre', '/api/v1/parametres/systeme'],
  ])('%s ne nomme aucun patient', async (_nom, path) => {
    await expect(patientConcerne(requete({ path }))).resolves.toBeNull();
  });

  // Celui-la est la limite assumee : une recherche expose bien des identites
  // de patients, et elle n'apparaitra pourtant dans le journal d'aucun
  // d'entre eux. La couvrir demanderait de journaliser chaque resultat rendu,
  // donc une ligne par patient affiche. C'est un choix a trancher, pas un
  // oubli — et il est ecrit ici pour qu'on ne le decouvre pas en incident.
  it('la recherche expose des identites sans les journaliser : limite connue', async () => {
    const r = requete({ path: '/api/v1/patients/recherche', query: { search: 'Diallo' } });
    await expect(patientConcerne(r)).resolves.toBeNull();
  });
});
