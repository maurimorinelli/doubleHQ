import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordHashToTeamMembers1741800000000 implements MigrationInterface {
    name = 'AddPasswordHashToTeamMembers1741800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team_members" ADD "passwordHash" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN "passwordHash"`);
    }
}
