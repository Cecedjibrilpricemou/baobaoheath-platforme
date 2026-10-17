// Le paiement d'une vente au comptoir (EF-08).
//
// **Ce que ces tests protegent.** Jusqu'au 2026-10-09, le pharmacien cochait
// « Orange Money » et la vente naissait PAYEE : rien ne verifiait qu'un franc
// ait bouge. La question de l'utilisateur — « c'est quoi la preuve que le
// paiement passe ? » — n'avait pas de reponse.
//
// La preuve, c'est `referenceTransaction`. Une vente ne devient payee que sur
// un `success`, et la contrainte SQL refuse une vente payee par operation qui
// n'en porterait pas.
import { appliquerPaiementVente } from '../src/services/vente.service';
import { NotFoundError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    venteComptoir: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { venteComptoir: { findUnique: M; update: M; updateMany: M } };
};

const EN_ATTENTE = {
  id: 'v-1', statut: 'EN_ATTENTE', statutOperateur: 'new', idOperation: 'op-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.venteComptoir.findUnique.mockResolvedValue(EN_ATTENTE);
  prisma.venteComptoir.update.mockResolvedValue({});
  prisma.venteComptoir.updateMany.mockResolvedValue({ count: 1 });
});

describe('appliquerPaiementVente', () => {
  it('regle la vente sur un « success », avec sa reference', async () => {
    const r = await appliquerPaiementVente('v-1', 'success', { referenceTransaction: 'TXN-77' });
    expect(r).toEqual({ changee: true, dejaPayee: false });
    const appel = prisma.venteComptoir.updateMany.mock.calls[0]![0];
    expect(appel.data).toMatchObject({ statut: 'PAYEE', referenceTransaction: 'TXN-77' });
  });

  // La prise est conditionnee a EN_ATTENTE : deux rappels simultanes donnent
  // un gagnant et un perdant, jamais deux reglements.
  it('ne regle que depuis l etat d attente', async () => {
    await appliquerPaiementVente('v-1', 'success', { referenceTransaction: 'TXN-77' });
    expect(prisma.venteComptoir.updateMany.mock.calls[0]![0].where)
      .toEqual({ id: 'v-1', statut: 'EN_ATTENTE' });
  });

  // La contrainte SQL refuse une vente payee par operation sans reference :
  // a defaut, l'identifiant de l'operation reste opposable.
  it("retombe sur l identifiant d operation quand l operateur n en donne pas", async () => {
    await appliquerPaiementVente('v-1', 'success', { referenceTransaction: null });
    expect(prisma.venteComptoir.updateMany.mock.calls[0]![0].data.referenceTransaction)
      .toBe('op-1');
  });

  it('traite une reference faite d espaces comme absente', async () => {
    await appliquerPaiementVente('v-1', 'success', { referenceTransaction: '   ' });
    expect(prisma.venteComptoir.updateMany.mock.calls[0]![0].data.referenceTransaction)
      .toBe('op-1');
  });

  // **Un echec laisse la vente en attente.** Le client peut recommencer, ou
  // le pharmacien annuler et rendre les boites.
  it.each(['canceled', 'failed', 'error', 'expired', 'pending'])(
    'un « %s » garde la trace sans regler la vente', async (statut) => {
      const r = await appliquerPaiementVente('v-1', statut);
      expect(r).toEqual({ changee: true, dejaPayee: false });
      expect(prisma.venteComptoir.update.mock.calls[0]![0].data)
        .toEqual({ statutOperateur: statut });
      expect(prisma.venteComptoir.updateMany).not.toHaveBeenCalled();
    });

  it('ne reecrit pas un statut identique', async () => {
    const r = await appliquerPaiementVente('v-1', 'new');
    expect(r).toEqual({ changee: false, dejaPayee: false });
    expect(prisma.venteComptoir.update).not.toHaveBeenCalled();
  });

  // **Un paiement acquis ne redescend jamais.** La documentation de ChapChap
  // annonce des rappels multiples dans un ordre quelconque : un « canceled »
  // tardif ne doit pas defaire une vente reglee.
  it.each(['canceled', 'failed', 'error', 'expired'])(
    'un « %s » tardif ne defait pas une vente payee', async (statut) => {
      prisma.venteComptoir.findUnique.mockResolvedValue({ ...EN_ATTENTE, statut: 'PAYEE' });
      const r = await appliquerPaiementVente('v-1', statut);
      expect(r).toEqual({ changee: false, dejaPayee: true });
      expect(prisma.venteComptoir.update).not.toHaveBeenCalled();
      expect(prisma.venteComptoir.updateMany).not.toHaveBeenCalled();
    });

  it('un « success » rejoue est reconnu sans rien refaire', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue({ ...EN_ATTENTE, statut: 'PAYEE' });
    const r = await appliquerPaiementVente('v-1', 'success');
    expect(r).toEqual({ changee: false, dejaPayee: true });
    expect(prisma.venteComptoir.updateMany).not.toHaveBeenCalled();
  });

  // Une vente annulee a rendu ses lots : la regler remettrait du stock en
  // negatif sans que rien ne le signale.
  it('ne ressuscite pas une vente annulee', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue({ ...EN_ATTENTE, statut: 'ANNULEE' });
    const r = await appliquerPaiementVente('v-1', 'success', { referenceTransaction: 'TXN-77' });
    expect(r).toEqual({ changee: false, dejaPayee: false });
    expect(prisma.venteComptoir.updateMany).not.toHaveBeenCalled();
  });

  it('refuse une vente inconnue', async () => {
    prisma.venteComptoir.findUnique.mockResolvedValue(null);
    await expect(appliquerPaiementVente('fantome', 'success'))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  // Deux rappels simultanes : la prise conditionnelle n'en laisse passer
  // qu'un, et l'autre apprend que c'etait deja fait.
  it('le perdant d une course est annonce comme deja regle', async () => {
    prisma.venteComptoir.updateMany.mockResolvedValue({ count: 0 });
    const r = await appliquerPaiementVente('v-1', 'success', { referenceTransaction: 'TXN-77' });
    expect(r).toEqual({ changee: false, dejaPayee: true });
  });
});
