// Bris de glace (EF-02-06).
//
// **Une porte déclarée vaut mieux qu'une porte dérobée.** Sans elle, un
// soignant devant un patient inconscient contournerait la règle autrement —
// compte prêté, mot de passe partagé — et rien n'en resterait.
//
// Ces cas tiennent ce qui distingue cette porte d'un passe-partout : qui peut
// l'ouvrir, ce qu'il doit dire, combien de temps elle reste ouverte, et qui
// relit.

jest.mock('../src/config/prisma', () => ({
  prisma: {
    brisDeGlace: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    patientProfile: { findUnique: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/notification.service', () => ({
  notifierSansBloquer: jest.fn(),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    brisDeGlace: { findMany: M; findUnique: M; create: M; update: M };
    patientProfile: { findUnique: M };
    utilisateur: { findUnique: M };
  };
};
const { notifierSansBloquer } = jest.requireMock('../src/services/notification.service') as {
  notifierSansBloquer: M;
};

import {
  declarer, dossiersOuvertsPour, DUREE_HEURES, estOuvert, EXPLICATION_MIN,
  motifDeRefus, refermer, reviser, ROLES_AUTORISES,
} from '../src/services/bris-de-glace.service';

const EXPL = 'Patient inconscient aux urgences, allergies à vérifier avant perfusion';
const PATIENT = { id: 'p1', idUtilisateur: 'u-patient' };
const SOIGNANT = { userId: 'u-medecin', role: 'MEDECIN' as const };

const BRUT = {
  id: 'b1',
  motif: 'URGENCE_VITALE' as const,
  explication: EXPL,
  ouvertLe: new Date('2026-10-04T10:00:00Z'),
  expireLe: new Date('2026-10-04T14:00:00Z'),
  refermeLe: null,
  statutRevue: 'A_REVOIR' as const,
  avisRevue: null,
  revuLe: null,
  notifieLe: null,
  patient: { id: 'p1', utilisateur: { prenom: 'Maomou', nom: 'Condé' } },
  auteur: { id: 'u-medecin', prenom: 'David', nom: 'Camara', role: 'MEDECIN' },
  revuPar: null,
  structure: { nom: 'Hôpital Donka' },
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.patientProfile.findUnique.mockResolvedValue(PATIENT);
  prisma.utilisateur.findUnique.mockResolvedValue({ prenom: 'David', nom: 'Camara', idStructure: 's1' });
  prisma.brisDeGlace.create.mockResolvedValue(BRUT);
  prisma.brisDeGlace.update.mockResolvedValue(BRUT);
  prisma.brisDeGlace.findMany.mockResolvedValue([]);
});

// ── Qui peut briser la glace, et à quelle condition ──────────────────

describe('motifDeRefus', () => {
  it('laisse passer un soignant qui explique la situation', () => {
    expect(motifDeRefus(SOIGNANT, PATIENT, EXPL)).toBeNull();
  });

  it('refuse un dossier qui n existe pas', () => {
    expect(motifDeRefus(SOIGNANT, null, EXPL)).toBe('PATIENT_INTROUVABLE');
  });

  // **Volontairement étroit : ceux qui donnent des soins.** Ouvrir cette porte
  // à l'accueil ou à l'administration ferait de l'exception la règle.
  it.each(['AGENT_ACCUEIL', 'ADMIN_STRUCTURE', 'PHARMACIEN', 'TECHNICIEN_LABO', 'LIVREUR', 'PATIENT'])(
    'refuse un %s',
    (role) => {
      expect(motifDeRefus({ userId: 'u1', role: role as never }, PATIENT, EXPL))
        .toBe('ROLE_NON_AUTORISE');
    }
  );

  it.each(ROLES_AUTORISES)('laisse passer un %s', (role) => {
    expect(motifDeRefus({ userId: 'u1', role }, PATIENT, EXPL)).toBeNull();
  });

  // Son propre dossier est déjà ouvert : le déclarer créerait une trace
  // d'urgence qui n'en est pas une, et polluerait la relecture.
  it('refuse de briser la glace sur son propre dossier', () => {
    expect(motifDeRefus({ userId: 'u-patient', role: 'MEDECIN' }, PATIENT, EXPL))
      .toBe('SON_PROPRE_DOSSIER');
  });

  // **C'est cette phrase qui sera relue**, et c'est elle qui protège le
  // soignant. « Urgence » n'explique rien.
  it('refuse une explication qui ne dit rien', () => {
    expect(motifDeRefus(SOIGNANT, PATIENT, 'urgence')).toBe('EXPLICATION_TROP_COURTE');
  });

  it('compte l explication sans ses espaces', () => {
    const espaces = `${' '.repeat(10)}urgence${' '.repeat(10)}`;
    expect(espaces.length).toBeGreaterThan(EXPLICATION_MIN);
    expect(motifDeRefus(SOIGNANT, PATIENT, espaces)).toBe('EXPLICATION_TROP_COURTE');
  });

  // L'ordre des refus compte : dire « rôle non autorisé » sur un dossier
  // inexistant enverrait le soignant sur une fausse piste.
  it('dit d abord ce qui est le plus déterminant', () => {
    expect(motifDeRefus({ userId: 'u1', role: 'AGENT_ACCUEIL' as never }, null, ''))
      .toBe('PATIENT_INTROUVABLE');
  });
});

// ── La vitre se referme ─────────────────────────────────────────────

describe('estOuvert', () => {
  const t = (s: string) => new Date(s);

  it('est ouvert avant l expiration', () => {
    expect(estOuvert({ expireLe: t('2026-10-04T14:00:00Z'), refermeLe: null },
      t('2026-10-04T12:00:00Z'))).toBe(true);
  });

  // **Un accès qui n'expire pas est une clé, pas une vitre brisée.**
  it('se referme tout seul à l expiration', () => {
    expect(estOuvert({ expireLe: t('2026-10-04T14:00:00Z'), refermeLe: null },
      t('2026-10-04T14:00:01Z'))).toBe(false);
  });

  it('est fermé dès la seconde de l expiration', () => {
    expect(estOuvert({ expireLe: t('2026-10-04T14:00:00Z'), refermeLe: null },
      t('2026-10-04T14:00:00Z'))).toBe(false);
  });

  it('est fermé s il a été refermé à la main, même avant l heure', () => {
    expect(estOuvert({ expireLe: t('2026-10-04T14:00:00Z'), refermeLe: t('2026-10-04T11:00:00Z') },
      t('2026-10-04T12:00:00Z'))).toBe(false);
  });
});

describe('declarer', () => {
  it('ouvre pour la durée annoncée, pas davantage', async () => {
    const t0 = new Date('2026-10-04T10:00:00Z');
    await declarer(SOIGNANT, { idPatient: 'p1', motif: 'URGENCE_VITALE', explication: EXPL }, t0);
    const [args] = prisma.brisDeGlace.create.mock.calls[0] as [
      { data: { ouvertLe: Date; expireLe: Date } }
    ];
    expect(args.data.ouvertLe).toEqual(t0);
    expect(args.data.expireLe.getTime() - t0.getTime()).toBe(DUREE_HEURES * 3600_000);
  });

  it('enregistre le motif et l explication tels quels', async () => {
    await declarer(SOIGNANT, {
      idPatient: 'p1', motif: 'PATIENT_HORS_ETAT', explication: `  ${EXPL}  `,
    });
    const [args] = prisma.brisDeGlace.create.mock.calls[0] as [
      { data: { motif: string; explication: string; idAuteur: string } }
    ];
    expect(args.data.motif).toBe('PATIENT_HORS_ETAT');
    expect(args.data.explication).toBe(EXPL);
    expect(args.data.idAuteur).toBe('u-medecin');
  });

  // **Le patient est prévenu.** C'est ce qui sépare un accès d'urgence assumé
  // d'une porte dérobée.
  it('prévient le patient', async () => {
    await declarer(SOIGNANT, { idPatient: 'p1', motif: 'URGENCE_VITALE', explication: EXPL });
    expect(notifierSansBloquer).toHaveBeenCalledTimes(1);
    const [dto] = notifierSansBloquer.mock.calls[0] as [
      { idUtilisateur: string; titre: string; contenu: string }
    ];
    expect(dto.idUtilisateur).toBe('u-patient');
    expect(dto.titre).toMatch(/urgence/i);
    // Le patient doit lire le motif déclaré, pas seulement « votre dossier a
    // été ouvert ».
    expect(dto.contenu).toContain(EXPL);
  });

  it('note que le patient a été prévenu', async () => {
    await declarer(SOIGNANT, { idPatient: 'p1', motif: 'URGENCE_VITALE', explication: EXPL });
    const appels = prisma.brisDeGlace.update.mock.calls as [{ data: { notifieLe: Date } }][];
    expect(appels).toHaveLength(1);
    expect(appels[0]![0].data.notifieLe).toBeInstanceOf(Date);
  });

  // **Un échec de notification ne referme pas la porte** : il y a un patient
  // inconscient au bout. Mais il se voit — `notifieLe` reste nul.
  it('ouvre quand même si la notification échoue, et le laisse voir', async () => {
    notifierSansBloquer.mockRejectedValueOnce(new Error('SMS indisponible'));
    const r = await declarer(SOIGNANT, {
      idPatient: 'p1', motif: 'URGENCE_VITALE', explication: EXPL,
    });
    expect('refus' in r).toBe(false);
    if (!('refus' in r)) expect(r.bris.notifieLe).toBeNull();
  });

  it('refuse sans rien écrire quand le refus s applique', async () => {
    const r = await declarer(
      { userId: 'u1', role: 'AGENT_ACCUEIL' as never },
      { idPatient: 'p1', motif: 'URGENCE_VITALE', explication: EXPL }
    );
    expect(r).toEqual({ refus: 'ROLE_NON_AUTORISE' });
    expect(prisma.brisDeGlace.create).not.toHaveBeenCalled();
    expect(notifierSansBloquer).not.toHaveBeenCalled();
  });
});

// ── Refermer ────────────────────────────────────────────────────────

describe('refermer', () => {
  it('referme son propre accès', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({ idAuteur: 'u-medecin', refermeLe: null });
    const r = await refermer({ userId: 'u-medecin' }, 'b1');
    expect('refus' in r).toBe(false);
    const [args] = prisma.brisDeGlace.update.mock.calls[0] as [{ data: { refermeLe: Date } }];
    expect(args.data.refermeLe).toBeInstanceOf(Date);
  });

  // Refermer l'accès d'un autre le laisserait devant un dossier qu'il
  // consultait peut-être encore.
  it('refuse de refermer l accès de quelqu un d autre', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({ idAuteur: 'u-autre', refermeLe: null });
    expect(await refermer({ userId: 'u-medecin' }, 'b1')).toEqual({ refus: 'PAS_VOTRE_ACCES' });
    expect(prisma.brisDeGlace.update).not.toHaveBeenCalled();
  });

  it('refuse de refermer deux fois', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({
      idAuteur: 'u-medecin', refermeLe: new Date(),
    });
    expect(await refermer({ userId: 'u-medecin' }, 'b1')).toEqual({ refus: 'DEJA_REFERME' });
  });

  it('refuse un accès qui n existe pas', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue(null);
    expect(await refermer({ userId: 'u-medecin' }, 'b1')).toEqual({ refus: 'BRIS_INTROUVABLE' });
  });
});

