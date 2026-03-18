import { Request } from 'express';
import { AuthUser } from '../middleware/auth.middleware';

/**
 * Typed Express request interfaces.
 *
 * These replace unsafe `(req as any)` casts throughout the presentation layer.
 */

/** Request enriched with a unique request ID by the requestIdMiddleware. */
export interface RequestWithId extends Request {
    requestId: string;
}

/** Authenticated request — carries the decoded JWT payload. */
export interface AuthRequest extends Request {
    user: AuthUser;
    requestId: string;
}

/** Request with validated query parameters (set by validateQuery middleware). */
export interface ValidatedQueryRequest<T = Record<string, unknown>> extends AuthRequest {
    validatedQuery: T;
}
