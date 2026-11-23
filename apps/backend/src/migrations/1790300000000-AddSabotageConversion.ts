import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSabotageConversion1790300000000 implements MigrationInterface {
  name: string = 'AddSabotageConversion1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_events" ADD "sabotageTokensConverted" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" ADD "sabotageJerricansGained" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_events" DROP COLUMN "sabotageJerricansGained"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_events" DROP COLUMN "sabotageTokensConverted"`,
    );
  }
}
