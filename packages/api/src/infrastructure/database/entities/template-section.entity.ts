import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { CloseTemplateEntity } from './close-template.entity';
import { TemplateTaskEntity } from './template-task.entity';

@Entity('template_sections')
export class TemplateSectionEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    templateId!: string;

    @Column()
    name!: string;

    @Column({ type: 'int', default: 0 })
    order!: number;

    @ManyToOne(() => CloseTemplateEntity, template => template.sections)
    @JoinColumn({ name: 'templateId' })
    template!: CloseTemplateEntity;

    @OneToMany(() => TemplateTaskEntity, task => task.section, { eager: true })
    tasks!: TemplateTaskEntity[];
}
