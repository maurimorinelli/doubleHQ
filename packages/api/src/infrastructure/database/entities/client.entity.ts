import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AccountType } from '@doublehq/shared';
import { FirmEntity } from './firm.entity';
import { TeamMemberEntity } from './team-member.entity';

@Entity('clients')
export class ClientEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    firmId!: string;

    @Column()
    name!: string;

    @Column()
    industry!: string;

    @Column()
    contactName!: string;

    @Column()
    contactEmail!: string;

    @Column({ default: '' })
    contactPhone!: string;

    @Column({ default: false })
    qboConnected!: boolean;

    @Column({ default: false })
    xeroConnected!: boolean;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    monthlyRevenue!: number;

    @Column()
    preparerId!: string;

    @Column()
    reviewerId!: string;

    @Column({ default: 'accrual' })
    accountType!: AccountType;

    @Column({ type: 'int', default: 12 })
    fiscalYearEnd!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: 'text', default: '' })
    notes!: string;

    @ManyToOne(() => FirmEntity)
    @JoinColumn({ name: 'firmId' })
    firm!: FirmEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'preparerId' })
    preparer!: TeamMemberEntity;

    @ManyToOne(() => TeamMemberEntity)
    @JoinColumn({ name: 'reviewerId' })
    reviewer!: TeamMemberEntity;
}
