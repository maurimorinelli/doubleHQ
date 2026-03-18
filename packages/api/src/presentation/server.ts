import express from 'express';
import cors from 'cors';
import { requestIdMiddleware, errorHandler } from './middleware/error-handler';

export function createServer() {
    const app = express();

    // --- Middleware ---
    app.use(cors());
    app.use(express.json());
    app.use(requestIdMiddleware);

    // --- Health check ---
    app.get('/api/health', (_req, res) => {
        res.json({ data: { status: 'ok' }, meta: { timestamp: new Date().toISOString() } });
    });

    // Routes will be attached in main.ts after DI wiring

    // --- Error handler (must be last) ---
    app.use(errorHandler);

    return app;
}
