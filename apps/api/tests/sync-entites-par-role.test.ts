// Ce que chaque metier peut ecrire hors ligne.
//
// **Le canal de synchronisation etait generique.** `POST /sync/push` aiguille
// sur un `entityType` qui est une chaine libre, vers cinq ecritures :
// `PatientProfile`, `Consultation`, `ConstantesVitales`, `Vaccination` et
// `Stock`. Tout role admis sur la route pouvait pousser n'importe lequel.
//
// Le pharmacien y figure pour remonter son stock. Il pouvait donc aussi creer
// une consultation, des constantes vitales ou une vaccination -- une ecriture
// au dossier medical par un metier qui n'a pas de role medical. Et le
// perimetre patient ne l'arretait pas : avant correction, il retenait tout
// patient ayant une ordonnance en attente, n'importe ou dans le pays.
//
// Une ecriture au dossier n'est pas une question de perimetre mais de droit :
// la table des entites par role le dit une fois, pour tous les types a venir.
jest.mock('../src/config/prisma', () => ({ prisma: {} }));
jest.mock('../src/config/redis', () => ({ getRedis: () => null }));

import { applyMutation, assertEntiteAutorisee } from '../src/services/sync.service';
import { ForbiddenError } from '../src/utils/app-error';
import type { JwtPayload } from '../src/types/auth.types';

const qui = (role: string) => ({ userId: `u-${role}`, role, sessionId: 's' }) as unknown as JwtPayload;

/** Les quatre ecritures qui touchent au dossier du patient. */
const MEDICAL = ['PatientProfile', 'Consultation', 'ConstantesVitales', 'Vaccination'];

describe('le pharmacien hors ligne', () => {
  // Il est admis sur cette route pour une seule raison : remonter son stock.
  it.each(MEDICAL)('ne peut pas ecrire %s', (entite) => {
    expect(() => assertEntiteAutorisee(qui('PHARMACIEN'), entite)).toThrow(ForbiddenError);
  });

  it('peut ecrire Stock', () => {
    expect(() => assertEntiteAutorisee(qui('PHARMACIEN'), 'Stock')).not.toThrow();
  });
});

describe('l administrateur de structure hors ligne', () => {
  // Il administre, il ne soigne pas.
  it.each(MEDICAL)('ne peut pas ecrire %s', (entite) => {
    expect(() => assertEntiteAutorisee(qui('ADMIN_STRUCTURE'), entite)).toThrow(ForbiddenError);
  });

  it('peut ecrire Stock', () => {
    expect(() => assertEntiteAutorisee(qui('ADMIN_STRUCTURE'), 'Stock')).not.toThrow();
  });
});

describe('le patient hors ligne', () => {
  // Sa propre fiche, et rien d'autre. Le perimetre patient la borne deja a la
  // sienne : ce garde-ci borne le type, pas la personne.
  it('peut ecrire son profil', () => {
    expect(() => assertEntiteAutorisee(qui('PATIENT'), 'PatientProfile')).not.toThrow();
  });

  it.each(['Consultation', 'ConstantesVitales', 'Vaccination', 'Stock'])(
    'ne peut pas ecrire %s',
    (entite) => {
      expect(() => assertEntiteAutorisee(qui('PATIENT'), entite)).toThrow(ForbiddenError);
    },
  );
});

describe('ceux pour qui le mode hors ligne existe', () => {
  // L'agent de sante communautaire travaille ou le reseau n'arrive pas : son
  // paquet d'actes doit rester entier, sinon la correction casse son metier.
  it.each(MEDICAL)('l ASC peut ecrire %s', (entite) => {
    expect(() => assertEntiteAutorisee(qui('ASC'), entite)).not.toThrow();
  });

  it.each(MEDICAL)('le superviseur ASC peut ecrire %s', (entite) => {
    expect(() => assertEntiteAutorisee(qui('ASC_SUPERVISOR'), entite)).not.toThrow();
  });

  it.each(MEDICAL)('le medecin peut ecrire %s', (entite) => {
    expect(() => assertEntiteAutorisee(qui('MEDECIN'), entite)).not.toThrow();
  });

  it('mais l ASC ne remonte pas de stock d officine', () => {
    expect(() => assertEntiteAutorisee(qui('ASC'), 'Stock')).toThrow(ForbiddenError);
  });
});

describe('les cas qui ne doivent jamais passer', () => {
  it('un type inconnu, quel que soit le role', () => {
    expect(() => assertEntiteAutorisee(qui('ASC'), 'Facture')).toThrow(ForbiddenError);
    expect(() => assertEntiteAutorisee(qui('MEDECIN'), 'Ordonnance')).toThrow(ForbiddenError);
  });

  // **Un role absent de la table n'herite de rien.** Si un role est ajoute a
  // la route sans etre ajoute ici, il ne peut rien ecrire -- le defaut va vers
  // le refus, pas vers la permission.
  it.each(['LIVREUR', 'ASSUREUR', 'TECHNICIEN_LABO', 'AGENT_ACCUEIL', 'SUPER_ADMIN'])(
    'un role non inscrit (%s) ne peut rien ecrire',
    (role) => {
      for (const entite of [...MEDICAL, 'Stock']) {
        expect(() => assertEntiteAutorisee(qui(role), entite)).toThrow(ForbiddenError);
      }
    },
  );
});

// **Le garde doit etre branche, pas seulement juste.**
//
// Le premier jet de ce fichier n'appelait que `assertEntiteAutorisee` : on
// pouvait retirer son appel du dispatcheur sans qu'aucun test ne bronche. Ces
// deux-la passent par `applyMutation`, qui est le chemin reel.
describe('le dispatcheur applique bien le garde', () => {
  it('refuse une consultation poussee par un pharmacien', async () => {
    await expect(applyMutation(qui('PHARMACIEN'), {
      clientMutationId: 'cm-0000000001',
      entityType: 'Consultation',
      operation: 'CREATE',
      payload: {},
    } as never)).rejects.toThrow(ForbiddenError);
  });

  // Le refus tombe avant toute lecture du contenu : sinon le message d'erreur
  // renseignerait sur ce qu'on aurait pu ecrire.
  it('refuse avant de regarder le payload', async () => {
    await expect(applyMutation(qui('PATIENT'), {
      clientMutationId: 'cm-0000000002',
      entityType: 'Vaccination',
      operation: 'CREATE',
      payload: { nimporte: 'quoi' },
    } as never)).rejects.toThrow(/role ne peut pas synchroniser/i);
  });
});
