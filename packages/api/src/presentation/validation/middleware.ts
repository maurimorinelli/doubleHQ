import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { ValidatedQueryRequest } from '../types/request-types';

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success: replaces req.body with the parsed (and default-applied) result.
 * On failure: responds with 400 + structured error details.
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: formatZodErrors(result.error),
                });
                return;
            }
            req.body = result.data;
            next();
        } catch (err) {
            res.status(500).json({ error: 'Internal validation error', message: String(err) });
        }
    };
}

/**
 * Express middleware factory that validates req.query against a Zod schema.
 * On success: attaches validated query as `req.validatedQuery` (typed).
 * On failure: responds with 400 + structured error details.
 */
export function validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                res.status(400).json({
                    error: 'Invalid query parameters',
                    details: formatZodErrors(result.error),
                });
                return;
            }
            (req as ValidatedQueryRequest).validatedQuery = result.data as Record<string, unknown>;
            next();
        } catch (err) {
            res.status(500).json({ error: 'Internal validation error', message: String(err) });
        }
    };
}

function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
    const items = error?.issues;
    if (!items || !Array.isArray(items)) {
        return [{ field: '(unknown)', message: String(error) }];
    }
    return items.map((e: ZodIssue) => ({
        field: e.path.join('.') || '(root)',
        message: e.message,
    }));
}
