// Consentement versionné (EF-02-01/03/07).
//
// **Un consentement ne vaut que pour ce qui a été expliqué.** Ces cas tiennent
// trois choses qui n'étaient pas tenues avant :
//   - le texte exact que la personne avait sous les yeux ;
//   - la différence entre un accord et une case cochée à sa place ;
//   - la règle de repli quand le texte n'existe pas dans sa langue.

jest.mock('../src/config/prisma', () => ({
  prisma: {
    texteConsentement: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    consentementPatient: { findMany: jest.fn(), upsert: jest.fn() },
    evenementConsentement: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    texteConsentement: { findFirst: M; findMany: M; create: M };
    consentementPatient: { findMany: M; upsert: M };
    evenementConsentement: { findMany: M; create: M };
    $transaction: M;
  };
};

import {
  enregistrer, etatDuTexte, LANGUE_DE_REPLI, mesConsentements, publier,
  texteEnVigueur, vueTexte,
} from '../src/services/consentement.service';

const TEXTE = {
  id: 't1',
  scope: 'DOSSIER_MEDICAL' as const,
  langue: 'fr',
  version: 1,
  titre: 'Partage de votre dossier avec les soignants',
  corps: 'En acceptant, vous autorisez les professionnels de santé qui vous prennent en charge…',
  publieLe: new Date('2026-10-04T12:00:00Z'),
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.texteConsentement.findFirst.mockResolvedValue(null);
  prisma.consentementPatient.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      evenementConsentement: { create: jest.fn() },
      consentementPatient: { upsert: jest.fn() },
    })
  );
});

// ── Ce qui fait la différence entre un accord et une case cochée ─────

describe('etatDuTexte', () => {
  // **Le cas le plus important.** Dans la base du 2026-10-04, deux des quatre
  // consentements avaient été posés par le système à la création du dossier,
  // sans que personne ne voie rien. Ce n'est pas un consentement, et l'écran
  // doit le dire.
  it('dit « jamais recueilli » quand aucun texte n a été vu', () => {
    expect(etatDuTexte(null, 3)).toBe('JAMAIS_RECUEILLI');
    expect(etatDuTexte(null, null)).toBe('JAMAIS_RECUEILLI');
  });

  it('dit « à jour » quand la version acceptée est celle en vigueur', () => {
    expect(etatDuTexte(2, 2)).toBe('A_JOUR');
  });

  it('signale un texte plus récent que celui accepté', () => {
    expect(etatDuTexte(1, 2)).toBe('TEXTE_PLUS_RECENT');
  });

  // Un texte dépublié — ou une base sans texte en vigueur — ne doit pas faire
  // croire que l'accord est périmé.
  it('ne périme pas un accord faute de texte en vigueur', () => {
    expect(etatDuTexte(2, null)).toBe('A_JOUR');
  });

  // Une version en vigueur plus ancienne que celle acceptée ne devrait pas
  // arriver, mais si cela arrivait, l'accord reste valable : on ne redemande
  // pas pour un retour en arrière administratif.
  it('ne redemande rien si la version en vigueur est plus ancienne', () => {
    expect(etatDuTexte(3, 2)).toBe('A_JOUR');
  });
});

// ── La langue fait partie du texte ──────────────────────────────────
//
// Un texte en français montré à quelqu'un qui lit le pular n'est pas un
// consentement éclairé. On ne peut pas le supprimer — il n'y a pas de
// traduction — mais on peut refuser de le taire.

describe('texteEnVigueur', () => {
  it('rend le texte de la langue demandée quand il existe', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValueOnce({ ...TEXTE, langue: 'pu' });
    const r = await texteEnVigueur('DOSSIER_MEDICAL', 'pu');
    expect(r?.texte.langue).toBe('pu');
    expect(prisma.texteConsentement.findFirst).toHaveBeenCalledTimes(1);
  });

  it('retombe sur le français quand la langue n est pas traduite', async () => {
    prisma.texteConsentement.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(TEXTE);
    const r = await texteEnVigueur('DOSSIER_MEDICAL', 'pu');
    expect(r?.texte.langue).toBe(LANGUE_DE_REPLI);
    expect(r?.langueDemandee).toBe('pu');
  });

  it('ne cherche pas deux fois quand la langue demandée est déjà le repli', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(null);
    const r = await texteEnVigueur('DOSSIER_MEDICAL', LANGUE_DE_REPLI);
    expect(r).toBeNull();
    expect(prisma.texteConsentement.findFirst).toHaveBeenCalledTimes(1);
  });

  // **Un brouillon ne se montre à personne.** La requête ne retient que les
  // textes publiés.
  it('ne retient que les textes publiés', async () => {
    await texteEnVigueur('DOSSIER_MEDICAL', 'fr');
    const [args] = prisma.texteConsentement.findFirst.mock.calls[0] as [{ where: { publieLe: unknown } }];
    expect(args.where.publieLe).toEqual({ not: null });
  });

  // La version en vigueur est la plus récemment **publiée**, pas la plus
  // grande : un numéro se saisit, une date s'enregistre. Si les deux
  // divergent, c'est la date qui dit ce qui a été mis à l'écran.
  it('prend la plus récemment publiée, pas le plus grand numéro', async () => {
    await texteEnVigueur('DOSSIER_MEDICAL', 'fr');
    const [args] = prisma.texteConsentement.findFirst.mock.calls[0] as [{ orderBy: unknown }];
    expect(args.orderBy).toEqual({ publieLe: 'desc' });
  });
});

