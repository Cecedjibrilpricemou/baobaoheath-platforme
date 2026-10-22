// Qui apparait dans la liste « consultations a valider ».
//
// **Cette liste n'etait filtree par rien.** Le service recevait `userId` en
// premier argument et ne le lisait jamais : sa requete ne retenait que
// `statut: 'TERMINEE'` et `idMedecinValideur: null`. Chaque medecin voyait donc
// les consultations terminees de **toutes les structures du pays** — nom du
// patient, motif, diagnostics, ordonnances.
//
// C'est la clause nue que le test P0 de `access-control.test.ts` croyait avoir
// retiree de `buildConsultationWhereForUser` : elle avait seulement demenage
// dans ce service, qui n'appelait pas le filtre.
//
// Et `validerConsultation` appelle deja `assertCanAccessConsultation` : la
// liste proposait en plus des lignes sur lesquelles le medecin n'avait aucun
// pouvoir. Le meme filtre des deux cotes remet les deux d'accord.
jest.mock('../src/config/prisma', () => ({
  prisma: {
    consultation: { findMany: jest.fn(), count: jest.fn() },
    utilisateur: { findUnique: jest.fn() },
    medecinProfile: { findUnique: jest.fn() },
    ascProfile: { findUnique: jest.fn() },
    patientProfile: { findFirst: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/services/parametres.service', () => ({
  getValeursParametres: jest.fn().mockResolvedValue({
    prescription: { dureeValiditeJours: 30 },
  }),
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nom: 'KENEYA' }),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: {
    consultation: { findMany: M; count: M };
    utilisateur: { findUnique: M };
    medecinProfile: { findUnique: M };
    ascProfile: { findUnique: M };
    patientProfile: { findFirst: M };
  };
};

import { getConsultationsAValider } from '../src/services/medecin.service';

const MEDECIN = { userId: 'doc-1', role: 'MEDECIN', sessionId: 's' } as never;

/** Le `where` tel que la requete l'a recu. */
function whereEnvoye() {
  const appel = prisma.consultation.findMany.mock.calls[0]?.[0] as { where: unknown };
  return appel.where;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.consultation.findMany.mockResolvedValue([]);
  prisma.consultation.count.mockResolvedValue(0);
  prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: 'hop-1' });
  prisma.utilisateur.findUnique.mockResolvedValue({
    role: 'MEDECIN', idStructure: 'hop-1', medecinProfile: { idStructure: 'hop-1' },
  });
});

describe('la liste des consultations a valider', () => {
  it('passe le filtre d acces du medecin a la requete', async () => {
    await getConsultationsAValider(MEDECIN, {});
    // Le filtre d'acces nomme la structure du medecin : sans lui, la requete
    // ne la mentionne nulle part.
    expect(JSON.stringify(whereEnvoye())).toContain('hop-1');
  });

  it('garde le statut et l absence de validateur', async () => {
    await getConsultationsAValider(MEDECIN, {});
    const json = JSON.stringify(whereEnvoye());
    expect(json).toContain('TERMINEE');
    expect(json).toContain('idMedecinValideur');
  });

  // **Le filtre et le statut doivent etre cumules, pas alternatifs.** Un `OR`
  // entre les deux rendrait la fuite : toute consultation terminee passerait.
  it('cumule les deux conditions', async () => {
    await getConsultationsAValider(MEDECIN, {});
    const where = whereEnvoye() as { AND?: unknown[] };
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toHaveLength(2);
  });

  it('conserve le filtre de prefecture', async () => {
    await getConsultationsAValider(MEDECIN, { prefecture: 'Kindia' });
    expect(JSON.stringify(whereEnvoye())).toContain('Kindia');
  });

  // Un medecin sans structure ne voit que ce qu'il a lui-meme signe — donc
  // rien dans cette liste, qui ne retient que les consultations non validees.
  it('ne rend rien de plus a un medecin sans structure', async () => {
    prisma.medecinProfile.findUnique.mockResolvedValue({ idStructure: null });
    prisma.utilisateur.findUnique.mockResolvedValue({
      role: 'MEDECIN', idStructure: null, medecinProfile: { idStructure: null },
    });
    await getConsultationsAValider(MEDECIN, {});
    const json = JSON.stringify(whereEnvoye());
    expect(json).toContain('idMedecinValideur":"doc-1"');
    expect(json).not.toContain('idStructure');
  });
});
