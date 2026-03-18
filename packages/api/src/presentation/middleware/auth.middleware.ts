import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
    userId: string;
    firmId: string;
    email: string;
    role: string;
    name: string;
}

export interface AuthRequest extends Request {
    user: AuthUser;
}

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

let _jwtSecret: string | null = null;

function getJwtSecret(): string {
    if (!_jwtSecret) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error(
                'JWT_SECRET environment variable is required. ' +
                'Set it in your .env file or deployment environment.',
            );
        }
        _jwtSecret = secret;
    }
    return _jwtSecret;
}

const JWT_EXPIRES_IN = '7d';

export function signToken(payload: AuthUser): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthUser {
    return jwt.verify(token, getJwtSecret()) as AuthUser;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const token = header.substring(7);

    try {
        const user = verifyToken(token);
        (req as AuthRequest).user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
