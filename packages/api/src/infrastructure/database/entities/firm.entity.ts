import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('firms')
export class FirmEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    name!: string;

    @Column()
    plan!: string;

    @Column()
    timezone!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
