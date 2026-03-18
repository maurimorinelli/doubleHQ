import { ReconciliationStatus } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClosePeriodEntity } from './close-period.entity';

@Entity('reconciliations')
export class ReconciliationEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    closePeriodId!: string;

    @Column()
    accountName!: string;

    @Column({ default: '' })
    accountNumber!: string; // last 4 digits

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    bookBalance!: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    bankBalance!: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    difference!: number;

    @Column({ default: 'not_started' })
    status!: ReconciliationStatus; // not_started | in_progress | reconciled

    @Column({ type: 'varchar', nullable: true })
    reconciledBy!: string | null;

    @Column({ type: 'timestamp', nullable: true })
    reconciledAt!: Date | null;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;
}
