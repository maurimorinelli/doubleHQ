import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { FirmEntity } from './firm.entity';
import { TemplateSectionEntity } from './template-section.entity';

@Entity('close_templates')
export class CloseTemplateEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    firmId!: string;

    @Column()
    name!: string;

    @Column({ default: false })
    isDefault!: boolean;

    @ManyToOne(() => FirmEntity)
    @JoinColumn({ name: 'firmId' })
    firm!: FirmEntity;

    @OneToMany(() => TemplateSectionEntity, section => section.template, { eager: true })
    sections!: TemplateSectionEntity[];
}
