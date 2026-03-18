import { QuestionCategory, QuestionStatus } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClosePeriodEntity } from './close-period.entity';
import { ClientEntity } from './client.entity';

@Entity('client_questions')
export class ClientQuestionEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    closePeriodId!: string;

    @Column()
    clientId!: string;

    @Column({ type: 'text' })
    question!: string;

    @Column({ default: 'transaction_clarification' })
    category!: QuestionCategory;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    transactionAmount!: number;

    @Column({ type: 'date' })
    transactionDate!: Date;

    @Column({ default: '' })
    transactionVendor!: string;

    @Column({ type: 'timestamp' })
    sentAt!: Date;

    @Column({ type: 'timestamp', nullable: true })
    respondedAt!: Date | null;

    @Column({ type: 'text', nullable: true })
    response!: string | null;

    @Column({ default: 'pending' })
    status!: QuestionStatus;

    @Column({ type: 'int', default: 0 })
    remindersSent!: number;

    @Column({ type: 'timestamp', nullable: true })
    lastReminderAt!: Date | null;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;

    @ManyToOne(() => ClientEntity)
    @JoinColumn({ name: 'clientId' })
    client!: ClientEntity;
}
