import { CloseSection, TaskStatus, TaskTargetTab } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClosePeriodEntity } from './close-period.entity';
import { TeamMemberEntity } from './team-member.entity';

@Entity('close_tasks')
export class CloseTaskEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    closePeriodId!: string;

    @Column()
    section!: CloseSection;

    @Column({ type: 'int', default: 1 })
    sectionOrder!: number;

    @Column()
    title!: string;

    @Column({ type: 'text', default: '' })
    description!: string;

    @Column({ default: 'not_started' })
    status!: TaskStatus;

    @Column({ type: 'varchar', nullable: true })
    autoCompleteRule!: string | null;

    @Column()
    assigneeId!: string;

    @Column({ type: 'date' })
    dueDate!: Date;

    @Column({ type: 'date', nullable: true })
    completedDate!: Date | null;

    @Column({ type: 'text', nullable: true })
    blockedReason!: string | null;

    @Column({ type: 'int', default: 0 })
    order!: number;

    @Column({ default: 'overview' })
    targetTab!: TaskTargetTab;

    @Column({ type: 'int', default: 30 })
    estimatedMinutes!: number;

    @Column({ type: 'int', nullable: true })
    actualMinutes!: number | null;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'assigneeId' })
    assignee!: TeamMemberEntity;
}