describe('vueTexte', () => {
  it('dit quand le patient ne lit pas le texte dans sa langue', () => {
    expect(vueTexte(TEXTE, 'pu').dansUneAutreLangue).toBe(true);
    expect(vueTexte(TEXTE, 'fr').dansUneAutreLangue).toBe(false);
  });
});

// ── Publier ─────────────────────────────────────────────────────────

describe('publier', () => {
  it('calcule la version suivante plutôt que de la recevoir', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValueOnce({ version: 4 });
    prisma.texteConsentement.create.mockResolvedValueOnce({ ...TEXTE, version: 5 });
    await publier({ userId: 'u1' }, {
      scope: 'DOSSIER_MEDICAL', langue: 'fr', titre: TEXTE.titre, corps: TEXTE.corps,
    });
    const [args] = prisma.texteConsentement.create.mock.calls[0] as [{ data: { version: number } }];
    expect(args.data.version).toBe(5);
  });

  it('commence à 1 quand la portée n a jamais eu de texte', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValueOnce(null);
    prisma.texteConsentement.create.mockResolvedValueOnce(TEXTE);
    await publier({ userId: 'u1' }, {
      scope: 'DOSSIER_MEDICAL', langue: 'fr', titre: TEXTE.titre, corps: TEXTE.corps,
    });
    const [args] = prisma.texteConsentement.create.mock.calls[0] as [{ data: { version: number } }];
    expect(args.data.version).toBe(1);
  });

  it('publie tout de suite, et dit qui', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValueOnce(null);
    prisma.texteConsentement.create.mockResolvedValueOnce(TEXTE);
    await publier({ userId: 'u1' }, {
      scope: 'DOSSIER_MEDICAL', langue: 'fr', titre: TEXTE.titre, corps: TEXTE.corps,
    });
    const [args] = prisma.texteConsentement.create.mock.calls[0] as [
      { data: { publieLe: Date | null; idPubliePar: string } }
    ];
    expect(args.data.publieLe).toBeInstanceOf(Date);
    expect(args.data.idPubliePar).toBe('u1');
  });
});

// ── Enregistrer un accord ou un retrait ─────────────────────────────

