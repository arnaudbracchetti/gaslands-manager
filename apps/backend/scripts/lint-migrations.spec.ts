/**
 * Specs du lint des migrations destructives (`backend:migration:lint`).
 *
 * Chaque test écrit de vraies migrations TypeORM dans un dossier temporaire et
 * vérifie les violations renvoyées par `lintMigrations` — on teste ce que le
 * contrôle accepte ou refuse, jamais sa structure interne (cf. issue #25,
 * « Testing Decisions »).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintMigrations, REFERENCE_MIGRATION } from './lint-migrations';
import type { MigrationViolation } from './lint-migrations';

const REFERENCE_TS = 1786182754067;
const AFTER = 1790000000000;

let dir: string;

/** Écrit une migration TypeORM réaliste ; `header` est inséré avant la classe (marqueur...). */
function writeMigration(
  timestamp: number,
  name: string,
  upSql: string,
  options: { downSql?: string; header?: string; upBody?: string } = {},
): void {
  const up = options.upBody ?? `    await queryRunner.query(\`${upSql}\`);`;
  const down = options.downSql ?? '';
  const source = `import { MigrationInterface, QueryRunner } from 'typeorm';
${options.header ?? ''}
export class ${name}${timestamp} implements MigrationInterface {
  name: string = '${name}${timestamp}';

  public async up(queryRunner: QueryRunner): Promise<void> {
${up}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`${down}\`);
  }
}
`;
  writeFileSync(join(dir, `${timestamp}-${name}.ts`), source);
}

function lint(): MigrationViolation[] {
  return lintMigrations(dir, REFERENCE_MIGRATION);
}

