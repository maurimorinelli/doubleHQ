import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { AppError } from '../../domain/errors';
import { createLogger } from '@doublehq/shared';
import { RequestWithId } from '../types/request-types';

const logger = createLogger('ErrorHandler');

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    const requestId = (req as RequestWithId).requestId || uuid();
    const timestamp = new Date().toISOString();

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: { code: err.code, message: err.message, statusCode: err.statusCode },
            meta: { timestamp, requestId },
        });
        return;
    }

    // Unexpected errors
    logger.error('Unhandled error', err, { requestId });
    res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', statusCode: 500 },
        meta: { timestamp, requestId },
    });
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
    (req as RequestWithId).requestId = uuid();
    next();
}
