import { FlagType } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClientEntity } from './client.entity';
import { ClosePeriodEntity } from './close-period.entity';

@Entity('transaction_flags')
export class TransactionFlagEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    clientId!: string;

    @Column()
    closePeriodId!: string;

    @Column({ type: 'varchar', nullable: true })
    transactionId!: string | null;

    @Column()
    type!: FlagType;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    amount!: number;

    @Column({ type: 'date' })
    transactionDate!: Date;

    @Column({ default: '' })
    vendor!: string;

    @Column({ type: 'varchar', nullable: true })
    accountCoded!: string | null;

    @Column({ type: 'varchar', nullable: true })
    suggestedAccount!: string | null;

    @Column({ default: false })
    isResolved!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    resolvedAt!: Date | null;

    @Column({ type: 'varchar', nullable: true })
    resolvedBy!: string | null;

    @Column({ type: 'timestamp' })
    flaggedAt!: Date;

    @ManyToOne(() => ClientEntity)
    @JoinColumn({ name: 'clientId' })
    client!: ClientEntity;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;
}
