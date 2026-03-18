import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignoffFieldsToClosePeriods1741900000000 implements MigrationInterface {
    name = 'AddSignoffFieldsToClosePeriods1741900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "close_periods" ADD "signedOffBy" varchar`);
        await queryRunner.query(`ALTER TABLE "close_periods" ADD "reviewNotes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "close_periods" DROP COLUMN "reviewNotes"`);
        await queryRunner.query(`ALTER TABLE "close_periods" DROP COLUMN "signedOffBy"`);
    }
}
