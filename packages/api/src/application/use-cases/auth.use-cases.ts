import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AuthRepository, FirmRepository } from '../../domain/ports';
import { signToken } from '../../presentation/middleware/auth.middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUserResponse {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        firmId: string;
        firmName: string;
        avatarUrl: string;
    };
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    firmId: string;
    firmName: string;
    avatarUrl: string;
}

// ─── Login Use Case ──────────────────────────────────────────────────────────

export class LoginUseCase {
    constructor(private authRepo: AuthRepository) { }

    async execute(email: string, password: string): Promise<AuthUserResponse> {
        if (!email || !password) {
            throw new LoginValidationError('Email and password are required');
        }

        const user = await this.authRepo.findByEmail(email.toLowerCase().trim());
        if (!user || !user.passwordHash) {
            throw new InvalidCredentialsError();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            throw new InvalidCredentialsError();
        }

        const token = signToken({
            userId: user.id,
            firmId: user.firmId,
            email: user.email,
            role: user.role,
            name: user.name,
        });

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                firmId: user.firmId,
                firmName: user.firmName || '',
                avatarUrl: user.avatarUrl,
            },
        };
    }
}

// ─── Register Use Case ───────────────────────────────────────────────────────

export class RegisterUseCase {
    constructor(
        private authRepo: AuthRepository,
        private firmRepo: FirmRepository,
    ) { }

    async execute(data: {
        firmName: string;
        name: string;
        email: string;
        password: string;
    }): Promise<AuthUserResponse> {
        if (!data.firmName || !data.name || !data.email || !data.password) {
            throw new LoginValidationError('firmName, name, email, and password are required');
        }

        const existing = await this.authRepo.findByEmail(data.email.toLowerCase().trim());
        if (existing) {
            throw new EmailAlreadyExistsError();
        }

        const firmId = uuid();
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create firm
        await this.firmRepo.save({
            id: firmId,
            name: data.firmName,
            plan: 'trial',
            timezone: 'America/New_York',
        });

        // Create admin user
        const user = await this.authRepo.createWithPassword(
            {
                id: uuid(),
                firmId,
                name: data.name,
                email: data.email.toLowerCase().trim(),
                role: 'manager',
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=6366f1&color=fff`,
                isActive: true,
            },
            passwordHash,
        );

        const token = signToken({
            userId: user.id,
            firmId: user.firmId,
            email: user.email,
            role: user.role,
            name: user.name,
        });

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                firmId: user.firmId,
                firmName: data.firmName,
                avatarUrl: user.avatarUrl,
            },
        };
    }
}

// ─── Get Current User Use Case ───────────────────────────────────────────────

export class GetCurrentUserUseCase {
    constructor(private authRepo: AuthRepository) { }

    async execute(userId: string): Promise<UserProfile> {
        const user = await this.authRepo.findByIdWithFirm(userId);
        if (!user) {
            throw new UserNotFoundError();
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            firmId: user.firmId,
            firmName: user.firmName || '',
            avatarUrl: user.avatarUrl,
        };
    }
}

// ─── Auth-specific Errors ────────────────────────────────────────────────────

import { AppError } from '../../domain/errors';

export class LoginValidationError extends AppError {
    constructor(message: string) {
        super('AUTH_VALIDATION', message, 400);
        this.name = 'LoginValidationError';
    }
}

export class InvalidCredentialsError extends AppError {
    constructor() {
        super('INVALID_CREDENTIALS', 'Invalid email or password', 401);
        this.name = 'InvalidCredentialsError';
    }
}

export class EmailAlreadyExistsError extends AppError {
    constructor() {
        super('EMAIL_EXISTS', 'An account with this email already exists', 409);
        this.name = 'EmailAlreadyExistsError';
    }
}

export class UserNotFoundError extends AppError {
    constructor() {
        super('USER_NOT_FOUND', 'User not found', 404);
        this.name = 'UserNotFoundError';
    }
}
