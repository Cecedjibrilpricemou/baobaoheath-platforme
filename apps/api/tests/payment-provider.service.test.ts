import { initierPaiementSimule } from '../src/services/payment-provider.service';

describe('payment-provider.service', () => {
  it('simule Orange Money avec une reference operateur', async () => {
    const result = await initierPaiementSimule({
      modePaiement: 'ORANGE_MONEY',
      montantGnf: 5000,
      numeroOperateur: '622000000',
    });

    expect(result.provider).toBe('SIMULATION_ORANGE_MONEY');
    expect(result.referenceOperateur).toMatch(/^OM-SIM-/);
    expect(result.statut).toBe('EN_ATTENTE');
  });

  it('refuse MTN MoMo sans numero operateur', async () => {
    await expect(initierPaiementSimule({
      modePaiement: 'MTN_MOMO',
      montantGnf: 5000,
    })).rejects.toThrow('Numero MTN MoMo requis');
  });
});
