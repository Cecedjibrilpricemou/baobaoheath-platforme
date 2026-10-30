// La passerelle USSD : le dossier du patient sur un telephone sans internet.
//
// **Deux portes, et il faut les deux.**
//
// 1. *La passerelle.* La route n'a ni cookie ni jeton : c'est l'operateur qui
//    appelle, pas un navigateur. Il signe chaque requete avec un secret
//    partage (HMAC-SHA256, horodate). Sans secret configure, tout est refuse :
//    une passerelle ouverte par oubli de configuration est le cas a eviter.
// 2. *Le patient.* Un numero de telephone ne prouve rien — il se devine, se
//    partage, change de main. Le patient choisit un PIN depuis son espace ;
//    il est demande avant toute donnee et bloque apres cinq echecs.
//
// **Deux donnees ne sortent jamais par ici** : le code QR, qui ouvre le
// dossier a l'accueil, et le motif des rendez-vous, qui est une donnee
// medicale. Un ecran USSD se lit par-dessus l'epaule.
//
// **Aucune reponse ne dit si un numero est connu.** Numero inconnu, patient
// sans PIN, compte bloque, mauvais PIN : meme message. Sinon la passerelle
// servirait a verifier quels numeros sont des patients.
import { createHmac, timingSafeEqual } from 'crypto';
import { UssdSessionStatus } from '../config/generated/client/client';
import { prisma } from '../config/prisma';
import { UnauthorizedError, ValidationError, NotFoundError } from '../utils/app-error';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { getIdentitePlateforme, getValeursParametres } from './parametres.service';

interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text?: string;
}

/** Ecart tolere entre l'horodatage signe et l'horloge du serveur. */
const FENETRE_SIGNATURE_S = 300;
export const PIN_MAX_ECHECS = 5;
const PIN_BLOCAGE_MS = 30 * 60 * 1000;
/** Au-dela, le numero attend : dix sessions par quart d'heure suffisent a un humain. */
export const SESSIONS_MAX_PAR_NUMERO = 10;
const FENETRE_DEBIT_MS = 15 * 60 * 1000;

// ─── 1. La passerelle ─────────────────────────────────────────────────────

/**
 * Lue a l'appel, pas au chargement : un test doit pouvoir la changer, et une
 * cle absente ne doit pas empecher le serveur de demarrer (meme choix que
 * `chapchap.service.ts`).
 */
function configurationUssd() {
  return {
    cleHmac: process.env['USSD_HMAC_KEY'] ?? '',
    ipsAutorisees: (process.env['USSD_ALLOWED_IPS'] ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  };
}

/**
 * Ce que l'operateur signe : l'horodatage et les trois champs utiles, dans cet
 * ordre, separes par des points. Signer des champs plutot que le corps brut
 * evite de dependre de la serialisation JSON de l'operateur.
 */
export function chaineASigner(horodatage: string, corps: Partial<UssdRequest>): string {
  return `${horodatage}.${corps.sessionId ?? ''}.${corps.phoneNumber ?? ''}.${corps.text ?? ''}`;
}

export type VerdictPasserelle = 'ok' | 'refusee' | 'non-configuree';

export function verifierPasserelleUssd(entree: {
  horodatage: string;
  signature: string;
  ip: string | undefined;
  corps: Partial<UssdRequest>;
  maintenant?: number;
}): VerdictPasserelle {
  const { cleHmac, ipsAutorisees } = configurationUssd();
  if (!cleHmac) return 'non-configuree';

  if (ipsAutorisees.length > 0) {
    // Express ecrit une IPv4 vue en IPv6 sous la forme ::ffff:a.b.c.d.
    const ip = (entree.ip ?? '').replace(/^::ffff:/, '');
    if (!ipsAutorisees.includes(ip)) return 'refusee';
  }

  const secondes = Number(entree.horodatage);
  const maintenant = Math.floor((entree.maintenant ?? Date.now()) / 1000);
  if (!Number.isInteger(secondes) || Math.abs(maintenant - secondes) > FENETRE_SIGNATURE_S) {
    return 'refusee';
  }

  // Une signature non hexadecimale ou de mauvaise longueur ferait lever
  // `timingSafeEqual` : on la refuse avant.
  if (!/^[0-9a-f]{64}$/i.test(entree.signature)) return 'refusee';
  const attendue = createHmac('sha256', cleHmac)
    .update(chaineASigner(entree.horodatage, entree.corps))
    .digest();
  const recue = Buffer.from(entree.signature.toLowerCase(), 'hex');
  return timingSafeEqual(attendue, recue) ? 'ok' : 'refusee';
}

// ─── 2. Le patient ────────────────────────────────────────────────────────

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, '');
}

