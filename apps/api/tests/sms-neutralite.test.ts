// Le chemin reel d'un SMS : `envoyerSmsSimule` applique-t-il le controle, et
// le refus remonte-t-il ?
//
// Ce fichier existe pour une raison precise : `envoyerSmsSimule` enveloppe
// l'envoi dans un try/catch — pour qu'une panne d'operateur ne fasse pas
// echouer un parcours de soin. Un controle place a l'interieur serait avale
// en simple avertissement, et le garde-fou ne garderait plus rien hors
// production.
import { envoyerSms, envoyerSmsSimule } from '../src/services/notification.service';
import { ValidationError } from '../src/utils/app-error';

jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));
jest.mock('../src/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));
jest.mock('../src/realtime/socket.server', () => ({ emitToUser: jest.fn() }));
jest.mock('../src/services/parametres.service', () => ({
  getIdentitePlateforme: jest.fn().mockResolvedValue({ nomCourt: 'KENEYA' }),
}));

const { logger } = jest.requireMock('../src/config/logger') as {
  logger: { error: jest.Mock; debug: jest.Mock };
};

const nodeEnv = process.env['NODE_ENV'];
afterEach(() => {
  process.env['NODE_ENV'] = nodeEnv;
  jest.clearAllMocks();
});

describe('envoyerSmsSimule', () => {
  it('envoie un message neutre tel quel', async () => {
    await envoyerSmsSimule('620000000', 'KENEYA: rendez-vous le 12 octobre.');
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('rendez-vous le 12 octobre'));
  });

  // C'est le coeur de ce fichier : le refus ne doit pas etre avale.
  it('laisse remonter le refus hors production', async () => {
    process.env['NODE_ENV'] = 'test';
    await expect(envoyerSmsSimule('620000000', 'KENEYA: vos resultats sont prets.'))
      .rejects.toThrow(/EF-11-02/);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('en production, remplace, journalise et envoie quand meme', async () => {
    process.env['NODE_ENV'] = 'production';
    await envoyerSmsSimule('620000000', 'KENEYA: vos resultats sont prets.');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('une information vous attend'));
    expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('resultats'));
  });
});

// Le filet de `mockSendSms` sert les **autres** appelants : `envoyerSms`,
// les rappels de rendez-vous et de vaccination, l'alerte de stock. Ils
// n'enveloppent rien, donc leur refus remonte naturellement — mais sans ce
// filet, un message fautif partirait.
describe('envoyerSms, qui appelle le point de sortie directement', () => {
  // Le message est tape par un administrateur : c'est une erreur de saisie,
  // donc une ValidationError (400) qui nomme le mot fautif — et non une
  // erreur serveur, devant laquelle il ne saurait quoi corriger.
  it('refuse un message non neutre en erreur de validation, meme en production', async () => {
    for (const env of ['test', 'production']) {
      process.env['NODE_ENV'] = env;
      const appel = envoyerSms({ telephone: '620000000', message: 'KENEYA: votre ordonnance est prete.' });
      await expect(appel).rejects.toBeInstanceOf(ValidationError);
      await expect(envoyerSms({ telephone: '620000000', message: 'KENEYA: votre ordonnance est prete.' }))
        .rejects.toThrow(/ordonnance/);
    }
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('laisse passer un message neutre', async () => {
    const r = await envoyerSms({ telephone: '620000000', message: 'KENEYA: une information vous attend.' });
    expect(r.statut).toBe('ENVOYE');
  });
});
