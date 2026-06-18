import { syncPushSchema, ussdSessionSchema, verifyLoginOtpSchema } from '../src/validators/api.schemas';

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
