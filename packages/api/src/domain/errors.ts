export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class ClientNotFoundError extends AppError {
    constructor(clientId: string) {
        super('CLIENT_NOT_FOUND', `Client with id '${clientId}' not found`, 404);
        this.name = 'ClientNotFoundError';
    }
}

export class InsightGenerationError extends AppError {
    constructor(reason: string) {
        super('INSIGHT_GENERATION_FAILED', `Failed to generate insights: ${reason}`, 503);
        this.name = 'InsightGenerationError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message, 400);
        this.name = 'ValidationError';
    }
}
