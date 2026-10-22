import { syncPushSchema, ussdSessionSchema, verifyLoginOtpSchema,
  filtreJournalSchema,
} from '../src/validators/api.schemas';

describe('api.schemas', () => {
  it('valide une mutation sync supportee', () => {
    const parsed = syncPushSchema.parse({
      mutations: [{
        clientMutationId: 'client-mut-001',
        entityType: 'Consultation',
        operation: 'CREATE',
        payload: { idPatient: 'patient-1', motifPrincipal: 'Fievre' },
      }],
    });

    expect(parsed.mutations).toHaveLength(1);
  });

  it('valide une session USSD', () => {
    const parsed = ussdSessionSchema.parse({
      sessionId: 'session-1',
      phoneNumber: '622000000',
    });

    expect(parsed.text).toBe('');
  });

  it('valide un OTP de connexion a 6 chiffres', () => {
    const parsed = verifyLoginOtpSchema.parse({
      email: 'agent@structure.com',
      code: '123456',
    });

    expect(parsed.code).toBe('123456');
  });
});


// -- Le filtre du journal d audit (EF-12-05) --------------------------
//
// Il s applique a `req.query`, donc **toutes les valeurs arrivent en
// chaines**. Les tests du service contournent Zod : ils n ont pas vu qu une
// premiere version recopiait les criteres a la main dans le routeur, ce qui
// ecartait les cles inconnues avant que `.strict()` ne les voie. Un critere
// mal orthographie passait en silence, avec un resultat trop large rendu a
// une enquete. Trouve contre l API reelle le 2026-10-03.
describe('filtreJournalSchema', () => {
  it('lit les booleens depuis des chaines, comme les envoie un navigateur', () => {
    expect(filtreJournalSchema.parse({ echecsSeulement: 'true' }).echecsSeulement).toBe(true);
    expect(filtreJournalSchema.parse({ echecsSeulement: 'false' }).echecsSeulement).toBe(false);
    expect(filtreJournalSchema.parse({ parTiers: 'true' }).parTiers).toBe(true);
  });

  it('convertit les nombres depuis des chaines', () => {
    const f = filtreJournalSchema.parse({ page: '3', limit: '50' });
    expect(f).toMatchObject({ page: 3, limit: 50 });
  });

  it('accepte un filtre vide', () => {
    expect(filtreJournalSchema.parse({})).toEqual({});
  });

  // Le point de ce bloc : une faute de frappe doit se voir.
  it.each(['echecSeulement', 'parTier', 'idPatientConcerne', 'ressources', 'apres'])(
    'refuse le critere inconnu « %s »',
    (cle) => {
      expect(() => filtreJournalSchema.parse({ [cle]: 'true' })).toThrow();
    }
  );

  it('refuse un role inconnu', () => {
    expect(() => filtreJournalSchema.parse({ role: 'CHIRURGIEN' })).toThrow();
    expect(filtreJournalSchema.parse({ role: 'MEDECIN' }).role).toBe('MEDECIN');
  });

  it('refuse un booleen qui n est ni true ni false', () => {
    expect(() => filtreJournalSchema.parse({ echecsSeulement: 'oui' })).toThrow();
    expect(() => filtreJournalSchema.parse({ echecsSeulement: '1' })).toThrow();
  });

  // Une page de dix mille lignes rendue a un navigateur n aide personne, et
  // charge la base pour rien.
  it('plafonne la taille de page a 200', () => {
    expect(() => filtreJournalSchema.parse({ limit: '5000' })).toThrow();
    expect(filtreJournalSchema.parse({ limit: '200' }).limit).toBe(200);
  });

  it('refuse une page nulle ou negative', () => {
    expect(() => filtreJournalSchema.parse({ page: '0' })).toThrow();
    expect(() => filtreJournalSchema.parse({ page: '-1' })).toThrow();
  });

  // Chaque champ du contrat doit passer : c est le piege paye deux fois le
  // 2026-10-02 (`prescription`, puis `avecAssurance`), un champ oublie dans
  // le schema se traduisant en 400 « Unrecognized key ».
  it('accepte tous les criteres du contrat a la fois', () => {
    const complet = {
      du: '2026-01-01', au: '2026-10-03', idUtilisateur: 'u1', idPatient: 'p1',
      role: 'MEDECIN', ressource: 'patients', echecsSeulement: 'true',
      parTiers: 'true', page: '2', limit: '20',
    };
    expect(() => filtreJournalSchema.parse(complet)).not.toThrow();
  });
});
