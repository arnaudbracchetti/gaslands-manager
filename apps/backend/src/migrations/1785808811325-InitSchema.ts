import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1785808811325 implements MigrationInterface {
    name = 'InitSchema1785808811325'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "pseudo" character varying(100) NOT NULL DEFAULT '', "email" character varying(200) NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "weapons" ("id" SERIAL NOT NULL, "nomInterne" character varying(100) NOT NULL, "orientation" character varying(10), "estDefaut" boolean NOT NULL DEFAULT false, "vehicleId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a102f55ffbab023a922ac10ab76" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vehicles" ("id" SERIAL NOT NULL, "nomInterne" character varying(100) NOT NULL, "nom" character varying(100), "teamId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vehicle_improvements" ("id" SERIAL NOT NULL, "nomInterne" character varying(100) NOT NULL, "orientation" character varying(10), "estDefaut" boolean NOT NULL DEFAULT false, "vehicleId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_13b22912c377dd0bc88d3d4ce62" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vehicle_advantages" ("id" SERIAL NOT NULL, "nomInterne" character varying(100) NOT NULL, "vehicleId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_859f44a07371c884b40cbc8f388" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "teams" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "sponsor" character varying(50) NOT NULL DEFAULT 'Rutherford', "cans" integer NOT NULL DEFAULT '50', "description" text, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_state_enum" AS ENUM('EN_CONSTRUCTION', 'EN_COURS', 'TERMINEE')`);
        await queryRunner.query(`CREATE TABLE "campaigns" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "state" "public"."campaigns_state_enum" NOT NULL DEFAULT 'EN_CONSTRUCTION', "inviteCode" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_830fc155e18ca5f50e97c9343d3" UNIQUE ("inviteCode"), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."campaign_participants_status_enum" AS ENUM('PENDING', 'VALIDATED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "campaign_participants" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "userId" integer NOT NULL, "teamId" integer, "status" "public"."campaign_participants_status_enum" NOT NULL DEFAULT 'PENDING', "isOrganizer" boolean NOT NULL DEFAULT false, "isLocked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a20c5f036ccd69ef3139cd3cd83" UNIQUE ("campaignId", "userId"), CONSTRAINT "PK_347168ee0d273a3fe0bf9cc70f1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."games_type_enum" AS ENUM('EVENEMENT_TELE', 'ESCARMOUCHE')`);
        await queryRunner.query(`CREATE TYPE "public"."games_status_enum" AS ENUM('PLANIFIE', 'ATELIER', 'JOUE')`);
        await queryRunner.query(`CREATE TABLE "games" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "scenarioId" character varying(100), "type" "public"."games_type_enum" NOT NULL, "status" "public"."games_status_enum" NOT NULL DEFAULT 'PLANIFIE', "displayOrder" double precision NOT NULL, "playedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "game_events" ("id" SERIAL NOT NULL, "gameId" integer NOT NULL, "participantId" integer NOT NULL, "eventOrder" integer NOT NULL, "eventType" character varying NOT NULL, "rank" integer, "championshipPoints" integer, "gatesCrossed" integer, "weightClass" character varying, "amount" integer, "walletReason" character varying, "vehicleId" integer, "weaponId" integer, "improvementId" integer, "advantageId" integer, "diceRoll" integer, "chocsBefore" integer, "wreckResult" character varying, "chocsGained" integer, "operation" character varying, "entityType" character varying, "nomInterne" character varying, "cost" integer, "targetVehicleId" integer, "targetEntityId" integer, "orientation" character varying, "freeAdvantageNomInterne" character varying, "previousVehicleName" character varying(100), "newVehicleName" character varying(100), "sabotagePointsSpent" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_250946158c7913ba536add1e602" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "weapons" ADD CONSTRAINT "FK_f82968089bc8a89c5586c7eea66" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD CONSTRAINT "FK_af76318f8ff5522ca7073e1952b" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle_improvements" ADD CONSTRAINT "FK_92a166d7a9633c90f9c7226e726" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vehicle_advantages" ADD CONSTRAINT "FK_872a2a097d9762fed4d9e3d8a2c" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_5c5696b2c3c57698f890b2cbbdd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" ADD CONSTRAINT "FK_e0d97d6323f4e20a4107c93a0ce" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" ADD CONSTRAINT "FK_8a36539f6e19776343ccd217b25" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" ADD CONSTRAINT "FK_8ccc9ae6e5eebf1d7efa966812f" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "games" ADD CONSTRAINT "FK_fee81fc1cced413f70861c832a1" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_events" ADD CONSTRAINT "FK_c641a4f03aef07c2cd0601baf33" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "game_events" ADD CONSTRAINT "FK_d32fc4f5f738c0ad7754f35802a" FOREIGN KEY ("participantId") REFERENCES "campaign_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "game_events" DROP CONSTRAINT "FK_d32fc4f5f738c0ad7754f35802a"`);
        await queryRunner.query(`ALTER TABLE "game_events" DROP CONSTRAINT "FK_c641a4f03aef07c2cd0601baf33"`);
        await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_fee81fc1cced413f70861c832a1"`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" DROP CONSTRAINT "FK_8ccc9ae6e5eebf1d7efa966812f"`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" DROP CONSTRAINT "FK_8a36539f6e19776343ccd217b25"`);
        await queryRunner.query(`ALTER TABLE "campaign_participants" DROP CONSTRAINT "FK_e0d97d6323f4e20a4107c93a0ce"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_5c5696b2c3c57698f890b2cbbdd"`);
        await queryRunner.query(`ALTER TABLE "vehicle_advantages" DROP CONSTRAINT "FK_872a2a097d9762fed4d9e3d8a2c"`);
        await queryRunner.query(`ALTER TABLE "vehicle_improvements" DROP CONSTRAINT "FK_92a166d7a9633c90f9c7226e726"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP CONSTRAINT "FK_af76318f8ff5522ca7073e1952b"`);
        await queryRunner.query(`ALTER TABLE "weapons" DROP CONSTRAINT "FK_f82968089bc8a89c5586c7eea66"`);
        await queryRunner.query(`DROP TABLE "game_events"`);
        await queryRunner.query(`DROP TABLE "games"`);
        await queryRunner.query(`DROP TYPE "public"."games_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."games_type_enum"`);
        await queryRunner.query(`DROP TABLE "campaign_participants"`);
        await queryRunner.query(`DROP TYPE "public"."campaign_participants_status_enum"`);
        await queryRunner.query(`DROP TABLE "campaigns"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_state_enum"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP TABLE "vehicle_advantages"`);
        await queryRunner.query(`DROP TABLE "vehicle_improvements"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TABLE "weapons"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
