import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCampaignHouseRules1790196361073 implements MigrationInterface {
    name = 'AddCampaignHouseRules1790196361073'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "houseRules" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "houseRules"`);
    }

}
