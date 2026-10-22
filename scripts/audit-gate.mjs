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
  // ── Outils de developpement d'Angular 21 (22/10/2026) ──────────────
  //
  // @angular/build 21.2.27 et @angular/cli 21.2.27, dernieres versions 21,
  // epinglent exactement vite 7.3.6 et @modelcontextprotocol/sdk 1.31.0.
  // Les correctifs (vite 7.3.7, sdk 1.32) ne s'appliquent qu'en regenerant
  // tout le package-lock (217 versions changees, dont 5 majeures) ou en
  // passant a Angular 22 : c'est ce passage qui fermera ces avis.
  //
  // Aucun ne touche l'application livree : vite ne sert qu'au serveur de
  // developpement (`ng serve`, builder @angular/build:dev-server) — le build
  // de production passe par esbuild — et le sdk MCP qu'a la commande
  // `ng mcp`. Ni l'un ni l'autre n'est importe par le code, ni present dans
  // le bundle de production. Le risque est sur les postes de developpement :
  // ne pas exposer `ng serve` hors de la machine (pas de --host 0.0.0.0 sur
  // un reseau non sur).
  ...[
    'GHSA-698v-4r3x-3vcv', // launch-editor : % non echappe sous Windows
    'GHSA-r825-w8mm-5pxw', // launch-editor : drapeau d'editeur mal interprete
    'GHSA-587h-7wmj-h5pm', // launch-editor : verification d'existence contournable
    'GHSA-9jrq-w75r-8gcw', // vite : script cross-origin via un middleware
    'GHSA-rq7h-c2jc-7f22', // vite : fichiers hors server.fs.allow
  ].map((ghsa) => ({
    ghsa,
    paquet: 'vite (via @angular/build)',
    reexamen: '2026-11-30',
    motif: 'Serveur de developpement uniquement ; corrige avec Angular 22.',
  })),
  ...[
    'GHSA-22jm-h49p-29qw', // taches experimentales non liees a la session
    'GHSA-6prh-2h8m-c8cw', // redirections cross-origin du client HTTP
    'GHSA-46jr-4wx8-v453', // epuisement memoire a la validation
    'GHSA-rvq5-wwqv-78pq', // jeton porteur d'un autre service accepte
  ].map((ghsa) => ({
    ghsa,
    paquet: '@modelcontextprotocol/sdk (via @angular/cli)',
    reexamen: '2026-11-30',
    motif: 'Commande `ng mcp` uniquement, jamais lancee ; corrige avec Angular 22.',
  })),
  //
  // Historique : du 13/09 au 17/10/2026, trois avis etaient toleres —
  // GHSA-ggr8-5vv4-36mx (deepmerge-ts, via @prisma/config) et
  // GHSA-3f6p-5ww8-9rcr / GHSA-rgwj-5xj2-c3m3 (mysql2, via la CLI prisma).
  // prisma 7.10.1 embarque deepmerge-ts 8.0.2 et mysql2 3.24.4, versions
  // corrigees : les exceptions ont ete retirees (le portillon les signalait
  // comme obsoletes). GHSA-vfj7-8cjw-p6xm (braces, via jest 29), tolere
  // sur develop depuis le 03/10, disparait avec le passage a jest 30.
  // Le mecanisme reste pour la prochaine faille sans
  // correctif amont : ghsa, paquet, date de reexamen et motif.
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

const aujourdHui = new Date().toISOString().slice(0, 10);
const exceptionsExpirees = [];

console.log('-- Audit de securite ---------------------------------------');
console.log(
  `   avis high/critical : ${concernes.length}   |   couverts par exception : ${blanchis.size}`
);

for (const e of EXCEPTIONS) {
  const echu = e.reexamen < aujourdHui;
  if (echu) exceptionsExpirees.push(e);

  if (!rencontres.has(e.ghsa)) {
    console.log(
      `   [!] exception obsolete : ${e.ghsa} (${e.paquet}) n'apparait plus dans l'audit.` +
        `\n       A supprimer de scripts/audit-gate.mjs.`
    );
    continue;
  }
  console.log(
    `   ${echu ? '[!]' : ' - '} ${e.ghsa} (${e.paquet}) reexamen ${e.reexamen}` +
      (echu ? '  DEPASSE, a reevaluer' : '')
  );
}

if (exceptionsExpirees.length > 0) {
  console.error('\n   Exceptions depassees : la CI est bloquee jusqu a leur reevaluation :');
  for (const e of exceptionsExpirees) {
    console.error(`\n   * ${e.ghsa} (${e.paquet}), reexamen depasse depuis ${e.reexamen}`);
  }
  process.exit(1);
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
