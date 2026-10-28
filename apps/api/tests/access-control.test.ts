// tests/access-control.test.ts
// Integration tests for cross-structure access control

import {
  buildConsultationWhereForUser,
  buildPatientWhereForUser,
  assertCanAccessPatient,
} from '../src/services/access-control.service';
import { JwtPayload } from '../src/types/auth.types';
import { ForbiddenError } from '../src/utils/app-error';

// ── Prisma mock — one fn per model to avoid ordering issues ──────────────────
jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur:    { findUnique: jest.fn() },
    patientProfile: { findFirst: jest.fn() },
    ascProfile:     { findUnique: jest.fn() },
    medecinProfile: { findUnique: jest.fn() },
    structureSante: { findUnique: jest.fn() },
  },
}));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    utilisateur:    { findUnique: jest.Mock },
    patientProfile: { findFirst:  jest.Mock },
    ascProfile:     { findUnique: jest.Mock },
    medecinProfile: { findUnique: jest.Mock },
    structureSante: { findUnique: jest.Mock },
  }
};

function makeUser(role: string, userId = 'user-1'): JwtPayload {
  return { userId, role, sessionId: 'sess-1' } as JwtPayload;
}

afterEach(() => jest.resetAllMocks());

// ── Critical P0 security property ───────────────────────────────────────────
describe('P0 — MEDECIN must not see ALL completed consultations system-wide', () => {
  it('does not include a bare statut clause in the WHERE filter', async () => {
    // A MEDECIN with a structure profile
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN'));
    const json  = JSON.stringify(where);

    // The removed bare clause would have contained these status values
    expect(json).not.toContain('"TERMINEE"');
    expect(json).not.toContain('"REFERENCEE"');
  });
});

// ── buildConsultationWhereForUser — MEDECIN ───────────────────────────────────
describe('buildConsultationWhereForUser — MEDECIN', () => {
  it('includes validated consultations', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-1'));
    expect(where).toMatchObject({ OR: expect.arrayContaining([{ idMedecinValideur: 'doc-1' }]) });
  });

  it('includes structure-scoped consultations when structure is known', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: 'structure-A' }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN'));
    expect(JSON.stringify(where)).toContain('structure-A');
  });

  it('only sees own validated consultations when profile has no structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: null,
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: null }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: null });

    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-no-structure'));
    // Should only include validated consultations — no structure-wide access
    expect(where).toEqual({ OR: [{ idMedecinValideur: 'doc-no-structure' }] });
    expect(JSON.stringify(where)).not.toContain('idStructure');
  });
});

// ── La consultation que le medecin mene lui-meme ─────────────────────────────
//
// **Les trois branches d'origine supposaient toutes un tiers** : un ASC qui a
// ouvert la consultation, un referencement qui la lui adresse, ou sa propre
// signature deja posee. Une consultation ouverte sur une visite de son propre
// hopital n'a aucun des trois. Le medecin pouvait donc la creer — puis se
// faisait refuser les constantes, le diagnostic, l'ordonnance et jusqu'a sa
// propre validation. Le parcours hospitalier s'arretait au 403 suivant.
describe('buildConsultationWhereForUser — la visite du medecin', () => {
  const medecinDe = (idStructure: string | null) => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure,
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure }, pharmacienProfile: null,
    });
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure });
  };

  it('porte sur les consultations des visites de sa structure', async () => {
    medecinDe('structure-A');
    const where = await buildConsultationWhereForUser(makeUser('MEDECIN'));
    expect(where).toMatchObject({
      OR: expect.arrayContaining([{ episode: { idStructure: 'structure-A' } }]),
    });
  });

  // La branche est **ajoutee**, pas substituee : le parcours ASC et le
  // referencement doivent continuer de passer.
  it('sans retirer l acces par l ASC ni par le referencement', async () => {
    medecinDe('structure-A');
    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-1'));
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        { idMedecinValideur: 'doc-1' },
        { asc: { idStructure: 'structure-A' } },
        { referencement: { idStructureCible: 'structure-A' } },
      ]),
    });
  });

  // **Un medecin sans structure n'herite pas des visites de tout le pays.**
  it('ne porte sur aucune visite quand il n a pas de structure', async () => {
    medecinDe(null);
    const where = await buildConsultationWhereForUser(makeUser('MEDECIN', 'doc-2'));
    expect(JSON.stringify(where)).not.toContain('episode');
  });

  // `ACTE_MEDICAL` ouvre la consultation d'une visite a l'administrateur de
  // structure autant qu'au medecin : sa porte doit suivre la meme regle.
  it('vaut aussi pour l administrateur de structure', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ADMIN_STRUCTURE', idStructure: 'structure-A',
      patientProfile: null, ascProfile: null,
      medecinProfile: null, pharmacienProfile: null,
    });
    const where = await buildConsultationWhereForUser(makeUser('ADMIN_STRUCTURE'));
    expect(where).toMatchObject({
      OR: expect.arrayContaining([{ episode: { idStructure: 'structure-A' } }]),
    });
  });
});

