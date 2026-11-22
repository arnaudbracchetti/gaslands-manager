/**
 * Lint des migrations destructives (cible Nx `backend:migration:lint`).
 *
 * Pourquoi : le retour arrière en production relance l'image N-1 SANS
 * restaurer la base (cf. docs/adr/0001-retour-arriere-par-l-image-precedente-
 * sans-restauration.md). Cela n'est sûr que si les migrations de N sont
 * additives : N-1 doit pouvoir tourner sur le schéma laissé par N. Une
 * migration non additive doit porter le marqueur `// incompatible : <raison>`,
 * que le script de déploiement détecte pour restaurer le dump au lieu de
 * relancer N-1. Règle complète : docs/ARCHITECTURE.md §4.
 *
 * Ce module n'a aucune dépendance NestJS/TypeORM : analyse statique du SOURCE
 * des migrations (pas d'exécution), limitée au corps de `up()`. C'est un filet,
 * pas une preuve — un ordre destructif écrit autrement (SQL construit
 * dynamiquement, DROP CONSTRAINT...) n'est pas détecté.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Dernière migration déployée en production : seules les suivantes sont contrôlées. */
export const REFERENCE_MIGRATION: string = 'AddCampaignBudget1786182754067';

export interface MigrationViolation {
  /** Nom du fichier de migration concerné. */
  file: string;
  /** Identifiant court de la règle enfreinte (ex. `drop-column`, `enum`). */
  rule: string;
  /** Explication destinée au développeur, avec la correction attendue. */
  message: string;
  /** Extrait du source qui a déclenché la règle. */
  excerpt: string;
}

interface DestructiveRule {
  rule: string;
  pattern: RegExp;
  message: string;
}

// Marqueur canonique d'une migration non additive.
//
// ⚠️ Regex DUPLIQUÉE dans deploy-gaslands.sh (grep -E du retour arrière) :
// garder les deux copies strictement équivalentes. Équivalent grep :
//   ^[[:blank:]]*//[[:blank:]]*incompatible[[:blank:]]*:[[:blank:]]*[^[:space:]]
// Si la CI acceptait un marqueur que le grep ne voit pas, le retour arrière
// relancerait N-1 sur un schéma qu'il ne comprend pas.
//
// Forme spécifiée (issue #25) : ^\s*//\s*incompatible\s*:\s*\S. Mais en
// JavaScript `\s` reconnaît aussi l'espace insécable (U+00A0), que la spec
// rejette : on écrit donc les blancs `[ \t]`, et la raison `[^\s]` (qui
// exclut l'insécable).
const CANONICAL_MARKER: RegExp =
  /^[ \t]*\/\/[ \t]*incompatible[ \t]*:[ \t]*[^\s]/;

// Ligne de commentaire (`//`, ouverture ou ligne `*` d'un bloc) — candidate quasi-marqueur.
const COMMENT_LINE: RegExp = /^\s*(\/\/|\/\*|\*)/;

const MIGRATION_FILE: RegExp = /^(\d+)-(\w+)\.ts$/;

