import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionIdToFlags1741730000000 implements MigrationInterface {
    name = 'AddTransactionIdToFlags1741730000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "transaction_flags"
            ADD COLUMN IF NOT EXISTS "transactionId" varchar
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "transaction_flags"
            DROP COLUMN IF EXISTS "transactionId"
        `);
    }
}