// ── buildConsultationWhereForUser — ASC ───────────────────────────────────────
describe('buildConsultationWhereForUser — ASC', () => {
  it('scopes consultations to the ASC own profile', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-A',
      patientProfile: null,
      ascProfile: { id: 'asc-1', idStructure: 'structure-A' },
      medecinProfile: null, pharmacienProfile: null,
    });
    prisma.ascProfile.findUnique.mockResolvedValue({ id: 'asc-1', idStructure: 'structure-A' });

    const where = await buildConsultationWhereForUser(makeUser('ASC'));
    expect(JSON.stringify(where)).toContain('asc-1');
  });
});

// ── assertCanAccessPatient ────────────────────────────────────────────────────
describe('assertCanAccessPatient', () => {
  it('allows access when patient is within user scope', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-A',
      patientProfile: null,
      ascProfile: { id: 'asc-1', idStructure: 'structure-A' },
      medecinProfile: null, pharmacienProfile: null,
    });
    prisma.patientProfile.findFirst.mockResolvedValue({ id: 'patient-1' });

    await expect(
      assertCanAccessPatient(makeUser('ASC'), 'patient-1')
    ).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when patient is outside user scope', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'ASC', idStructure: 'structure-B',
      patientProfile: null,
      ascProfile: { id: 'asc-2', idStructure: 'structure-B' },
      medecinProfile: null, pharmacienProfile: null,
    });
    // Patient not found within the scope → cross-structure access denied
    prisma.patientProfile.findFirst.mockResolvedValue(null);

    await expect(
      assertCanAccessPatient(makeUser('ASC'), 'patient-from-structure-A')
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows ADMIN_NATIONAL unrestricted access without any structure filter', async () => {
    // Admin roles skip the utilisateur lookup entirely (early return {})
    prisma.patientProfile.findFirst.mockResolvedValue({ id: 'patient-X' });

    await expect(
      assertCanAccessPatient(makeUser('ADMIN_NATIONAL'), 'patient-X')
    ).resolves.toBeUndefined();

    // Confirm the utilisateur table was never queried
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });
});

