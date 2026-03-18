import { Router, Request, Response, NextFunction } from 'express';
import { LoginUseCase, RegisterUseCase, GetCurrentUserUseCase } from '../../application/use-cases/auth.use-cases';
import { AppError } from '../../domain/errors';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res).catch(next);
    };
}

// ─── Dependencies ────────────────────────────────────────────────────────────

export interface AuthRouteDependencies {
    login: LoginUseCase;
    register: RegisterUseCase;
    getCurrentUser: GetCurrentUserUseCase;
}

// ─── Route Factory ───────────────────────────────────────────────────────────

export function createAuthRoutes(deps: AuthRouteDependencies): Router {
    const router = Router();

    // ─── POST /api/auth/login ────────────────────────────────────────────────
    router.post('/login', wrap(async (req, res) => {
        try {
            const result = await deps.login.execute(req.body.email, req.body.password);
            res.json({ data: result });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
                return;
            }
            throw error;
        }
    }));

    // ─── POST /api/auth/register ─────────────────────────────────────────────
    router.post('/register', wrap(async (req, res) => {
        try {
            const result = await deps.register.execute(req.body);
            res.status(201).json({ data: result });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
                return;
            }
            throw error;
        }
    }));

    // ─── GET /api/auth/me ────────────────────────────────────────────────────
    router.get('/me', authMiddleware, wrap(async (req, res) => {
        try {
            const authReq = req as AuthRequest;
            const result = await deps.getCurrentUser.execute(authReq.user.userId);
            res.json({ data: result });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
                return;
            }
            throw error;
        }
    }));

    return router;
}
