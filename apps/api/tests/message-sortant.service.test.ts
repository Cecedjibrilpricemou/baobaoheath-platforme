// Aucun contenu medical dans un message sortant (EF-11-02).
//
// Un SMS voyage en clair, s'affiche sur un ecran verrouille et reste dans un
// telephone souvent partage. Le 2026-10-02 le code violait cette regle a cinq
// endroits ; ce fichier verrouille la correction.
//
// Le controle vit au **point de sortie** (`mockSendSms`), pas a chaque appel :
// un site oublie ne peut donc pas fuir. Les constructeurs sont la pour que le
// garde-fou n'ait jamais a mordre.
import {
  messageDemarche,
  messageDeRepli,
  messageEcheance,
  messagePatientInformation,
  messageProfessionnelIntervention,
  messageProfessionnelUrgent,
  messageRendezVous,
  messageStockCritique,
  motInterditDans,
  neutraliser,
} from '../src/services/message-sortant.service';

jest.mock('../src/config/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
const { logger } = jest.requireMock('../src/config/logger') as { logger: { error: jest.Mock } };

const NOM = 'KENEYA';

describe('motInterditDans', () => {
  it.each([
    'analyse', 'analyses', 'prelevement', 'resultat', 'resultats', 'ordonnance',
    'prescription', 'diagnostic', 'vaccin', 'vaccination', 'traitement',
    'medicament', 'posologie', 'symptome', 'maladie', 'allergie', 'pathologie',
    'grossesse', 'depistage', 'serologie', 'glycemie',
  ])('reconnait « %s »', (mot) => {
    expect(motInterditDans(`${NOM}: votre ${mot} est pret.`)).toBe(mot);
  });

  it('ignore les accents et la casse : « Résultats » est le meme mot', () => {
    expect(motInterditDans('KENEYA: vos Résultats sont disponibles.')).toBe('resultats');
    expect(motInterditDans('KENEYA: PRÉLÈVEMENT prevu demain.')).toBe('prelevement');
  });

  // Sinon « analyser » ou « resultante » declencheraient a tort, et le
  // garde-fou finirait par etre contourne.
  it('compare des mots entiers, pas des fragments', () => {
    expect(motInterditDans('KENEYA: nous allons analyser votre dossier.')).toBeNull();
    expect(motInterditDans('KENEYA: la resultante du calcul.')).toBeNull();
  });

  it('trouve le mot colle a une ponctuation', () => {
    expect(motInterditDans('KENEYA: vos resultats, disponibles.')).toBe('resultats');
    expect(motInterditDans('KENEYA: (analyse) prete.')).toBe('analyse');
  });

  it('laisse passer un message neutre', () => {
    expect(motInterditDans(messageDeRepli(NOM))).toBeNull();
  });
});

describe('neutraliser', () => {
  const nodeEnv = process.env['NODE_ENV'];
  afterEach(() => {
    process.env['NODE_ENV'] = nodeEnv;
    jest.clearAllMocks();
  });

  it('rend le message tel quel quand il est neutre', () => {
    const m = messageRendezVous(NOM, '12 octobre a 09:00', 'Hopital Donka');
    expect(neutraliser(m)).toBe(m);
  });

  // Hors production, un message fautif doit casser un test ou une execution
  // locale : c'est la que la correction coute le moins cher.
  it('leve hors production, en nommant le mot fautif', () => {
    process.env['NODE_ENV'] = 'test';
    expect(() => neutraliser('KENEYA: vos resultats sont prets.')).toThrow(/resultats/);
    expect(() => neutraliser('KENEYA: vos resultats sont prets.')).toThrow(/EF-11-02/);
  });

  // En production, ne rien envoyer priverait le patient d'une information
  // qu'il attend ; envoyer le message fautif violerait EF-11-02.
  it('remplace et journalise en production, sans lever', () => {
    process.env['NODE_ENV'] = 'production';
    const rendu = neutraliser('KENEYA: vos resultats sont prets.', NOM);
    expect(rendu).toBe(messageDeRepli(NOM));
    expect(motInterditDans(rendu)).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe('les constructeurs rendent tous un message neutre', () => {
  const messages: [string, string][] = [
    ['information patient', messagePatientInformation(NOM)],
    ['repli', messageDeRepli(NOM)],
    ['rendez-vous avec lieu', messageRendezVous(NOM, '12 octobre a 09:00', 'Hopital Donka')],
    ['rendez-vous sans lieu', messageRendezVous(NOM, '12 octobre a 09:00')],
    ['demarche acceptee', messageDemarche(NOM, true, 'Hopital Donka')],
    ['demarche refusee', messageDemarche(NOM, false, 'Hopital Donka')],
    ['professionnel urgent', messageProfessionnelUrgent(NOM, 'DA-2026-000001')],
    ['professionnel intervention', messageProfessionnelIntervention(NOM, 'DA-2026-000001')],
    ['stock critique', messageStockCritique(NOM)],
    ['echeance', messageEcheance(NOM, '12 octobre')],
  ];

  it.each(messages)('%s', (_nom, message) => {
    expect(motInterditDans(message)).toBeNull();
  });

  it('porte toujours le nom de la plateforme, pour qu on sache qui ecrit', () => {
    for (const [, message] of messages) expect(message).toContain(NOM);
  });

  // Un SMS doit tenir en un envoi : au-dela, les operateurs le decoupent et
  // la facture double.
  it('tient dans un SMS de 160 caracteres', () => {
    for (const [nom, message] of messages) {
      expect({ nom, longueur: message.length <= 160 }).toEqual({ nom, longueur: true });
    }
  });
});

// ── Les cinq fuites du 2026-10-02, nommees ───────────────────────────
//
// Elles sont ecrites ici telles qu'elles partaient. Si l'une revient, ce
// fichier la refuse.
describe('regression : les messages qui fuyaient', () => {
  it.each([
    ['analyses prescrites', 'KENEYA: des analyses vous attendent au laboratoire Cece. Consignes et details dans votre espace.'],
    ['prelevement planifie', 'KENEYA: prelevement prevu au laboratoire le 3 octobre. Details dans votre espace.'],
    ['resultat critique au prescripteur', 'KENEYA: RESULTAT CRITIQUE demande DA-2026-000001. Connectez-vous pour accuser lecture.'],
    ['resultats liberes au patient', "KENEYA: vos resultats d'analyses sont disponibles dans votre espace."],
    ['rappel de vaccination', 'KENEYA: rappel — votre vaccination BCG est due le 12 octobre. Contactez votre ASC.'],
  ])('refuse « %s »', (_nom, ancien) => {
    expect(motInterditDans(ancien)).not.toBeNull();
  });
});

// ── L'angle mort du garde-fou, dit explicitement ─────────────────────
//
// Un filtre de vocabulaire ne peut pas attraper ce qui vient de la base : le
// nom d'un produit, le nom d'un etablissement. L'ancienne alerte de stock
// nommait le medicament et **passerait** le controle.
//
// C'est pourquoi les constructeurs existent : ils ne prennent pas ces valeurs
// en parametre, donc elles ne peuvent pas entrer dans le message. Le
// garde-fou reste un filet, pas la premiere defense.
describe('ce que le garde-fou ne peut pas voir', () => {
  it('ne detecte pas un nom de produit, qui vient de la base', () => {
    const ancien = 'KENEYA ALERTE: Stock critique — Paracetamol (3 boite restants).';
    expect(motInterditDans(ancien)).toBeNull();
  });

  // Celui-la est traite dans le constructeur plutot que subi : un nom de lieu
  // revelateur est retire, et le patient le retrouve dans son espace. Un
  // rendez-vous sans lieu reste utile ; un soin annonce par SMS, non.
  it('retire un nom d etablissement revelateur, et garde la date', () => {
    const m = messageRendezVous('KENEYA', '12 octobre', 'Centre de traitement X');
    expect(m).not.toMatch(/traitement/i);
    expect(m).toContain('12 octobre');
    expect(m).toMatch(/dans votre espace/i);
    expect(motInterditDans(m)).toBeNull();
  });

  it('garde un nom d etablissement ordinaire', () => {
    expect(messageRendezVous('KENEYA', '12 octobre', 'Hopital Donka')).toContain('Hopital Donka');
  });

  // « Laboratoire » n'est pas dans la liste : un rendez-vous au laboratoire
  // reste nomme. C'est assume — le nom d'un lieu de prelevement est moins
  // parlant qu'un resultat, et le patient doit savoir ou aller. Si cela doit
  // changer, c'est un libelle public neutre par structure qu'il faut (P11),
  // pas un mot de plus dans la liste.
  it('garde « laboratoire » dans un lieu : choix assume, consigne', () => {
    expect(messageRendezVous('KENEYA', '12 octobre', 'Laboratoire Cece')).toContain('Laboratoire Cece');
  });

  // La seule defense sur ces deux cas est que le constructeur ne recoit pas la
  // valeur. `messageStockCritique` ne prend aucun produit : il ne peut donc
  // pas en nommer un.
  it('le constructeur de stock ne prend aucun produit en parametre', () => {
    expect(messageStockCritique.length).toBe(1);
    expect(messageStockCritique('KENEYA')).not.toMatch(/paracetamol/i);
  });
});
