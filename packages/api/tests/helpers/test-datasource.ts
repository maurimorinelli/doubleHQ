import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as path from 'path';

let container: StartedPostgreSqlContainer | null = null;
let dataSource: DataSource | null = null;

/**
 * Starts a PostgreSQL Testcontainer and creates a TypeORM DataSource.
 * Uses `synchronize: true` to create tables from entity metadata.
 */
export async function createTestDataSource(): Promise<DataSource> {
    if (dataSource?.isInitialized) return dataSource;

    container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('doublehq_test')
        .withUsername('test')
        .withPassword('test')
        .start();

    dataSource = new DataSource({
        type: 'postgres',
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        username: container.getUsername(),
        password: container.getPassword(),
        synchronize: true,
        logging: false,
        entities: [path.join(__dirname, '../../src/infrastructure/database/entities/*.{ts,js}')],
    });

    await dataSource.initialize();
    return dataSource;
}

/**
 * Clears all tables between tests for isolation.
 * Disables FK constraints temporarily so order doesn't matter.
 */
export async function clearAll(ds: DataSource): Promise<void> {
    const entities = ds.entityMetadatas;
    for (const entity of entities) {
        const repo = ds.getRepository(entity.name);
        await repo.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }
}

/**
 * Shuts down the DataSource and container after all tests.
 */
export async function stopContainer(): Promise<void> {
    if (dataSource?.isInitialized) {
        await dataSource.destroy();
        dataSource = null;
    }
    if (container) {
        await container.stop();
        container = null;
    }
}
