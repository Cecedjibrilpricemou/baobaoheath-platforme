// Preuve que la fusion de dossiers est **reellement** reversible (EF-01-06).
//
//     npx tsx scripts/prouver-fusion-reversible.mts
//
// A lancer depuis `apps/api`, contre une base de developpement. Le script cree
// ses propres dossiers, marques ZZFUSION, et les supprime a la fin — y compris
// si une verification echoue.
//
// **Pourquoi ce n'est pas un test Jest.** La reversibilite ne tient pas a une
// fonction : elle tient a une transaction, a onze tables, a une contrainte
// d'unicite sur les consentements et a un declencheur PostgreSQL. Des mocks
// diraient que tout va bien quoi qu'il arrive. On compare donc deux
// photographies de la base, prises avant la fusion et apres son annulation.
//
// Les quinze sabotages du service du 2026-10-04 ont tous ete attrapes : sept
// par les cas unitaires, huit par ce script seul.

import { config } from 'dotenv';
config({ path: '.env' });

import { prisma } from '../src/config/prisma';
import * as fusion from '../src/services/fusion.service';
import * as identite from '../src/services/identite.service';
import * as doublon from '../src/services/doublon.service';
import * as patients from '../src/services/patient.service';

const echecs: string[] = [];
const verifier = (ok: boolean, m: string) => {
  console.log((ok ? '   ok    ' : '   ECHEC ') + m);
  if (!ok) echecs.push(m);
};

const MARQUE = 'ZZFUSION';

/** Tout ce qui pend a un dossier, trie, pour pouvoir comparer deux etats. */
async function photo(id: string) {
  const [consultations, vaccinations, factures, episodes, consentements, rdv, demandes] =
    await Promise.all([
      prisma.consultation.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.vaccination.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.facture.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.episodeSoins.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.consentementPatient.findMany({
        where: { idPatient: id },
        select: { id: true, scope: true, actif: true, retireLe: true },
        orderBy: { scope: 'asc' },
      }),
      prisma.rendezVous.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.demandeRgpd.findMany({ where: { idPatient: id }, select: { id: true }, orderBy: { id: 'asc' } }),
    ]);
  const p = await prisma.patientProfile.findUnique({
    where: { id }, select: { idFusionneDans: true, fusionneLe: true },
  });
  return JSON.stringify({
    consultations: consultations.map((x) => x.id),
    vaccinations: vaccinations.map((x) => x.id),
    factures: factures.map((x) => x.id),
    episodes: episodes.map((x) => x.id),
    rdv: rdv.map((x) => x.id),
    demandes: demandes.map((x) => x.id),
    consentements: consentements.map((c) => `${c.scope}:${c.actif}:${c.retireLe ? 'retire' : '-'}`),
    fusionne: p?.idFusionneDans ? 'oui' : 'non',
  }, null, 1);
}

async function creerDossier(suffixe: string) {
  const u = await prisma.utilisateur.create({
    data: {
      telephone: `7999000${suffixe}`, prenom: MARQUE, nom: `Test${suffixe}`,
      motDePasseHash: 'x', role: 'PATIENT', estActif: true, langue: 'fr',
    },
    select: { id: true },
  });
  const p = await prisma.patientProfile.create({
    data: {
      idUtilisateur: u.id, dateNaissance: new Date('2000-01-01'), sexe: 'M',
      prefecture: 'Mamou',
    },
    select: { id: true },
  });
  return { idUtilisateur: u.id, id: p.id };
}

const agent = await prisma.utilisateur.findFirstOrThrow({
  where: { role: { in: ['ADMIN_STRUCTURE', 'SUPER_ADMIN'] }, estActif: true },
  select: { id: true, prenom: true, nom: true, role: true },
});
console.log(`agent : ${agent.prenom} ${agent.nom} (${agent.role})\n`);

const A = await creerDossier('1');
const B = await creerDossier('2');
console.log(`dossiers de test : A=${A.id}  B=${B.id}`);

