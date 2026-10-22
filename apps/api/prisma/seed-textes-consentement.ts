// Les textes de consentement, version 1, en francais (EF-02-01).
//
//     npx tsx prisma/seed-textes-consentement.ts
//
// **Sans texte publie, rien n'est consentable** : le service refuse
// d'enregistrer un accord pour une portee qui n'en a pas, parce qu'on ne
// consent pas a un texte qui n'existe pas.
//
// ## Comment ces textes sont ecrits
//
// Ils s'adressent a quelqu'un dans une file d'attente, qui n'a pas le temps
// et qui n'est pas juriste. Chacun dit **trois choses** : ce qui est partage,
// avec qui, et ce qui se passe si l'on refuse. Cette derniere phrase est la
// plus importante : un consentement n'est libre que si refuser reste possible
// sans consequence sur les soins.
//
// Ils ne sont pas valides par un juriste. C'est une base de travail, et la
// version 2 viendra de cette relecture — c'est precisement a cela que sert le
// versionnage.
//
// ## Les traductions
//
// Seul le francais existe. En Guinee, beaucoup de patients lisent le pular ou
// le malinke : un texte en francais qui leur est montre n'est pas un
// consentement eclaire. La plateforme l'enregistre honnetement — la trace dit
// dans quelle langue le texte a ete presente — et l'ecran du patient le lui
// signale. Le manque se voit, au lieu de se cacher.
import { prisma } from '../src/config/prisma';
import { ConsentScope } from '../src/config/generated/client/client';

type Texte = { scope: ConsentScope; titre: string; corps: string };

const TEXTES: Texte[] = [
  {
    scope: ConsentScope.DOSSIER_MEDICAL,
    titre: 'Partage de votre dossier avec les soignants',
    corps: [
      "En acceptant, vous autorisez les professionnels de sante qui vous prennent",
      "en charge a consulter votre dossier : vos consultations, vos resultats",
      "d'analyses, vos ordonnances, vos allergies et vos maladies chroniques.",
      '',
      "Cela leur evite de vous redemander ce que vous avez deja dit, et surtout",
      "cela evite qu'on vous prescrive un medicament auquel vous etes allergique.",
      '',
      "Seuls les soignants qui participent a vos soins y accedent. Chaque",
      "consultation de votre dossier est enregistree, et vous pouvez voir a tout",
      "moment qui l'a ouvert, quand, et pourquoi.",
      '',
      "Si vous refusez, vous serez soigne normalement : un soignant vous",
      "demandera simplement vos antecedents de vive voix. Vous pouvez changer",
      "d'avis a tout moment, et le retrait prend effet immediatement.",
    ].join('\n'),
  },
  {
    scope: ConsentScope.RAPPELS_SMS,
    titre: 'Rappels par SMS',
    corps: [
      "En acceptant, vous recevrez des SMS pour vous rappeler vos rendez-vous,",
      "vos vaccinations a faire, et vous prevenir quand des resultats d'analyses",
      "sont disponibles.",
      '',
      "Ces messages ne contiennent jamais de diagnostic ni de resultat : un SMS",
      "peut etre lu par quelqu'un d'autre que vous. Ils disent seulement qu'il",
      "se passe quelque chose et vous invitent a vous connecter.",
      '',
      "Si vous refusez, vous ne recevrez aucun SMS. Vous devrez penser vous-meme",
      "a vos rendez-vous, et consulter l'application pour vos resultats. Vous",
      "pouvez changer d'avis a tout moment.",
    ].join('\n'),
  },
  {
    scope: ConsentScope.FHIR_EXPORT,
    titre: 'Transmission de votre dossier a un autre systeme de sante',
    corps: [
      "En acceptant, votre dossier pourra etre transmis, dans un format",
      "standard, a un autre systeme de sante : un hopital qui ne travaille pas",
      "avec cette plateforme, un laboratoire exterieur, ou un medecin a",
      "l'etranger — toujours a votre demande ou a celle d'un soignant qui vous",
      "prend en charge.",
      '',
      "C'est utile le jour ou vous changez de ville, de pays, ou d'etablissement",
      "pour une operation.",
      '',
      "Une fois transmis, le dossier vit dans l'autre systeme : nous ne pouvons",
      "plus le reprendre, et les regles de cet autre systeme s'y appliquent.",
      "C'est pourquoi cette autorisation est demandee separement.",
      '',
      "Si vous refusez, rien ne sort de la plateforme. Vous pouvez changer",
      "d'avis a tout moment, mais un dossier deja transmis le reste.",
    ].join('\n'),
  },
  {
    scope: ConsentScope.RECHERCHE_ANONYMISEE,
    titre: 'Utilisation de vos donnees pour la recherche en sante',
    corps: [
      "En acceptant, vos donnees medicales pourront servir a des travaux de",
      "recherche et de sante publique : comprendre comment une maladie se",
      "repand, mesurer si un traitement marche, savoir ou manquent les",
      "medicaments.",
      '',
      "Votre nom, votre telephone et votre adresse ne sont jamais transmis. Les",
      "chercheurs recoivent des donnees sans identite — votre age, votre",
      "prefecture, vos diagnostics et vos traitements.",
      '',
      "Vous n'en tirez aucun benefice direct, et refuser ne change rien a vos",
      "soins ni a vos droits. C'est un geste pour les autres, pas pour vous.",
      '',
      "Vous pouvez changer d'avis a tout moment. Les travaux deja publies ne",
      "peuvent pas etre defaits, mais vos donnees cesseront d'etre utilisees",
      "pour les suivants.",
    ].join('\n'),
  },
];

async function main() {
  const auteur = await prisma.utilisateur.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN_NATIONAL'] }, estActif: true },
    select: { id: true, prenom: true, nom: true },
  });
  if (!auteur) throw new Error('Aucun compte national actif pour publier les textes.');
  console.log(`publie par ${auteur.prenom} ${auteur.nom}\n`);

  for (const t of TEXTES) {
    const deja = await prisma.texteConsentement.findFirst({
      where: { scope: t.scope, langue: 'fr' },
      orderBy: { version: 'desc' },
      select: { version: true, corps: true, publieLe: true },
    });

    // **On ne republie pas a l'identique.** Une version de plus sans
    // changement ferait croire a tous les patients que le texte a evolue, et
    // leur demanderait de renouveler un accord pour rien.
    if (deja && deja.corps.trim() === t.corps.trim()) {
      console.log(`${t.scope.padEnd(22)} inchange (version ${deja.version})`);
      continue;
    }

    const cree = await prisma.texteConsentement.create({
      data: {
        scope: t.scope,
        langue: 'fr',
        version: (deja?.version ?? 0) + 1,
        titre: t.titre,
        corps: t.corps,
        publieLe: new Date(),
        idPubliePar: auteur.id,
      },
      select: { version: true, corps: true },
    });
    console.log(`${t.scope.padEnd(22)} version ${cree.version} publiee `
      + `(${cree.corps.length} caracteres)`);
  }

  const n = await prisma.texteConsentement.count({ where: { publieLe: { not: null } } });
  console.log(`\n${n} texte(s) publie(s) au total.`);
  console.log('Langues disponibles : fr seulement. Le pular et le malinke manquent,');
  console.log("et l'ecran du patient le dit plutot que de le taire.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
