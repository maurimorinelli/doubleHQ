import { TransactionType, BankAccountType, TransactionStatus } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClosePeriodEntity } from './close-period.entity';
import { ClientEntity } from './client.entity';

@Entity('imported_transactions')
export class ImportedTransactionEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    closePeriodId!: string;

    @Column()
    clientId!: string;

    @Column({ type: 'date' })
    date!: Date;

    @Column({ type: 'text', default: '' })
    description!: string;

    @Column({ default: '' })
    vendor!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    amount!: number;

    @Column({ default: 'debit' })
    type!: TransactionType; // debit | credit

    @Column({ default: 'checking' })
    bankAccount!: BankAccountType; // checking | credit_card

    @Column({ type: 'varchar', nullable: true })
    importedCategory!: string | null;

    @Column({ type: 'varchar', nullable: true })
    finalCategory!: string | null;

    @Column({ default: 'uncategorized' })
    status!: TransactionStatus; // categorized | uncategorized | flagged | pending_client

    @Column({ type: 'varchar', nullable: true })
    aiSuggestedCategory!: string | null;

    @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
    aiConfidence!: number | null;

    @Column({ type: 'varchar', nullable: true })
    reviewedBy!: string | null;

    @Column({ type: 'timestamp', nullable: true })
    reviewedAt!: Date | null;

    @Column({ type: 'boolean', default: false })
    isManual!: boolean;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;

    @ManyToOne(() => ClientEntity)
    @JoinColumn({ name: 'clientId' })
    client!: ClientEntity;
}
