import { TeamRole } from '@doublehq/shared';
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FirmEntity } from './firm.entity';

@Entity('team_members')
export class TeamMemberEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    firmId!: string;

    @Column()
    name!: string;

    @Column()
    email!: string;

    @Column()
    role!: TeamRole;

    @Column()
    avatarUrl!: string;

    @Column({ type: 'varchar', nullable: true })
    passwordHash!: string | null;

    @Column({ default: true })
    isActive!: boolean;

    @ManyToOne(() => FirmEntity)
    @JoinColumn({ name: 'firmId' })
    firm!: FirmEntity;
}
