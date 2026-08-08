import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCampaignBudget1786182754067 implements MigrationInterface {
    name = 'AddCampaignBudget1786182754067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "budget" integer NOT NULL DEFAULT '50'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "budget"`);
    }

}
