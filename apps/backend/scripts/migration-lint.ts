/**
 * Point d'entrée de la cible Nx `backend:migration:lint` (lancé depuis
 * apps/backend). Toute la logique est dans `lint-migrations.ts` ; ce fichier
 * ne fait qu'afficher les violations et fixer le code de sortie.
 */
import { join } from 'node:path';
import { lintMigrations, REFERENCE_MIGRATION } from './lint-migrations';
import type { MigrationViolation } from './lint-migrations';

const migrationsDir: string = join(__dirname, '..', 'src', 'migrations');
const violations: MigrationViolation[] = lintMigrations(
  migrationsDir,
  REFERENCE_MIGRATION,
);

if (violations.length === 0) {
  console.log(
    `Migrations postérieures à ${REFERENCE_MIGRATION} : toutes additives.`,
  );
} else {
  for (const v of violations) {
    console.error(
      `\n✗ ${v.file} [${v.rule}]\n  ${v.message}${v.excerpt ? `\n  → ${v.excerpt}` : ''}`,
    );
  }
  console.error(`
ÉCHEC : ${violations.length} violation(s) de la règle des migrations additives.
  - Réécrire la migration en forme additive (ajout de colonne nullable ou avec DEFAULT,
    nouvelle valeur d'enum par ALTER TYPE ... ADD VALUE, changement étalé sur deux versions) ;
  - ou, si le changement destructif est voulu, ajouter dans le fichier la ligne
      // incompatible : <raison>
    Le retour arrière vers la version précédente restaurera alors le dump d'avant déploiement.
  Règle complète : docs/ARCHITECTURE.md §4 (Migrations additives).`);
  process.exit(1);
}
