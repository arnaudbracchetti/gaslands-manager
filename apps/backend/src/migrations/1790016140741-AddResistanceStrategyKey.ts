import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResistanceStrategyKey1790016140741 implements MigrationInterface {
    name = 'AddResistanceStrategyKey1790016140741'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "game_events" ADD "resistanceStrategyKey" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "game_events" DROP COLUMN "resistanceStrategyKey"`);
    }

}