function rules(): string[] {
  return lint().map((v) => v.rule);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'migration-lint-'));
  writeMigration(
    REFERENCE_TS,
    'AddCampaignBudget',
    'ALTER TABLE "campaigns" ADD "budget" integer NOT NULL DEFAULT 50',
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('lintMigrations', () => {
  describe('migrations additives', () => {
    it.each([
      [
        'colonne nullable',
        'ALTER TABLE "game_events" ADD "resistanceStrategyKey" character varying',
      ],
      [
        'colonne NOT NULL avec DEFAULT',
        `ALTER TABLE "campaigns" ADD "houseRules" jsonb NOT NULL DEFAULT '[]'`,
      ],
      [
        'DEFAULT avant NOT NULL',
        `ALTER TABLE "campaigns" ADD COLUMN "x" integer DEFAULT 0 NOT NULL`,
      ],
      [
        'nouvelle table',
        'CREATE TABLE "foo" ("id" SERIAL NOT NULL, CONSTRAINT "PK_foo" PRIMARY KEY ("id"))',
      ],
      ['nouvel index', 'CREATE INDEX "IDX_foo" ON "foo" ("id")'],
      ['DROP CONSTRAINT', 'ALTER TABLE "foo" DROP CONSTRAINT "FK_foo"'],
      ['DROP INDEX', 'DROP INDEX "public"."IDX_foo"'],
      [
        'ajout de contrainte',
        'ALTER TABLE "foo" ADD CONSTRAINT "FK_foo" FOREIGN KEY ("barId") REFERENCES "bar"("id")',
      ],
      [
        'nouvelle valeur d’enum par ADD VALUE',
        `ALTER TYPE "public"."game_status_enum" ADD VALUE 'ANNULE'`,
      ],
    ])('accepte : %s', (_label, sql) => {
      writeMigration(AFTER, 'Additive', sql);
      expect(lint()).toEqual([]);
    });
  });

  describe('ordres destructifs refusés sans marqueur', () => {
    it.each([
      ['drop-table', 'DROP TABLE "foo"'],
      ['drop-column', 'ALTER TABLE "foo" DROP COLUMN "bar"'],
      ['drop-type', 'DROP TYPE "public"."foo_enum"'],
      ['drop-default', 'ALTER TABLE "foo" ALTER COLUMN "bar" DROP DEFAULT'],
      ['rename', 'ALTER TABLE "foo" RENAME COLUMN "bar" TO "baz"'],
      ['rename', 'ALTER TABLE "foo" RENAME TO "baz"'],
      ['set-not-null', 'ALTER TABLE "foo" ALTER COLUMN "bar" SET NOT NULL'],
      [
        'alter-column-type',
        'ALTER TABLE "foo" ALTER COLUMN "bar" TYPE integer',
      ],
      [
        'alter-column-type',
        'ALTER TABLE "foo" ALTER COLUMN "bar" SET DATA TYPE integer',
      ],
      [
        'add-not-null-sans-default',
        'ALTER TABLE "foo" ADD "bar" integer NOT NULL',
      ],
      ['truncate', 'TRUNCATE "foo"'],
      ['delete-from', `DELETE FROM "foo" WHERE "x" = 1`],
    ])('refuse %s : %s', (rule, sql) => {
      writeMigration(AFTER, 'Destructive', sql);
      expect(rules()).toContain(rule);
    });

    it.each([
      `await queryRunner.dropTable('foo');`,
      `await queryRunner.dropColumn('foo', 'bar');`,
      `await queryRunner.dropColumns('foo', ['bar']);`,
      `await queryRunner.renameTable('foo', 'baz');`,
      `await queryRunner.renameColumn('foo', 'bar', 'baz');`,
      `await queryRunner.changeColumn('foo', 'bar', column);`,
      `await queryRunner.changeColumns('foo', changes);`,
    ])('refuse l’appel queryRunner destructif : %s', (call) => {
      writeMigration(AFTER, 'Destructive', '', { upBody: `    ${call}` });
      expect(rules()).toEqual(['query-runner-destructive']);
    });

    it('ignore un ordre destructif présent uniquement dans down()', () => {
      writeMigration(AFTER, 'Additive', 'ALTER TABLE "foo" ADD "bar" integer', {
        downSql: 'ALTER TABLE "foo" DROP COLUMN "bar"',
      });
      expect(lint()).toEqual([]);
    });

    it('ignore un ordre destructif cité dans un commentaire de up()', () => {
      writeMigration(AFTER, 'Additive', '', {
        upBody:
          '    // pas de DROP COLUMN ici\n    await queryRunner.query(`ALTER TABLE "foo" ADD "bar" integer`);',
      });
      expect(lint()).toEqual([]);
    });

    it('renvoie le fichier, un message et l’extrait fautif', () => {
      writeMigration(
        AFTER,
        'Destructive',
        'ALTER TABLE "foo" DROP COLUMN "bar"',
      );
      expect(lint()).toEqual([
        expect.objectContaining({
          file: `${AFTER}-Destructive.ts`,
          rule: 'drop-column',
          excerpt: 'DROP COLUMN',
          message: expect.any(String),
        }),
      ]);
    });
  });

  describe('enums', () => {
    it('refuse la séquence d’enum générée par TypeORM avec une seule violation proposant ADD VALUE', () => {
      writeMigration(AFTER, 'ChangeEnum', '', {
        upBody: [
          'await queryRunner.query(`ALTER TYPE "public"."games_status_enum" RENAME TO "games_status_enum_old"`);',
          `await queryRunner.query(\`CREATE TYPE "public"."games_status_enum" AS ENUM('PLANIFIE', 'ATELIER', 'JOUE', 'ANNULE')\`);`,
          'await queryRunner.query(`ALTER TABLE "games" ALTER COLUMN "status" TYPE "public"."games_status_enum" USING "status"::"text"::"public"."games_status_enum"`);',
          'await queryRunner.query(`DROP TYPE "public"."games_status_enum_old"`);',
        ]
          .map((l) => `    ${l}`)
          .join('\n'),
      });
      const violations = lint();
      expect(violations.map((v) => v.rule)).toEqual(['enum']);
      expect(violations[0].message).toContain('ADD VALUE');
    });
  });

  describe('CONCURRENTLY', () => {
    it('refuse CREATE INDEX CONCURRENTLY', () => {
      writeMigration(
        AFTER,
        'AddIndex',
        'CREATE INDEX CONCURRENTLY "IDX_foo" ON "foo" ("id")',
      );
      expect(rules()).toEqual(['concurrently']);
    });

    it('le refuse même avec le marqueur', () => {
      writeMigration(
        AFTER,
        'AddIndex',
        'CREATE INDEX CONCURRENTLY "IDX_foo" ON "foo" ("id")',
        {
          header: '// incompatible : index trop gros',
        },
      );
      expect(rules()).toEqual(['concurrently']);
    });
  });

  describe('marqueur', () => {
    it.each([
      '// incompatible : suppression de la colonne bar',
      '//incompatible:suppression',
      '  //   incompatible   :   suppression',
    ])('le marqueur canonique « %s » lève le refus', (marker) => {
      writeMigration(
        AFTER,
        'Destructive',
        'ALTER TABLE "foo" DROP COLUMN "bar"',
        { header: marker },
      );
      expect(lint()).toEqual([]);
    });

    it.each([
      ['raison vide', '// incompatible :'],
      ['raison faite de blancs', '// incompatible :   '],
      ['majuscule', '// Incompatible : suppression'],
      ['tout en majuscules', '// INCOMPATIBLE : suppression'],
      ['commentaire bloc', '/* incompatible : suppression */'],
      [
        'espace insécable avant les deux-points',
        '// incompatible : suppression',
      ],
      [
        'espace insécable après les deux-points',
        '// incompatible : suppression',
      ],
    ])(
      'rejette le quasi-marqueur (%s) sans lever le refus',
      (_label, marker) => {
        writeMigration(
          AFTER,
          'Destructive',
          'ALTER TABLE "foo" DROP COLUMN "bar"',
          { header: marker },
        );
        expect(rules()).toEqual(['drop-column', 'quasi-marqueur']);
      },
    );

    it('signale un quasi-marqueur même sur une migration additive', () => {
      writeMigration(AFTER, 'Additive', 'ALTER TABLE "foo" ADD "bar" integer', {
        header: '// Incompatible : rien',
      });
      expect(rules()).toEqual(['quasi-marqueur']);
    });
  });

  describe('migration de référence', () => {
    it('ignore les migrations antérieures ou égales à la référence', () => {
      writeMigration(1785808811325, 'InitSchema', 'DROP TABLE "legacy"');
      writeMigration(
        REFERENCE_TS,
        'AddCampaignBudget',
        'ALTER TABLE "foo" DROP COLUMN "bar"',
      );
      expect(lint()).toEqual([]);
    });

    it('ignore les fichiers qui ne sont pas des migrations (index, specs, texte)', () => {
      writeFileSync(join(dir, 'index.ts'), 'DROP TABLE "foo"');
      writeFileSync(join(dir, 'valeurs-nouvelles.txt'), 'DROP TABLE "foo"');
      expect(lint()).toEqual([]);
    });

    it('signale une référence introuvable plutôt que de ne rien contrôler', () => {
      rmSync(join(dir, `${REFERENCE_TS}-AddCampaignBudget.ts`));
      writeMigration(
        AFTER,
        'Destructive',
        'ALTER TABLE "foo" DROP COLUMN "bar"',
      );
      expect(rules()).toEqual(['reference-introuvable']);
    });
  });

  it('les migrations réelles du dépôt passent', () => {
    const realDir = join(__dirname, '..', 'src', 'migrations');
    expect(lintMigrations(realDir, REFERENCE_MIGRATION)).toEqual([]);
  });
});
