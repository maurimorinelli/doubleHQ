import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testTimeout: 60_000, // Testcontainers needs time to start PostgreSQL
    roots: ['<rootDir>/tests'],
    moduleNameMapper: {
        '^@doublehq/shared$': '<rootDir>/../shared/src',
        '^@doublehq/shared/(.*)$': '<rootDir>/../shared/src/$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                target: 'ES2022',
                module: 'commonjs',
                lib: ['ES2022'],
                strict: false,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: false,
                sourceMap: true,
                moduleResolution: 'node',
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                strictPropertyInitialization: false,
            },
            diagnostics: false, // Skip TS diagnostics — we rely on tsc for that
        }],
    },
};

export default config;