try {
  // ── De quoi faire bouger quelque chose ──────────────────────────────
  const structure = await prisma.structureSante.findFirstOrThrow({ select: { id: true } });

  for (const [dossier, n] of [[A, 2], [B, 3]] as const) {
    for (let i = 0; i < n; i++) {
      await prisma.vaccination.create({
        data: { idPatient: dossier.id, vaccinNom: `${MARQUE}-${i}`, idAdministrePar: agent.id },
      });
    }
    await prisma.episodeSoins.create({
      data: {
        idPatient: dossier.id, idStructure: structure.id,
        motif: `${MARQUE} motif`, idOuvertPar: agent.id,
        numero: `${MARQUE}-${dossier.id.slice(-6)}`,
      },
    });
  }

  // Les consentements : c'est la que se joue le desaccord.
  //   - DOSSIER_MEDICAL : A autorise, B refuse   -> le refus doit gagner
  //   - RECHERCHE_ANONYMISEE : A refuse, B autorise -> rien ne s'elargit
  //   - RAPPELS_SMS : A n'a rien dit, B autorise -> la ligne de B rejoint A
  const auteur = { userId: agent.id };
  const poser = (idPatient: string, scope: string, actif: boolean) =>
    prisma.consentementPatient.create({
      data: {
        idPatient, scope: scope as never, actif,
        retireLe: actif ? null : new Date(), idUtilisateur: agent.id,
      },
    });
  await poser(A.id, 'DOSSIER_MEDICAL', true);
  await poser(B.id, 'DOSSIER_MEDICAL', false);
  await poser(A.id, 'RECHERCHE_ANONYMISEE', false);
  await poser(B.id, 'RECHERCHE_ANONYMISEE', true);
  await poser(B.id, 'RAPPELS_SMS', true);

  const avantA = await photo(A.id);
  const avantB = await photo(B.id);
  console.log('\n── Avant la fusion ────────────────────────────────────────');
  console.log('   A :', avantA.replace(/\s+/g, ' ').slice(0, 200));
  console.log('   B :', avantB.replace(/\s+/g, ' ').slice(0, 200));

  // ── La fusion ───────────────────────────────────────────────────────
  console.log('\n── La fusion ──────────────────────────────────────────────');
  const r = await fusion.fusionner(auteur, A.id, B.id, 'Meme personne, verifie sur la piece');
  if ('refus' in r) throw new Error(`fusion refusee : ${r.refus}`);
  const f = r.fusion;
  console.log('  ', f.lignes.map((l) => `${l.tableCible} ${l.operation} x${l.nombre}`).join('\n   '));

  const apresA = await photo(A.id);
  const apresB = await photo(B.id);

  const vaccA = JSON.parse(apresA).vaccinations.length;
  verifier(vaccA === 5, `les 3 vaccinations de B ont rejoint les 2 de A (${vaccA})`);
  verifier(JSON.parse(apresB).vaccinations.length === 0, 'B n en garde aucune');
  verifier(JSON.parse(apresB).fusionne === 'oui', 'B porte le lien de fusion');
  verifier(JSON.parse(apresA).fusionne === 'non', 'A ne le porte pas');

  const consA = JSON.parse(apresA).consentements as string[];
  console.log('   consentements de A apres fusion :', consA.join('  '));
  verifier(consA.includes('DOSSIER_MEDICAL:false:retire'),
    'le refus de B l emporte sur l autorisation de A');
  verifier(consA.includes('RECHERCHE_ANONYMISEE:false:retire'),
    'et l autorisation de B n elargit pas le refus de A');
  verifier(consA.some((c) => c.startsWith('RAPPELS_SMS:true')),
    'l usage dont A n avait rien dit rejoint A tel quel');

  const restrictions = f.lignes.filter((l) => l.operation === 'RESTRICTION_CONSENTEMENT');
  verifier(restrictions.length === 1 && restrictions[0]!.nombre === 1,
    'une seule restriction est enregistree — celle qui a reellement change une ligne');

  // ── L'annulation ────────────────────────────────────────────────────
  console.log('\n── L annulation ───────────────────────────────────────────');
  const a = await fusion.annuler(auteur, f.id, 'Erreur : ce sont deux freres');
  if ('refus' in a) throw new Error(`annulation refusee : ${a.refus}`);
  verifier(a.fusion.statut === 'ANNULEE', 'la fusion est marquee annulee');

  const refaitA = await photo(A.id);
  const refaitB = await photo(B.id);

  // **C'est ici que se joue tout le bloc.**
  verifier(refaitA === avantA, 'le dossier A est exactement comme avant la fusion');
  verifier(refaitB === avantB, 'le dossier B est exactement comme avant la fusion');
  if (refaitA !== avantA) {
    console.log('   avant :', avantA.replace(/\s+/g, ' '));
    console.log('   apres :', refaitA.replace(/\s+/g, ' '));
  }
  if (refaitB !== avantB) {
    console.log('   avant :', avantB.replace(/\s+/g, ' '));
    console.log('   apres :', refaitB.replace(/\s+/g, ' '));
  }

  // ── Ce qui est arrive apres la fusion reste au survivant ────────────
  console.log('\n── Ce qui arrive apres la fusion ──────────────────────────');
  const r2 = await fusion.fusionner(auteur, A.id, B.id, 'Deuxieme essai, meme personne');
  if ('refus' in r2) throw new Error(`seconde fusion refusee : ${r2.refus}`);
  const nouvelle = await prisma.vaccination.create({
    data: { idPatient: A.id, vaccinNom: `${MARQUE}-apres`, idAdministrePar: agent.id },
  });
  const a2 = await fusion.annuler(auteur, r2.fusion.id, 'On defait, encore une fois');
  if ('refus' in a2) throw new Error(`annulation refusee : ${a2.refus}`);
  const restee = await prisma.vaccination.findUnique({
    where: { id: nouvelle.id }, select: { idPatient: true },
  });
  verifier(restee?.idPatient === A.id,
    'une ligne ajoutee apres la fusion reste au dossier survivant');

  // ── Le refus qui protege le plus ────────────────────────────────────
  console.log('\n── Deux pieces differentes ────────────────────────────────');
  // La contrainte `patients_identite_verifiee_fondee` refuse une identite
  // verifiee sans piece nommee : il faut donc tout poser d'un coup, et non
  // passer en VERIFIEE puis ajouter le numero. Elle fait exactement ce pour
  // quoi elle a ete ecrite.
  const verifier_ = (id: string, numero: string) => prisma.patientProfile.update({
    where: { id },
    data: {
      niveauIdentite: 'VERIFIEE', typePiece: 'CARTE_NATIONALE',
      lieuNaissance: 'Mamou', identiteVerifieeLe: new Date(), numeroPiece: numero,
    },
  });
  await verifier_(A.id, 'ZZ-AAA-111');
  await verifier_(B.id, 'ZZ-BBB-222');
  const r3 = await fusion.fusionner(auteur, A.id, B.id, 'Elles se ressemblent beaucoup');
  verifier('refus' in r3 && r3.refus === 'DEUX_PIECES_DIFFERENTES',
    'deux identites verifiees sur deux pieces differentes : refuse');

  // ── Suivre le lien ──────────────────────────────────────────────────
  console.log('\n── L ancienne carte continue de fonctionner ───────────────');
  await prisma.patientProfile.update({ where: { id: B.id }, data: { numeroPiece: 'ZZ-AAA-111' } });
  const r4 = await fusion.fusionner(auteur, A.id, B.id, 'Meme piece, meme personne');
  if ('refus' in r4) throw new Error(`fusion refusee : ${r4.refus}`);
  verifier(await fusion.resoudre(B.id) === A.id,
    'le dossier absorbe renvoie vers celui qui survit');
  verifier(await fusion.resoudre(A.id) === A.id,
    'et le survivant renvoie vers lui-meme');

  // Le vrai chemin de lecture, pas seulement la fonction qui le porte.
  const qrB = (await prisma.patientProfile.findUniqueOrThrow({
    where: { id: B.id }, select: { qrCode: true },
  })).qrCode;
  // Un ADMIN_STRUCTURE n'a acces qu'aux dossiers de sa structure : ces deux
  // dossiers jetables n'y sont rattaches a rien. On passe donc par un compte
  // national, dont c'est le role de tout voir — le controle d'acces fait son
  // travail, ce n'est pas lui qu'on teste ici.
  const national = await prisma.utilisateur.findFirstOrThrow({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN_NATIONAL'] }, estActif: true },
    select: { id: true, role: true },
  });
  const parQr = await patients.getPatientByQrCode(
    { userId: national.id, role: national.role, sessionId: 'preuve' } as never, qrB);
  verifier(parQr.id === A.id,
    'presenter l ancienne carte amene au dossier qui survit, pas a un dossier vide');

  // Le dossier absorbe n'a plus rien a faire dans la liste de travail.
  const liste = await identite.rechercher({});
  verifier(!liste.some((p) => p.id === B.id),
    'le dossier absorbe sort de la liste de l accueil');
  verifier(liste.some((p) => p.id === A.id), 'le dossier survivant y reste');

  // Et il ne doit plus etre propose comme doublon, indefiniment.
  const cands = await doublon.pourPatient(A.id);
  verifier(!(cands ?? []).some((c) => c.id === B.id),
    'il n est plus propose comme doublon du dossier qui l a absorbe');

  await fusion.annuler(auteur, r4.fusion.id, 'Nettoyage de fin de test');

  const listeApres = await identite.rechercher({});
  verifier(listeApres.some((p) => p.id === B.id),
    'et il revient dans la liste quand la fusion est annulee');
} finally {
  console.log('\n── Nettoyage ──────────────────────────────────────────────');
  const fusions = await prisma.fusionDossier.findMany({
    where: { OR: [{ idPrincipal: A.id }, { idAbsorbe: A.id }] }, select: { id: true },
  });
  await prisma.ligneFusion.deleteMany({ where: { idFusion: { in: fusions.map((x) => x.id) } } });
  await prisma.fusionDossier.deleteMany({ where: { id: { in: fusions.map((x) => x.id) } } });
  for (const d of [A, B]) {
    await prisma.patientProfile.update({
      where: { id: d.id }, data: { idFusionneDans: null, fusionneLe: null },
    });
  }
  for (const d of [A, B]) {
    await prisma.consentementPatient.deleteMany({ where: { idPatient: d.id } });
    await prisma.vaccination.deleteMany({ where: { idPatient: d.id } });
    await prisma.episodeSoins.deleteMany({ where: { idPatient: d.id } });
    await prisma.patientProfile.delete({ where: { id: d.id } });
    await prisma.utilisateur.delete({ where: { id: d.idUtilisateur } });
  }
  const reste = await prisma.utilisateur.count({ where: { prenom: MARQUE } });
  console.log(`   dossiers de test restants : ${reste}`);
  await prisma.$disconnect();
}

if (echecs.length) {
  console.log('\nECHECS :');
  echecs.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('\nTOUT PASSE');