// ── buildPatientWhereForUser ───────────────────────────────────────────────────
describe('buildPatientWhereForUser — cross-structure isolation', () => {
  it('PATIENT can only see their own record', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'PATIENT', idStructure: null,
      patientProfile: { id: 'self-patient-id' },
      ascProfile: null, medecinProfile: null, pharmacienProfile: null,
    });

    const where = await buildPatientWhereForUser(makeUser('PATIENT'));
    expect(where).toEqual({ id: 'self-patient-id' });
  });

  it('MEDECIN without structure is limited to patients from consultations they validated', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: null,
      patientProfile: null, ascProfile: null,
      medecinProfile: { idStructure: null }, pharmacienProfile: null,
    });

    const where = await buildPatientWhereForUser(makeUser('MEDECIN', 'doc-1'));

    // La clause a deux branches : la relation de soin filtree par le
    // consentement, et le bris de glace qui passe outre (EF-02-06).
    const [parSoin, parUrgence] = (where as { OR: any[] }).OR;

    expect(parSoin.AND[0].OR).toEqual([
      { consultations: { some: { OR: [{ idMedecinValideur: 'doc-1' }] } } },
      { episodes: { some: { idResponsable: 'doc-1' } } },
    ]);

    // **Defaut permissif** : seul un refus explicite coupe. Pas de ligne de
    // consentement = acces autorise.
    expect(parSoin.AND[1]).toEqual({
      NOT: { consentements: { some: { scope: 'DOSSIER_MEDICAL', actif: false } } },
    });

    // Ni referme, ni expire, et le sien.
    expect(parUrgence.brisDeGlace.some.idAuteur).toBe('doc-1');
    expect(parUrgence.brisDeGlace.some.refermeLe).toBeNull();
    expect(parUrgence.brisDeGlace.some.expireLe.gt).toBeInstanceOf(Date);
  });

  // Un patient voit son propre dossier quoi qu'il arrive : ni consentement ni
  // relation de soin ne s'appliquent a soi-meme.
  it('un patient voit son dossier sans passer par le consentement', async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'PATIENT', idStructure: null,
      patientProfile: { id: 'pat-1' }, ascProfile: null,
      medecinProfile: null, pharmacienProfile: null,
    });
    expect(await buildPatientWhereForUser(makeUser('PATIENT', 'u-1'))).toEqual({ id: 'pat-1' });
  });

  it('admins get unrestricted access', async () => {
    for (const role of ['ADMIN_REGIONAL', 'ADMIN_NATIONAL', 'SUPER_ADMIN']) {
      const where = await buildPatientWhereForUser(makeUser(role));
      expect(where).toEqual({});
    }
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled();
  });
});

// ── Le perimetre patient du pharmacien ───────────────────────────────────────
//
// **`idStructure` etait teste dans la condition puis jamais utilise dans le
// filtre.** Le resultat ne retenait que « une ordonnance en attente, quelque
// part » : tout pharmacien du pays atteignait tout patient en attente de
// delivrance, sans qu'aucun lien ne les relie.
//
// Le lien reel est la commande : soit elle lui est attribuee, soit l'appel aux
// pharmacies (P6) l'a diffusee a son quartier -- c'est la maille de cet appel,
// et c'est a ce titre qu'il peut la prendre.
describe('buildPatientWhereForUser — PHARMACIEN', () => {
  function officineDe(idStructure: string | null, quartier: string | null) {
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'PHARMACIEN', idStructure,
      patientProfile: null, ascProfile: null, medecinProfile: null,
      pharmacienProfile: { idStructure },
    });
    prisma.structureSante.findUnique.mockResolvedValue(quartier ? { quartier } : null);
  }

  it('retient les commandes attribuees a son officine', async () => {
    officineDe('officine-1', 'Donka');
    const where = await buildPatientWhereForUser(makeUser('PHARMACIEN'));
    expect(JSON.stringify(where)).toContain('officine-1');
  });

  it('retient aussi celles diffusees a son quartier', async () => {
    officineDe('officine-1', 'Donka');
    const where = await buildPatientWhereForUser(makeUser('PHARMACIEN'));
    expect(JSON.stringify(where)).toContain('Donka');
  });

  // **C'est le defaut corrige.** Sans lien de commande, le filtre laissait
  // passer tout patient du pays en attente de delivrance.
  it('ne retient plus une ordonnance en attente sans lien de commande', async () => {
    officineDe('officine-1', 'Donka');
    const where = await buildPatientWhereForUser(makeUser('PHARMACIEN'));
    expect(JSON.stringify(where)).toContain('commande');
  });

  // Une officine sans quartier renseigne garde ses propres commandes, et
  // seulement elles : on ne lui ouvre pas le pays faute de donnee.
  it('se limite a ses commandes quand son quartier est inconnu', async () => {
    officineDe('officine-1', null);
    const where = await buildPatientWhereForUser(makeUser('PHARMACIEN'));
    const json = JSON.stringify(where);
    expect(json).toContain('officine-1');
    expect(json).toContain('commande');
  });
});