describe('enregistrer', () => {
  it('refuse un accord quand aucun texte n est publié', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(null);
    const r = await enregistrer('p1', 'u1', {
      scope: 'DOSSIER_MEDICAL', accorde: true, langue: 'fr',
    });
    expect(r).toEqual({ refus: 'AUCUN_TEXTE_PUBLIE' });
  });

  // **Un retrait est toujours possible.** Le refuser faute de documentation
  // reviendrait à retenir quelqu'un contre son gré.
  it('accepte un retrait même sans texte publié', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(null);
    const r = await enregistrer('p1', 'u1', {
      scope: 'DOSSIER_MEDICAL', accorde: false, langue: 'fr',
    });
    expect('refus' in r).toBe(false);
  });

  it('enregistre l accord avec le texte qui était à l écran', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);
    const evenement = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        evenementConsentement: { create: evenement },
        consentementPatient: { upsert: jest.fn() },
      })
    );

    await enregistrer('p1', 'u1', { scope: 'DOSSIER_MEDICAL', accorde: true, langue: 'fr' });
    const [args] = evenement.mock.calls[0] as [{ data: { sens: string; idTexte: string | null } }];
    expect(args.data.sens).toBe('ACCORDE');
    expect(args.data.idTexte).toBe('t1');
  });

  // On retire son accord **à ce qu'on avait accepté**, pas à ce qui est
  // affiché aujourd'hui. Rattacher un retrait au texte du jour ferait dire à
  // l'historique que la personne a vu une version qu'elle n'a jamais vue.
  it('ne rattache pas un retrait au texte du jour', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);
    const evenement = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        evenementConsentement: { create: evenement },
        consentementPatient: { upsert: jest.fn() },
      })
    );

    await enregistrer('p1', 'u1', { scope: 'DOSSIER_MEDICAL', accorde: false, langue: 'fr' });
    const [args] = evenement.mock.calls[0] as [{ data: { sens: string; idTexte: string | null } }];
    expect(args.data.sens).toBe('RETIRE');
    expect(args.data.idTexte).toBeNull();
  });

  // **Le retrait prend effet tout de suite** (EF-02-07) : la date est posée
  // dans la même transaction, et le contrôle d'accès relit cette ligne à
  // chaque demande.
  it('date le retrait immédiatement', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);
    const upsert = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        evenementConsentement: { create: jest.fn() },
        consentementPatient: { upsert },
      })
    );

    const avant = Date.now();
    await enregistrer('p1', 'u1', { scope: 'DOSSIER_MEDICAL', accorde: false, langue: 'fr' });
    const [args] = upsert.mock.calls[0] as [{ update: { actif: boolean; retireLe: Date } }];
    expect(args.update.actif).toBe(false);
    expect(args.update.retireLe.getTime()).toBeGreaterThanOrEqual(avant);
  });

  // Un patient qui change d'avis dans l'autre sens doit redevenir consentant.
  // Le cas manquait : seul `retireLe` était vérifié, et un `actif` figé à
  // `false` laissait l'accord refusé en silence.
  it('réactive l accord quand le patient revient dessus', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);
    const upsert = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        evenementConsentement: { create: jest.fn() },
        consentementPatient: { upsert },
      })
    );

    await enregistrer('p1', 'u1', { scope: 'DOSSIER_MEDICAL', accorde: true, langue: 'fr' });
    const [args] = upsert.mock.calls[0] as [
      { update: { actif: boolean; retireLe: Date | null; idTexte?: string | null };
        create: { actif: boolean } }
    ];
    expect(args.update.actif).toBe(true);
    expect(args.update.retireLe).toBeNull();
    // Et la ligne pointe vers le texte qu'il vient de lire.
    expect(args.update.idTexte).toBe('t1');
    expect(args.create.actif).toBe(true);
  });

  // L'événement et l'état courant sont écrits **dans la même transaction** :
  // un historique sans état, ou l'inverse, ferait diverger ce qui prouve et ce
  // qui autorise.
  it('écrit l historique et l état dans la même transaction', async () => {
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);
    const evenement = jest.fn();
    const upsert = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        evenementConsentement: { create: evenement },
        consentementPatient: { upsert },
      })
    );

    await enregistrer('p1', 'u1', { scope: 'DOSSIER_MEDICAL', accorde: true, langue: 'fr' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(evenement).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

// ── Ce que le patient voit ──────────────────────────────────────────

describe('mesConsentements', () => {
  // **Une portée absente de l'écran est une question qu'on ne lui a jamais
  // posée.** Toutes sont rendues, répondues ou non.
  it('rend les quatre portées, même celles sans réponse', async () => {
    const vues = await mesConsentements('p1', 'fr');
    expect(vues).toHaveLength(4);
    expect(vues.every((v) => v.repondu === false)).toBe(true);
    expect(vues.every((v) => v.actif === false)).toBe(true);
  });

  it('marque « jamais recueilli » un accord posé sans texte', async () => {
    prisma.consentementPatient.findMany.mockResolvedValue([
      {
        scope: 'DOSSIER_MEDICAL', actif: true, donneLe: new Date('2026-09-13'),
        retireLe: null, source: 'DEFAUT_SYSTEME', commentaire: null, texte: null,
      },
    ]);
    prisma.texteConsentement.findFirst.mockResolvedValue(TEXTE);

    const vues = await mesConsentements('p1', 'fr');
    const dossier = vues.find((v) => v.scope === 'DOSSIER_MEDICAL')!;
    expect(dossier.actif).toBe(true);
    expect(dossier.repondu).toBe(true);
    expect(dossier.etat).toBe('JAMAIS_RECUEILLI');
    expect(dossier.source).toBe('DEFAUT_SYSTEME');
  });

  // Le patient doit revoir **ce qu'il a accepté**, pas le texte du jour.
  it('montre le texte accepté, et non celui en vigueur', async () => {
    prisma.consentementPatient.findMany.mockResolvedValue([
      {
        scope: 'DOSSIER_MEDICAL', actif: true, donneLe: new Date('2026-09-13'),
        retireLe: null, source: 'WEB', commentaire: null,
        texte: { ...TEXTE, version: 1, titre: 'Ancien titre' },
      },
    ]);
    prisma.texteConsentement.findFirst.mockResolvedValue({ ...TEXTE, id: 't2', version: 2 });

    const vues = await mesConsentements('p1', 'fr');
    const dossier = vues.find((v) => v.scope === 'DOSSIER_MEDICAL')!;
    expect(dossier.texteAccepte?.version).toBe(1);
    expect(dossier.texteAccepte?.titre).toBe('Ancien titre');
    expect(dossier.texteEnVigueur?.version).toBe(2);
    expect(dossier.etat).toBe('TEXTE_PLUS_RECENT');
  });
});