function con(message: string) {
  return { response: `CON ${message}`, end: false };
}

function end(message: string) {
  return { response: `END ${message}`, end: true };
}

const MENU = ['1. Mon profil', '2. Mes rendez-vous', '3. Mes vaccins', '4. Mes factures', '0. Quitter'];

export async function handleUssdRequest(input: UssdRequest) {
  const telephone = normalizePhone(input.phoneNumber);
  // Le texte cumule les saisies : « PIN*choix ». Le PIN est toujours le premier.
  const [pin, ...choix] = (input.text ?? '').split('*').filter(Boolean);
  const choice = choix.at(-1);

  const { nomCourt } = await getIdentitePlateforme();
  const refus = end(`${nomCourt}: code PIN incorrect ou service non active. Le code se choisit dans votre espace patient.`);

  // Le debit se compte **avant** toute ecriture : un numero qui inonde la
  // passerelle ne doit pas, en plus, remplir la table des sessions.
  const sessionsRecentes = await prisma.ussdSession.count({
    where: {
      telephone,
      creeLe: { gte: new Date(Date.now() - FENETRE_DEBIT_MS) },
      NOT: { id: input.sessionId },
    },
  });
  if (sessionsRecentes >= SESSIONS_MAX_PAR_NUMERO) {
    return end(`${nomCourt}: trop de tentatives. Reessayez dans quinze minutes.`);
  }

  // Le hache du PIN est exclu de toutes les requetes par defaut
  // (`OMISSIONS_GLOBALES`, config/prisma.ts) : seule la passerelle le demande.
  const utilisateur = await prisma.utilisateur.findFirst({
    where: { telephone },
    include: { patientProfile: { omit: { pinUssdHash: false } } },
  });

  const { sync } = await getValeursParametres();
  const expireLe = new Date(Date.now() + sync.ussdTimeoutSecondes * 1000);
  // **Jamais le PIN** dans ce qui est enregistre : seulement les choix de menu.
  const donnees = { choix };
  await prisma.ussdSession.upsert({
    where: { id: input.sessionId },
    update: { telephone, expireLe, donnees },
    create: { id: input.sessionId, telephone, expireLe, donnees },
  });

  if (!pin) {
    return con(`${nomCourt}\nEntrez votre code PIN :`);
  }

  const profil = utilisateur?.patientProfile;
  if (!utilisateur || !profil?.pinUssdHash) {
    await finish(input.sessionId);
    return refus;
  }
  if (profil.pinUssdBloqueJusqua && profil.pinUssdBloqueJusqua > new Date()) {
    await finish(input.sessionId);
    return refus;
  }

  if (!(await verifyPassword(pin, profil.pinUssdHash))) {
    const echecs = profil.pinUssdEchecs + 1;
    await prisma.patientProfile.update({
      where: { id: profil.id },
      data: {
        pinUssdEchecs: echecs,
        ...(echecs >= PIN_MAX_ECHECS ? { pinUssdBloqueJusqua: new Date(Date.now() + PIN_BLOCAGE_MS) } : {}),
      },
    });
    await finish(input.sessionId);
    return refus;
  }

  if (profil.pinUssdEchecs > 0 || profil.pinUssdBloqueJusqua) {
    await prisma.patientProfile.update({
      where: { id: profil.id },
      data: { pinUssdEchecs: 0, pinUssdBloqueJusqua: null },
    });
  }
  // L'utilisateur n'est rattache a la session qu'une fois le PIN verifie.
  await prisma.ussdSession.update({
    where: { id: input.sessionId },
    data: { idUtilisateur: utilisateur.id },
  }).catch(() => undefined);

  if (!choice) {
    return con([nomCourt, ...MENU].join('\n'));
  }

  if (choice === '0') {
    await finish(input.sessionId);
    return end(`Merci d avoir utilise ${nomCourt}.`);
  }

  if (choice === '1') {
    await finish(input.sessionId);
    return end(`Profil: ${utilisateur.prenom} ${utilisateur.nom}\nPrefecture: ${profil.prefecture}`);
  }

  if (choice === '2') {
    const rdvs = await prisma.rendezVous.findMany({
      where: { idPatient: profil.id, prevuLe: { gte: new Date() } },
      take: 3,
      orderBy: { prevuLe: 'asc' },
      select: { prevuLe: true },
    });
    await finish(input.sessionId);
    if (rdvs.length === 0) return end('Aucun rendez-vous a venir.');
    return end(rdvs.map((rdv) => `Rendez-vous le ${rdv.prevuLe.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`).join('\n'));
  }

  if (choice === '3') {
    const vaccins = await prisma.vaccination.findMany({
      where: { idPatient: profil.id },
      take: 5,
      orderBy: { administreLe: 'desc' },
    });
    await finish(input.sessionId);
    if (vaccins.length === 0) return end('Aucun vaccin enregistre.');
    return end(vaccins.map((vaccin) => `${vaccin.vaccinNom} - ${vaccin.administreLe.toLocaleDateString('fr-FR')}`).join('\n'));
  }

  if (choice === '4') {
    const factures = await prisma.facture.findMany({
      where: { idPatient: profil.id },
      take: 3,
      orderBy: { creeLe: 'desc' },
    });
    await finish(input.sessionId);
    if (factures.length === 0) return end('Aucune facture enregistree.');
    return end(factures.map((facture) => `${facture.montantGnf} GNF - ${facture.statut}`).join('\n'));
  }

  return con(['Choix invalide.', ...MENU].join('\n'));
}