/** Ordres et appels refusés sans marqueur (cf. issue #25, « Lint des migrations destructives »). */
const DESTRUCTIVE_RULES: DestructiveRule[] = [
  {
    rule: 'drop-table',
    pattern: /\bDROP\s+TABLE\b/i,
    message: 'DROP TABLE supprime une table que N-1 lit encore.',
  },
  {
    rule: 'drop-column',
    pattern: /\bDROP\s+COLUMN\b/i,
    message: 'DROP COLUMN supprime une colonne que N-1 lit encore.',
  },
  {
    rule: 'drop-type',
    pattern: /\bDROP\s+TYPE\b/i,
    message: 'DROP TYPE supprime un type que N-1 utilise encore.',
  },
  {
    rule: 'drop-default',
    pattern: /\bDROP\s+DEFAULT\b/i,
    message:
      'DROP DEFAULT casse les INSERT de N-1 qui comptaient sur la valeur par défaut.',
  },
  {
    rule: 'rename',
    pattern: /\bRENAME\b/i,
    message:
      'RENAME : N-1 cherche encore l’ancien nom. Ajouter le nouveau, migrer, supprimer l’ancien en version suivante.',
  },
  {
    rule: 'set-not-null',
    pattern: /\bSET\s+NOT\s+NULL\b/i,
    message:
      'SET NOT NULL fait échouer les INSERT de N-1 qui ne renseignent pas la colonne.',
  },
  {
    rule: 'alter-column-type',
    pattern: /\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i,
    message: 'Changement de type de colonne : N-1 lit encore l’ancien type.',
  },
  {
    rule: 'truncate',
    pattern: /\bTRUNCATE\b/i,
    message:
      'TRUNCATE efface des données : un retour arrière sans restauration les perdrait.',
  },
  {
    rule: 'delete-from',
    pattern: /\bDELETE\s+FROM\b/i,
    message:
      'DELETE FROM efface des données : un retour arrière sans restauration les perdrait.',
  },
  {
    rule: 'query-runner-destructive',
    pattern:
      /\.\s*(dropTable|dropColumns?|renameTable|renameColumn|changeColumns?)\s*\(/,
    message:
      'Appel queryRunner destructif (suppression, renommage ou modification de colonne/table).',
  },
];

/** Règles génériques couvertes par la violation `enum` quand la séquence TypeORM est détectée. */
const ENUM_SEQUENCE_RULES: ReadonlySet<string> = new Set([
  'rename',
  'drop-type',
  'alter-column-type',
]);

/** Séquence d'enum générée par TypeORM : elle commence toujours par renommer l'ancien type. */
const ENUM_SEQUENCE: RegExp = /\bALTER\s+TYPE\b[^`;]*?\bRENAME\s+TO\b/i;

const CONCURRENTLY: RegExp = /\bCONCURRENTLY\b/i;

/**
 * Clause d'ajout de colonne, jusqu'à la prochaine virgule, point-virgule ou
 * fin de chaîne SQL. Limite connue : un DEFAULT contenant une virgule
 * (`DEFAULT '{a,b}'`) tronque la clause — cas à vérifier à la main.
 */
const ADD_COLUMN_CLAUSE: RegExp =
  /\bADD\s+(?!CONSTRAINT\b|VALUE\b|PRIMARY\b|UNIQUE\b|FOREIGN\b|CHECK\b)(COLUMN\s+)?"?\w+"?[^,;`]*/gi;

/**
 * Lint de toutes les migrations d'un dossier postérieures à la référence.
 * Parcourt le dossier, pas l'index : une migration oubliée dans l'index est
 * aussi contrôlée (son oubli est détecté par `backend:migration:check`).
 */
export function lintMigrations(
  dir: string,
  referenceMigration: string,
): MigrationViolation[] {
  const referenceTimestamp = trailingTimestamp(referenceMigration);
  const files = readdirSync(dir)
    .filter((name) => MIGRATION_FILE.test(name))
    .sort();

  const referenceFile = files.find(
    (name) => fileTimestamp(name) === referenceTimestamp,
  );
  if (referenceTimestamp === null || referenceFile === undefined) {
    return [
      {
        file: referenceMigration,
        rule: 'reference-introuvable',
        message: `Migration de référence ${referenceMigration} introuvable dans ${dir} : le lint ne saurait pas quelles migrations contrôler.`,
        excerpt: '',
      },
    ];
  }

  return files
    .filter((name) => (fileTimestamp(name) ?? 0) > referenceTimestamp)
    .flatMap((name) =>
      lintMigrationSource(name, readFileSync(join(dir, name), 'utf8')),
    );
}

/** Lint d'une migration à partir de son source (fonction pure, sans E/S). */
export function lintMigrationSource(
  file: string,
  source: string,
): MigrationViolation[] {
  const upBody = extractUpBody(source);
  if (upBody === null) {
    return [
      {
        file,
        rule: 'up-introuvable',
        message:
          'Méthode `async up(` introuvable : impossible de contrôler la migration.',
        excerpt: '',
      },
    ];
  }
  const sql = stripComments(upBody);
  const hasMarker = source
    .split(/\r?\n/)
    .some((line) => CANONICAL_MARKER.test(line));

  const destructive: MigrationViolation[] = [];
  const enumMatch = ENUM_SEQUENCE.exec(sql);
  if (enumMatch !== null) {
    destructive.push({
      file,
      rule: 'enum',
      message:
        "Séquence d'enum générée par TypeORM (renommage, recréation et suppression du type) : N-1 ne la supporte pas. " +
        'Pour ajouter une valeur, réécrire en `ALTER TYPE "…" ADD VALUE \'…\'` — et ne pas utiliser la nouvelle valeur dans le même lot de migrations.',
      excerpt: enumMatch[0],
    });
  }
  for (const { rule, pattern, message } of DESTRUCTIVE_RULES) {
    if (enumMatch !== null && ENUM_SEQUENCE_RULES.has(rule)) continue;
    const match = pattern.exec(sql);
    if (match !== null)
      destructive.push({ file, rule, message, excerpt: match[0] });
  }
  for (const clause of sql.matchAll(ADD_COLUMN_CLAUSE)) {
    if (/\bNOT\s+NULL\b/i.test(clause[0]) && !/\bDEFAULT\b/i.test(clause[0])) {
      destructive.push({
        file,
        rule: 'add-not-null-sans-default',
        message:
          'Colonne ajoutée NOT NULL sans DEFAULT : les INSERT de N-1, qui ne la renseignent pas, échoueraient.',
        excerpt: clause[0].trim(),
      });
    }
  }

  const always: MigrationViolation[] = [];
  const concurrently = CONCURRENTLY.exec(sql);
  if (concurrently !== null) {
    always.push({
      file,
      rule: 'concurrently',
      message:
        'CONCURRENTLY est interdit, même avec le marqueur : les migrations tournent dans une seule transaction (migrationsTransactionMode `all`), où CONCURRENTLY échoue.',
      excerpt: concurrently[0],
    });
  }
  for (const line of source.split(/\r?\n/)) {
    if (
      COMMENT_LINE.test(line) &&
      /incompatible/i.test(line) &&
      !CANONICAL_MARKER.test(line)
    ) {
      always.push({
        file,
        rule: 'quasi-marqueur',
        message:
          'Marqueur mal formé : la forme exacte est `// incompatible : <raison>` (minuscules, commentaire `//`, raison non vide, espaces ordinaires). ' +
          'Le script de retour arrière ne reconnaîtrait pas cette ligne.',
        excerpt: line.trim(),
      });
    }
  }

  return hasMarker ? always : [...destructive, ...always];
}

/** Corps de `up()` : du `async up(` au premier `async down(` qui suit (ou la fin du fichier). */
function extractUpBody(source: string): string | null {
  const start = source.search(/\basync\s+up\s*\(/);
  if (start === -1) return null;
  const rest = source.slice(start);
  const end = rest.search(/\basync\s+down\s*\(/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Retire les commentaires, pour qu'un ordre cité en commentaire ne déclenche aucune règle. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function fileTimestamp(name: string): number | null {
  const match = MIGRATION_FILE.exec(name);
  return match === null ? null : Number(match[1]);
}

function trailingTimestamp(className: string): number | null {
  const match = /(\d+)$/.exec(className);
  return match === null ? null : Number(match[1]);
}
