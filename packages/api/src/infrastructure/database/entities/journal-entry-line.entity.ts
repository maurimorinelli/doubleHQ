import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { JournalEntryEntity } from './journal-entry.entity';

@Entity('journal_entry_lines')
export class JournalEntryLineEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    journalEntryId!: string;

    @Column()
    accountName!: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    debit!: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    credit!: number | null;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @ManyToOne(() => JournalEntryEntity, entry => entry.lines)
    @JoinColumn({ name: 'journalEntryId' })
    journalEntry!: JournalEntryEntity;
}
