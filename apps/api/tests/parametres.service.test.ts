import {
  PARAMETRES_PAR_DEFAUT,
  fusionnerParametres,
  getParametres,
  getValeursParametres,
  modifierParametres,
} from '../src/services/parametres.service';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    parametresSysteme: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

// Pas de Redis en test : withCache/cacheDel doivent passer au travers.
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { parametresSysteme: { findUnique: jest.Mock; upsert: jest.Mock } };
};

afterEach(() => jest.resetAllMocks());

describe('fusionnerParametres', () => {
  it('retourne les defauts quand la base est vide ou invalide', () => {
    expect(fusionnerParametres(PARAMETRES_PAR_DEFAUT, undefined)).toEqual(PARAMETRES_PAR_DEFAUT);
    expect(fusionnerParametres(PARAMETRES_PAR_DEFAUT, 'corrompu')).toEqual(PARAMETRES_PAR_DEFAUT);
    expect(fusionnerParametres(PARAMETRES_PAR_DEFAUT, [])).toEqual(PARAMETRES_PAR_DEFAUT);
  });

  it('applique un champ partiel sans toucher au reste de la section', () => {
    const fusion = fusionnerParametres(PARAMETRES_PAR_DEFAUT, { alertes: { seuilPaludisme: 42 } });
    expect(fusion.alertes).toEqual({ ...PARAMETRES_PAR_DEFAUT.alertes, seuilPaludisme: 42 });
    expect(fusion.sync).toEqual(PARAMETRES_PAR_DEFAUT.sync);
  });

  it('ignore les cles inconnues (parametre retire du contrat)', () => {
    const fusion = fusionnerParametres(PARAMETRES_PAR_DEFAUT, {
      alertes: { ancienSeuil: 99 },
      sectionDisparue: { x: 1 },
    });
    expect(fusion).toEqual(PARAMETRES_PAR_DEFAUT);
    expect((fusion as unknown as Record<string, unknown>)['sectionDisparue']).toBeUndefined();
  });

  it('conserve false et 0 comme valeurs explicites', () => {
    const fusion = fusionnerParametres(PARAMETRES_PAR_DEFAUT, {
      facturation: { paiementEspeces: false, margePct: 0 },
    });
    expect(fusion.facturation.paiementEspeces).toBe(false);
    expect(fusion.facturation.margePct).toBe(0);
  });
});

describe('getParametres', () => {
  it('expose les defauts et modifieLe=null quand la ligne globale n existe pas', async () => {
    prisma.parametresSysteme.findUnique.mockResolvedValue(null);

    const vue = await getParametres();

    expect(vue).toEqual({ ...PARAMETRES_PAR_DEFAUT, modifieLe: null, idModifiePar: null });
    expect(prisma.parametresSysteme.findUnique).toHaveBeenCalledWith({ where: { id: 'global' } });
  });

  it('complete une ligne partielle avec les defauts', async () => {
    const modifieLe = new Date('2026-09-01T10:00:00Z');
    prisma.parametresSysteme.findUnique.mockResolvedValue({
      id: 'global',
      valeurs: { sync: { ussdTimeoutSecondes: 90 } },
      modifieLe,
      idModifiePar: 'admin-1',
    });

    const vue = await getParametres();

    expect(vue.sync.ussdTimeoutSecondes).toBe(90);
    expect(vue.sync.frequenceMinutes).toBe(PARAMETRES_PAR_DEFAUT.sync.frequenceMinutes);
    expect(vue.modifieLe).toBe(modifieLe);
    expect(vue.idModifiePar).toBe('admin-1');
  });
});

describe('modifierParametres', () => {
  it('fusionne le DTO avec les valeurs existantes et persiste le resultat complet', async () => {
    prisma.parametresSysteme.findUnique.mockResolvedValue({
      id: 'global',
      valeurs: { alertes: { seuilPaludisme: 30 } },
      modifieLe: new Date(),
      idModifiePar: 'admin-0',
    });
    const modifieLe = new Date('2026-09-12T12:00:00Z');
    prisma.parametresSysteme.upsert.mockResolvedValue({ id: 'global', modifieLe, idModifiePar: 'admin-1' });

    const vue = await modifierParametres('admin-1', { facturation: { paiementMomo: true } });

    const attendu = {
      ...PARAMETRES_PAR_DEFAUT,
      alertes: { ...PARAMETRES_PAR_DEFAUT.alertes, seuilPaludisme: 30 },
      facturation: { ...PARAMETRES_PAR_DEFAUT.facturation, paiementMomo: true },
    };
    expect(prisma.parametresSysteme.upsert).toHaveBeenCalledWith({
      where: { id: 'global' },
      create: { id: 'global', valeurs: attendu, idModifiePar: 'admin-1' },
      update: { valeurs: attendu, idModifiePar: 'admin-1' },
    });
    expect(vue).toEqual({ ...attendu, modifieLe, idModifiePar: 'admin-1' });
  });
});

describe('getValeursParametres', () => {
  it('retourne des valeurs completes pour les consommateurs internes', async () => {
    prisma.parametresSysteme.findUnique.mockResolvedValue({
      id: 'global',
      valeurs: { facturation: { paiementOrangeMoney: false } },
    });

    const valeurs = await getValeursParametres();

    expect(valeurs.facturation.paiementOrangeMoney).toBe(false);
    expect(valeurs.facturation.paiementEspeces).toBe(true);
    expect(valeurs.alertes.seuilEbola).toBe(PARAMETRES_PAR_DEFAUT.alertes.seuilEbola);
  });
});
