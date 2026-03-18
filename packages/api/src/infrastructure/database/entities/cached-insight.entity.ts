import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('cached_insights')
export class CachedInsightEntity {
    @PrimaryColumn()
    id!: string;

    @Column()
    firmId!: string;

    @Column({ type: 'jsonb' })
    insights!: unknown;

    @Column({ type: 'timestamp' })
    generatedAt!: Date;

    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    @Column()
    promptHash!: string;

    @Column({ default: 'gpt-4' })
    model!: string;

    @Column({ type: 'int', default: 0 })
    tokenCount!: number;
}
