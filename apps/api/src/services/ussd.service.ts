import { UssdSessionStatus } from '../config/generated/client/client';
import { prisma } from '../config/prisma';

interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text?: string;
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, '');
}

function con(message: string) {
  return { response: `CON ${message}`, end: false };
}

function end(message: string) {
  return { response: `END ${message}`, end: true };
}

export async function handleUssdRequest(input: UssdRequest) {
  const telephone = normalizePhone(input.phoneNumber);
  const selections = (input.text ?? '').split('*').filter(Boolean);
  const choice = selections.at(-1);

  const utilisateur = await prisma.utilisateur.findFirst({
    where: { telephone },
    include: {
      patientProfile: true,
    },
  });

  const expireLe = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.ussdSession.upsert({
    where: { id: input.sessionId },
    update: {
      telephone,
      expireLe,
      idUtilisateur: utilisateur?.id,
      donnees: { text: input.text ?? '', selections },
    },
    create: {
      id: input.sessionId,
      telephone,
      expireLe,
      idUtilisateur: utilisateur?.id,
      donnees: { text: input.text ?? '', selections },
    },
  });

  if (!utilisateur?.patientProfile) {
    await finish(input.sessionId);
    return end('BaoBaoHealth: numero non associe a un patient. Contactez votre ASC.');
  }

  if (!choice) {
    return con([
      'BaoBaoHealth',
      '1. Mon profil',
      '2. Mes rendez-vous',
      '3. Mes vaccins',
      '4. Mes factures',
      '0. Quitter',
    ].join('\n'));
  }

  if (choice === '0') {
    await finish(input.sessionId);
    return end('Merci d avoir utilise BaoBaoHealth.');
  }

  if (choice === '1') {
    await finish(input.sessionId);
    return end(`Profil: ${utilisateur.prenom} ${utilisateur.nom}\nQR: ${utilisateur.patientProfile.qrCode}\nPrefecture: ${utilisateur.patientProfile.prefecture}`);
  }

  if (choice === '2') {
    const rdvs = await prisma.rendezVous.findMany({
      where: { idPatient: utilisateur.patientProfile.id, prevuLe: { gte: new Date() } },
      take: 3,
      orderBy: { prevuLe: 'asc' },
    });
    await finish(input.sessionId);
    if (rdvs.length === 0) return end('Aucun rendez-vous a venir.');
    return end(rdvs.map((rdv) => `${rdv.prevuLe.toLocaleDateString('fr-FR')} - ${rdv.motif ?? 'Consultation'}`).join('\n'));
  }

  if (choice === '3') {
    const vaccins = await prisma.vaccination.findMany({
      where: { idPatient: utilisateur.patientProfile.id },
      take: 5,
      orderBy: { administreLe: 'desc' },
    });
    await finish(input.sessionId);
    if (vaccins.length === 0) return end('Aucun vaccin enregistre.');
    return end(vaccins.map((vaccin) => `${vaccin.vaccinNom} - ${vaccin.administreLe.toLocaleDateString('fr-FR')}`).join('\n'));
  }

  if (choice === '4') {
    const factures = await prisma.facture.findMany({
      where: { idPatient: utilisateur.patientProfile.id },
      take: 3,
      orderBy: { creeLe: 'desc' },
    });
    await finish(input.sessionId);
    if (factures.length === 0) return end('Aucune facture enregistree.');
    return end(factures.map((facture) => `${facture.montantGnf} GNF - ${facture.statut}`).join('\n'));
  }

  return con('Choix invalide.\n1. Profil\n2. Rendez-vous\n3. Vaccins\n4. Factures\n0. Quitter');
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