// ── Ce que le contrôle d'accès lit ──────────────────────────────────

describe('dossiersOuvertsPour', () => {
  // **Ni refermé, ni expiré.** Une requête qui oublierait l'une des deux
  // conditions laisserait la porte ouverte pour toujours.
  it('ne retient que les accès encore ouverts', async () => {
    const t = new Date('2026-10-04T12:00:00Z');
    await dossiersOuvertsPour('u-medecin', t);
    const [args] = prisma.brisDeGlace.findMany.mock.calls[0] as [
      { where: { idAuteur: string; refermeLe: null; expireLe: { gt: Date } } }
    ];
    expect(args.where.idAuteur).toBe('u-medecin');
    expect(args.where.refermeLe).toBeNull();
    expect(args.where.expireLe).toEqual({ gt: t });
  });

  it('rend les dossiers concernés', async () => {
    prisma.brisDeGlace.findMany.mockResolvedValue([{ idPatient: 'p1' }, { idPatient: 'p2' }]);
    expect(await dossiersOuvertsPour('u-medecin')).toEqual(['p1', 'p2']);
  });
});

// ── La relecture ────────────────────────────────────────────────────

describe('reviser', () => {
  const AVIS = 'Accès fondé : le patient était bien inconscient à son arrivée.';

  it('rend une revue avec son avis', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({ idAuteur: 'u-medecin', statutRevue: 'A_REVOIR' });
    const r = await reviser({ userId: 'u-admin' }, 'b1', { statut: 'JUSTIFIE', avis: AVIS });
    expect('refus' in r).toBe(false);
    const [args] = prisma.brisDeGlace.update.mock.calls[0] as [
      { data: { statutRevue: string; avisRevue: string; revuLe: Date; idRevuPar: string } }
    ];
    expect(args.data.statutRevue).toBe('JUSTIFIE');
    expect(args.data.avisRevue).toBe(AVIS);
    expect(args.data.idRevuPar).toBe('u-admin');
    expect(args.data.revuLe).toBeInstanceOf(Date);
  });

  // **Un garde-fou qu'on s'applique à soi-même n'en est pas un.**
  it('refuse de relire son propre accès', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({ idAuteur: 'u-admin', statutRevue: 'A_REVOIR' });
    expect(await reviser({ userId: 'u-admin' }, 'b1', { statut: 'JUSTIFIE', avis: AVIS }))
      .toEqual({ refus: 'PAS_SON_PROPRE_ACCES' });
    expect(prisma.brisDeGlace.update).not.toHaveBeenCalled();
  });

  // **Même pour dire que l'accès était fondé.** Une case cochée sans phrase ne
  // prouve pas que quelqu'un a regardé.
  it('exige un avis écrit, y compris pour justifier', async () => {
    expect(await reviser({ userId: 'u-admin' }, 'b1', { statut: 'JUSTIFIE', avis: 'ok' }))
      .toEqual({ refus: 'AVIS_TROP_COURT' });
    expect(prisma.brisDeGlace.findUnique).not.toHaveBeenCalled();
  });

  it('refuse de relire deux fois', async () => {
    prisma.brisDeGlace.findUnique.mockResolvedValue({ idAuteur: 'u-medecin', statutRevue: 'JUSTIFIE' });
    expect(await reviser({ userId: 'u-admin' }, 'b1', { statut: 'INJUSTIFIE', avis: AVIS }))
      .toEqual({ refus: 'DEJA_REVU' });
  });
});
