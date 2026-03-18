import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TemplateSectionEntity } from './template-section.entity';

@Entity('template_tasks')
export class TemplateTaskEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    sectionId!: string;

    @Column()
    title!: string;

    @Column({ type: 'text', default: '' })
    description!: string;

    @Column({ type: 'int', default: 30 })
    estimatedMinutes!: number;

    @Column({ type: 'int', default: 0 })
    order!: number;

    @Column({ type: 'varchar', nullable: true })
    autoCompleteRule!: string | null; // null = manual checkbox, or AutoCompleteRule enum value

    @ManyToOne(() => TemplateSectionEntity, section => section.tasks)
    @JoinColumn({ name: 'sectionId' })
    section!: TemplateSectionEntity;
}
