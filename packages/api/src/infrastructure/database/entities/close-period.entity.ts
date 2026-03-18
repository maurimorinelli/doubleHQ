import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClientEntity } from './client.entity';
import { TeamMemberEntity } from './team-member.entity';
import { ClosePeriodStatus, HealthStatus } from '@doublehq/shared';

@Entity('close_periods')
export class ClosePeriodEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    clientId!: string;

    @Column()
    period!: string;

    @Column({ default: 'not_started' })
    status!: ClosePeriodStatus;

    @Column({ type: 'date' })
    startDate!: Date;

    @Column({ type: 'date' })
    dueDate!: Date;

    @Column({ type: 'date', nullable: true })
    completedDate!: Date | null;

    @Column()
    preparerId!: string;

    @Column()
    reviewerId!: string;

    @Column({ type: 'int', default: 0 })
    totalTasks!: number;

    @Column({ type: 'int', default: 0 })
    completedTasks!: number;

    @Column({ type: 'int', default: 0 })
    blockedTasks!: number;

    @Column({ type: 'int', default: 0 })
    healthScore!: number;

    @Column({ default: 'not_started' })
    healthStatus!: HealthStatus;

    @Column({ type: 'int', default: 0 })
    previousCloseTime!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: 'varchar', nullable: true })
    signedOffBy!: string | null;

    @Column({ type: 'text', nullable: true })
    reviewNotes!: string | null;

    @ManyToOne(() => ClientEntity)
    @JoinColumn({ name: 'clientId' })
    client!: ClientEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'preparerId' })
    preparer!: TeamMemberEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'reviewerId' })
    reviewer!: TeamMemberEntity;
}
