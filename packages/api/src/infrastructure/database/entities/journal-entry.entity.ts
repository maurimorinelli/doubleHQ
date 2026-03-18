import { JournalEntryType, JournalEntryStatus } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ClosePeriodEntity } from './close-period.entity';
import { TeamMemberEntity } from './team-member.entity';
import { JournalEntryLineEntity } from './journal-entry-line.entity';

@Entity('journal_entries')
export class JournalEntryEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    closePeriodId!: string;

    @Column({ type: 'date' })
    date!: Date;

    @Column({ type: 'text', default: '' })
    memo!: string;

    @Column({ default: 'adjustment' })
    type!: JournalEntryType; // depreciation | adjustment | recurring | correction

    @Column({ default: 'draft' })
    status!: JournalEntryStatus; // draft | posted | reviewed

    @Column()
    createdBy!: string;

    @Column({ type: 'timestamp', nullable: true })
    postedAt!: Date | null;

    @ManyToOne(() => ClosePeriodEntity)
    @JoinColumn({ name: 'closePeriodId' })
    closePeriod!: ClosePeriodEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'createdBy' })
    creator!: TeamMemberEntity;

    @OneToMany(() => JournalEntryLineEntity, line => line.journalEntry, { eager: true, cascade: true })
    lines!: JournalEntryLineEntity[];
}
