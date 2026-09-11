#!/usr/bin/env node
/**
 * Portillon d'audit de securite pour la CI.
 *
 * `npm audit --audit-level=high` ne sait pas faire la difference entre une
 * faille qui nous expose et une faille qu'aucun correctif amont ne permet de
 * fermer. Resultat : la CI echouait a chaque poussee, et une alerte qui se
 * declenche toujours n'alerte plus personne.
 *
 * Ce script garde la meme exigence — tout avis « high » ou « critical » fait
 * echouer la CI — mais autorise des exceptions nommees, une par identifiant
 * GHSA, chacune avec sa justification et sa date de reexamen. Une faille
 * nouvelle n'est jamais couverte par accident : il faut l'ajouter ici, donc
 * l'examiner.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Le portillon est appele depuis apps/api et apps/web, mais `npm audit` ne
// voit que le sous-arbre du repertoire courant. On l'ancre donc a la racine,
// ou se trouve l'unique package-lock.json, pour que les deux jobs auditent
// exactement le meme arbre.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Exceptions. Chaque entree doit dire *pourquoi* l'avis ne nous expose pas,
 * pas seulement qu'il gene.
 */
const EXCEPTIONS = [
  {
    ghsa: 'GHSA-ggr8-5vv4-36mx',
    paquet: 'deepmerge-ts',
    reexamen: '2026-12-01',
    motif:
      "Epuisement de pile en fusionnant des objets recursifs. Atteint via " +
      "@prisma/config, qui ne fusionne que notre propre prisma.config.ts : " +
      "l'entree n'est pas controlee par un tiers. prisma 7.10.0, la derniere " +
      "version publiee, epingle deepmerge-ts 7.1.5 ; aucune version corrigee " +
      "n'existe en amont. Le seul correctif propose par npm est une " +
      "retrogradation vers prisma 6.19.3, incompatible avec le format " +
      "prisma.config.ts et avec @prisma/client 7.",
  },
  {
    ghsa: 'GHSA-3f6p-5ww8-9rcr',
    paquet: 'mysql2',
    reexamen: '2026-12-01',
    motif:
      "Fuite d'identifiants en clair par retrogradation du plugin " +
      "d'authentification MySQL. La plateforme tourne sur PostgreSQL ; mysql2 " +
      "est une dependance de la CLI Prisma (devDependency) pour " +
      "l'introspection MySQL, jamais importee par le code applicatif.",
  },
  {
    ghsa: 'GHSA-rgwj-5xj2-c3m3',
    paquet: 'mysql2',
    reexamen: '2026-12-01',
    motif:
      "Deni de service par bombe de decompression dans le protocole MySQL " +
      "compresse. Meme raison : aucune connexion MySQL n'est jamais ouverte.",
  },
];

const AUTORISES = new Set(EXCEPTIONS.map((e) => e.ghsa));
const BLOQUANTS = new Set(['high', 'critical']);

function lireAudit() {
  let brut;
  try {
    brut = execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
      cwd: RACINE,
    });
  } catch (err) {
    // `npm audit` sort en code non nul des qu'il trouve quelque chose : c'est
    // le cas nominal ici, et la sortie JSON reste exploitable.
    brut = err.stdout;
  }
  if (!brut) {
    console.error("audit-gate : npm audit n'a rien renvoye.");
    process.exit(1);
  }
  return JSON.parse(brut);
}

/** L'identifiant GHSA n'est expose que dans l'URL de l'avis. */
function idGhsa(avis) {
  const m = String(avis.url ?? '').match(/GHSA-[0-9a-z-]+/i);
  return m ? m[0] : String(avis.source ?? '');
}

/**
 * Un paquet n'est blanchi que si tous ses avis directs sont autorises et si
 * tous les paquets dont il herite une faille le sont aussi. On itere jusqu'au
 * point fixe : `prisma` herite de `@prisma/config`, qui herite de
 * `deepmerge-ts` ; la chaine entiere doit tomber pour que `prisma` tombe.
 */
function blanchir(vulnerabilites) {
  const concernes = Object.entries(vulnerabilites).filter(([, d]) =>
    BLOQUANTS.has(d.severity)
  );
  const nomsConcernes = new Set(concernes.map(([n]) => n));

  const blanchis = new Set();
  let progresse = true;

  while (progresse) {
    progresse = false;
    for (const [nom, detail] of concernes) {
      if (blanchis.has(nom)) continue;

      const via = detail.via ?? [];
      const avisDirects = via.filter((v) => typeof v === 'object');
      const heritages = via.filter((v) => typeof v === 'string');
      if (!avisDirects.length && !heritages.length) continue;

      const directsOk = avisDirects.every((a) => AUTORISES.has(idGhsa(a)));
      const heritagesOk = heritages.every(
        (p) => blanchis.has(p) || !nomsConcernes.has(p)
      );

      if (directsOk && heritagesOk) {
        blanchis.add(nom);
        progresse = true;
      }
    }
  }

  return { concernes, blanchis };
}

// -- Execution -------------------------------------------------------
const rapport = lireAudit();
const { concernes, blanchis } = blanchir(rapport.vulnerabilities ?? {});
const restants = concernes.filter(([nom]) => !blanchis.has(nom));

const rencontres = new Set();
for (const [, detail] of concernes) {
  for (const v of detail.via ?? []) {
    if (typeof v === 'object') rencontres.add(idGhsa(v));
  }
}

console.log('-- Audit de securite ---------------------------------------');
console.log(
  `   avis high/critical : ${concernes.length}   |   couverts par exception : ${blanchis.size}`
);

for (const e of EXCEPTIONS) {
  if (!rencontres.has(e.ghsa)) {
    console.log(
      `   [!] exception obsolete : ${e.ghsa} (${e.paquet}) n'apparait plus dans l'audit.` +
        `\n       A supprimer de scripts/audit-gate.mjs.`
    );
    continue;
  }
  const echu = new Date(e.reexamen) < new Date();
  console.log(
    `   ${echu ? '[!]' : ' - '} ${e.ghsa} (${e.paquet}) reexamen ${e.reexamen}` +
      (echu ? '  DEPASSE, a reevaluer' : '')
  );
}

if (restants.length === 0) {
  console.log('   Aucun avis bloquant non couvert.');
  process.exit(0);
}

console.error('\n   Avis bloquants NON couverts par une exception :');
for (const [nom, detail] of restants) {
  console.error(`\n   * ${nom} (${detail.severity})`);
  for (const v of detail.via ?? []) {
    if (typeof v === 'object') console.error(`       ${idGhsa(v)}  ${v.title}`);
    else console.error(`       herite de ${v}`);
  }
}
console.error(
  "\n   Corrigez la dependance, ou ajoutez une exception justifiee dans\n" +
    "   scripts/audit-gate.mjs si aucun correctif amont n'existe.\n"
);
process.exit(1);