async function finish(sessionId: string) {
  await prisma.ussdSession.update({
    where: { id: sessionId },
    data: { statut: UssdSessionStatus.TERMINEE },
  }).catch(() => undefined);
}

export async function expirerSessionsUssd() {
  return prisma.ussdSession.updateMany({
    where: { statut: UssdSessionStatus.ACTIVE, expireLe: { lt: new Date() } },
    data: { statut: UssdSessionStatus.EXPIREE },
  });
}

// ─── 3. Le choix du PIN ───────────────────────────────────────────────────

/**
 * Les PIN qu'un attaquant essaie en premier : chiffres repetes et suites.
 * Avec cinq essais avant blocage, les laisser passer revient a ne pas en avoir.
 */
export function pinEstTrivial(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const chiffres = [...pin].map(Number);
  const pas = chiffres.slice(1).map((c, i) => c - chiffres[i]!);
  return pas.every((p) => p === 1) || pas.every((p) => p === -1);
}

/**
 * Le patient choisit (ou change) son PIN. **Le mot de passe du compte est
 * exige** : une session laissee ouverte sur un telephone ne doit pas suffire
 * a poser un PIN qui ouvrira ensuite le dossier par USSD.
 */
export async function definirPinUssd(userId: string, dto: { pin: string; motDePasse: string }): Promise<void> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    include: { patientProfile: true },
  });
  if (!utilisateur?.patientProfile) throw new NotFoundError('Profil patient introuvable');
  if (!(await verifyPassword(dto.motDePasse, utilisateur.motDePasseHash))) {
    throw new UnauthorizedError('Mot de passe incorrect');
  }
  if (!/^\d{4}$/.test(dto.pin)) throw new ValidationError('Le code PIN doit contenir 4 chiffres');
  if (pinEstTrivial(dto.pin)) {
    throw new ValidationError('Ce code est trop facile a deviner : evitez les chiffres repetes et les suites');
  }

  await prisma.patientProfile.update({
    where: { id: utilisateur.patientProfile.id },
    data: { pinUssdHash: await hashPassword(dto.pin), pinUssdEchecs: 0, pinUssdBloqueJusqua: null },
  });
}
