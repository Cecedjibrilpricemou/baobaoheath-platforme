// src/services/parametres.service.ts
// Parametres globaux de la plateforme, edites par le SUPER_ADMIN.
//
// Une seule ligne en base (id = "global"), stockee en JSON. Les defauts
// ci-dessous font foi : un parametre absent de la ligne (ajoute apres coup,
// ou ligne jamais creee) prend sa valeur par defaut. Les consommateurs
// (analytics, paiements, USSD) passent par getValeursParametres(), qui est
// mis en cache : la page Parametres est lue a chaque appel sensible, elle ne
// doit pas couter une requete SQL a chaque fois.
import { Prisma } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { cacheDel, withCache } from '../utils/cache';
import type {
  ParametresSystemeValeurs,
  ParametresSystemeView,
  UpdateParametresSystemeDto,
} from '@baobaoheath/shared-types';

const ID_GLOBAL = 'global';
const CACHE_KEY = 'parametres:systeme';
const CACHE_TTL_SECONDES = 60;

export const PARAMETRES_PAR_DEFAUT: ParametresSystemeValeurs = {
  facturation: {
    paiementEspeces: true,
    paiementOrangeMoney: true,
    paiementMomo: false,
    margePct: 15,
  },
  securite: {
    consentementDefaut: true,
  },
  alertes: {
    // Alignes sur les seuils historiques d'analytics.service.ts
    seuilPaludisme: 20,
    seuilEbola: 1,
    activerIA: true,
  },
  sync: {
    offlineMode: true,
    frequenceMinutes: 30,
    ussdTimeoutSecondes: 600,
  },
};

type Section = keyof ParametresSystemeValeurs;
const SECTIONS = Object.keys(PARAMETRES_PAR_DEFAUT) as Section[];

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fusionne des valeurs partielles (JSON en base ou DTO de mise a jour) avec
 * une base complete. Seules les cles connues des defauts sont conservees :
 * une cle inconnue en base (parametre retire) disparait silencieusement.
 */
export function fusionnerParametres(
  base: ParametresSystemeValeurs,
  partiel: unknown,
): ParametresSystemeValeurs {
  const resultat = {} as ParametresSystemeValeurs;
  const source = estObjet(partiel) ? partiel : {};

  for (const section of SECTIONS) {
    const sectionSource = estObjet(source[section]) ? source[section] : {};
    const sectionBase = base[section] as unknown as Record<string, unknown>;
    const fusion: Record<string, unknown> = {};
    for (const cle of Object.keys(sectionBase)) {
      const valeur = sectionSource[cle];
      fusion[cle] = valeur === undefined ? sectionBase[cle] : valeur;
    }
    (resultat as Record<Section, unknown>)[section] = fusion;
  }

  return resultat;
}

async function lireLigne() {
  return prisma.parametresSysteme.findUnique({ where: { id: ID_GLOBAL } });
}

/** Valeurs completes, pour les consommateurs internes (mises en cache). */
export async function getValeursParametres(): Promise<ParametresSystemeValeurs> {
  return withCache(CACHE_KEY, CACHE_TTL_SECONDES, async () => {
    const ligne = await lireLigne();
    return fusionnerParametres(PARAMETRES_PAR_DEFAUT, ligne?.valeurs);
  });
}

/** GET /admin-structure/parametres */
export async function getParametres(): Promise<ParametresSystemeView> {
  const ligne = await lireLigne();
  return {
    ...fusionnerParametres(PARAMETRES_PAR_DEFAUT, ligne?.valeurs),
    modifieLe: ligne?.modifieLe ?? null,
    idModifiePar: ligne?.idModifiePar ?? null,
  };
}

/** PUT /admin-structure/parametres — mise a jour partielle, section par section. */
export async function modifierParametres(
  userId: string,
  dto: UpdateParametresSystemeDto,
): Promise<ParametresSystemeView> {
  const ligne = await lireLigne();
  const actuelles = fusionnerParametres(PARAMETRES_PAR_DEFAUT, ligne?.valeurs);
  const valeurs = fusionnerParametres(actuelles, dto);

  const valeursJson = valeurs as unknown as Prisma.InputJsonValue;
  const sauvegarde = await prisma.parametresSysteme.upsert({
    where: { id: ID_GLOBAL },
    create: { id: ID_GLOBAL, valeurs: valeursJson, idModifiePar: userId },
    update: { valeurs: valeursJson, idModifiePar: userId },
  });

  await cacheDel(CACHE_KEY);

  return {
    ...valeurs,
    modifieLe: sauvegarde.modifieLe,
    idModifiePar: sauvegarde.idModifiePar,
  };
}
