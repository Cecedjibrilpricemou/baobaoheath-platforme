import { initialiserConsentementsParDefaut, SOURCE_DEFAUT_SYSTEME } from '../src/services/privacy.service';
import { PARAMETRES_PAR_DEFAUT } from '../src/services/parametres.service';

jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/services/parametres.service', () => {
  const reel = jest.requireActual('../src/services/parametres.service');
  return { PARAMETRES_PAR_DEFAUT: reel.PARAMETRES_PAR_DEFAUT, getValeursParametres: jest.fn() };
});

const { getValeursParametres } = jest.requireMock('../src/services/parametres.service') as {
  getValeursParametres: jest.Mock;
};

function makeTx() {
  return { consentementPatient: { createMany: jest.fn().mockResolvedValue({ count: 2 }) } };
}

afterEach(() => jest.resetAllMocks());

describe('initialiserConsentementsParDefaut', () => {
  it('accorde les consentements de soins quand le parametre est actif', async () => {
    getValeursParametres.mockResolvedValue(PARAMETRES_PAR_DEFAUT); // consentementDefaut: true
    const tx = makeTx();

    await initialiserConsentementsParDefaut(tx as never, 'pat-1', 'user-1');

    expect(tx.consentementPatient.createMany).toHaveBeenCalledTimes(1);
    const { data, skipDuplicates } = tx.consentementPatient.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data.map((d: { scope: string }) => d.scope).sort()).toEqual(['DOSSIER_MEDICAL', 'RAPPELS_SMS']);
    expect(data.every((d: { actif: boolean; source: string; idPatient: string; idUtilisateur: string }) =>
      d.actif && d.source === SOURCE_DEFAUT_SYSTEME && d.idPatient === 'pat-1' && d.idUtilisateur === 'user-1',
    )).toBe(true);
  });

  it('n accorde jamais FHIR_EXPORT ni RECHERCHE_ANONYMISEE d office', async () => {
    getValeursParametres.mockResolvedValue(PARAMETRES_PAR_DEFAUT);
    const tx = makeTx();

    await initialiserConsentementsParDefaut(tx as never, 'pat-1', 'user-1');

    const scopes = tx.consentementPatient.createMany.mock.calls[0][0].data.map((d: { scope: string }) => d.scope);
    expect(scopes).not.toContain('FHIR_EXPORT');
    expect(scopes).not.toContain('RECHERCHE_ANONYMISEE');
  });

  it('ne fait rien quand le super-admin a desactive le parametre', async () => {
    getValeursParametres.mockResolvedValue({
      ...PARAMETRES_PAR_DEFAUT,
      securite: { ...PARAMETRES_PAR_DEFAUT.securite, consentementDefaut: false },
    });
    const tx = makeTx();

    await initialiserConsentementsParDefaut(tx as never, 'pat-1', 'user-1');

    expect(tx.consentementPatient.createMany).not.toHaveBeenCalled();
  });
});
