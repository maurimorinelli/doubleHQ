import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgres://doublehq:doublehq_dev@localhost:5433/doublehq_copilot',
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
    entities: [path.join(__dirname, '../database/entities/*.{ts,js}')],
    migrations: [path.join(__dirname, '../database/migrations/*.{ts,js}')],
});
