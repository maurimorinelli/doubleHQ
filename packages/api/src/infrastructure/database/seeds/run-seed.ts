import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root (works whether run from root or packages/api)
const rootEnv = path.resolve(process.cwd(), '../../.env');
const cwdEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: rootEnv });
dotenv.config({ path: cwdEnv });

import { AppDataSource } from '../../config/data-source';
import { FirmEntity } from '../entities/firm.entity';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { CloseTemplateEntity } from '../entities/close-template.entity';
import { TemplateSectionEntity } from '../entities/template-section.entity';
import { TemplateTaskEntity } from '../entities/template-task.entity';
import { createLogger, TeamRole } from '@doublehq/shared';
import * as bcrypt from 'bcryptjs';

const logger = createLogger('Seed');

// ─── Seed Data ────────────────────────────────────────────────────────────────

const firms: Partial<FirmEntity>[] = [
    { id: 'firm_001', name: 'Precision Bookkeeping LLC', plan: 'scale', timezone: 'America/New_York', createdAt: new Date('2024-03-15') },
    { id: 'firm_002', name: 'Summit Financial Group', plan: 'scale', timezone: 'America/Chicago', createdAt: new Date('2024-06-01') },
    { id: 'firm_003', name: 'Coastal Accounting Partners', plan: 'growth', timezone: 'America/Los_Angeles', createdAt: new Date('2024-08-20') },
    { id: 'firm_004', name: 'Northstar Tax & Advisory', plan: 'scale', timezone: 'America/Denver', createdAt: new Date('2024-11-10') },
    { id: 'firm_005', name: 'Metro Ledger Services', plan: 'growth', timezone: 'America/New_York', createdAt: new Date('2025-01-05') },
    { id: 'firm_006', name: 'TechBooks Pro', plan: 'trial', timezone: 'America/Chicago', createdAt: new Date('2025-02-15') },
];

// Team members WITHOUT passwordHash — hash is applied dynamically at seed time
const teamMembersData: Omit<Partial<TeamMemberEntity>, 'passwordHash'>[] = [
    // Firm 1: Precision Bookkeeping LLC
    { id: 'tm_001', firmId: 'firm_001', name: 'Jordan Mitchell', email: 'jordan@precisionbk.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Jordan+Mitchell&background=6366f1&color=fff', isActive: true },
    { id: 'tm_002', firmId: 'firm_001', name: 'Sarah Williams', email: 'sarah@precisionbk.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=8b5cf6&color=fff', isActive: true },
    { id: 'tm_003', firmId: 'firm_001', name: 'Mike Torres', email: 'mike@precisionbk.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Mike+Torres&background=ec4899&color=fff', isActive: true },
    { id: 'tm_004', firmId: 'firm_001', name: 'Lisa Park', email: 'lisa@precisionbk.com', role: TeamRole.REVIEWER, avatarUrl: 'https://ui-avatars.com/api/?name=Lisa+Park&background=14b8a6&color=fff', isActive: true },
    { id: 'tm_005', firmId: 'firm_001', name: 'Maria Chen', email: 'maria@precisionbk.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Maria+Chen&background=f97316&color=fff', isActive: true },
    { id: 'tm_019', firmId: 'firm_001', name: 'Nicolas Santos', email: 'nicolas@doublehq.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Nicolas+Santos&background=2563eb&color=fff', isActive: true },

    // Firm 2: Summit Financial Group
    { id: 'tm_006', firmId: 'firm_002', name: 'Alex Rivera', email: 'alex@summitfin.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=3b82f6&color=fff', isActive: true },
    { id: 'tm_007', firmId: 'firm_002', name: 'Rachel Kim', email: 'rachel@summitfin.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Rachel+Kim&background=f43f5e&color=fff', isActive: true },
    { id: 'tm_008', firmId: 'firm_002', name: 'David Nguyen', email: 'david@summitfin.com', role: TeamRole.REVIEWER, avatarUrl: 'https://ui-avatars.com/api/?name=David+Nguyen&background=10b981&color=fff', isActive: true },

    // Firm 3: Coastal Accounting Partners
    { id: 'tm_009', firmId: 'firm_003', name: 'Emma Watson', email: 'emma@coastalap.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Emma+Watson&background=a855f7&color=fff', isActive: true },
    { id: 'tm_010', firmId: 'firm_003', name: 'Carlos Mendez', email: 'carlos@coastalap.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Carlos+Mendez&background=f59e0b&color=fff', isActive: true },
    { id: 'tm_011', firmId: 'firm_003', name: 'Priya Sharma', email: 'priya@coastalap.com', role: TeamRole.REVIEWER, avatarUrl: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=06b6d4&color=fff', isActive: true },

    // Firm 4: Northstar Tax & Advisory
    { id: 'tm_012', firmId: 'firm_004', name: 'James Foster', email: 'james@northstartax.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=James+Foster&background=84cc16&color=fff', isActive: true },
    { id: 'tm_013', firmId: 'firm_004', name: 'Olivia Brown', email: 'olivia@northstartax.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Olivia+Brown&background=e11d48&color=fff', isActive: true },

    // Firm 5: Metro Ledger Services
    { id: 'tm_014', firmId: 'firm_005', name: 'Ryan Patel', email: 'ryan@metroledger.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Ryan+Patel&background=0ea5e9&color=fff', isActive: true },
    { id: 'tm_015', firmId: 'firm_005', name: 'Sophie Larsson', email: 'sophie@metroledger.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Sophie+Larsson&background=d946ef&color=fff', isActive: true },
    { id: 'tm_016', firmId: 'firm_005', name: 'Kevin O\'Brien', email: 'kevin@metroledger.com', role: TeamRole.REVIEWER, avatarUrl: 'https://ui-avatars.com/api/?name=Kevin+OBrien&background=78716c&color=fff', isActive: true },

    // Firm 6: TechBooks Pro
    { id: 'tm_017', firmId: 'firm_006', name: 'Nadia Hassan', email: 'nadia@techbookspro.com', role: TeamRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Nadia+Hassan&background=fb923c&color=fff', isActive: true },
    { id: 'tm_018', firmId: 'firm_006', name: 'Tom Bradley', email: 'tom@techbookspro.com', role: TeamRole.PREPARER, avatarUrl: 'https://ui-avatars.com/api/?name=Tom+Bradley&background=4f46e5&color=fff', isActive: true },
];

// ─── Main Seed Runner ─────────────────────────────────────────────────────────

async function seed() {
    logger.info('🌱 Starting seed (bootstrap mode)...');

    // Hash the default password from env
    const seedPassword = process.env.SEED_DEFAULT_PASSWORD;
    if (!seedPassword) {
        logger.error('❌ SEED_DEFAULT_PASSWORD env var is required. Add it to your .env file.');
        process.exit(1);
    }
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    logger.info('🔐 Default password hashed from env');

    await AppDataSource.initialize();
    logger.info('✅ Database connected');

    const manager = AppDataSource.manager;

    // Clear existing data (order matters for FK constraints)
    logger.info('🧹 Clearing existing data...');
    await manager.query('TRUNCATE TABLE "template_tasks", "template_sections", "close_templates", "journal_entry_lines", "journal_entries", "reconciliations", "imported_transactions", "cached_insights", "transaction_flags", "client_questions", "close_tasks", "close_periods", "clients", "team_members", "firms" CASCADE');

    // Seed firms
    logger.info('🏢 Seeding firms...');
    for (const f of firms) {
        await manager.save(FirmEntity, f);
    }

    // Seed team members (with hashed password from env)
    logger.info('👥 Seeding team members...');
    for (const tm of teamMembersData) {
        await manager.save(TeamMemberEntity, { ...tm, passwordHash });
    }

    // Seed close templates (one per firm)
    logger.info('📐 Seeding close templates...');

    const templateSections = [
        { name: 'Pre-Close', order: 1 },
        { name: 'Transaction Review', order: 2 },
        { name: 'Account Reconciliations', order: 3 },
        { name: 'Adjusting Entries', order: 4 },
        { name: 'Review & Sign-off', order: 5 },
    ];

    const templateTasks = [
        { sectionOrder: 1, title: 'Code bank transactions', description: 'Categorize all new bank transactions', estimatedMinutes: 60, order: 1, autoCompleteRule: 'all_transactions_categorized' },
        { sectionOrder: 1, title: 'Post payroll journal entry', description: 'Record payroll into the books', estimatedMinutes: 20, order: 2, autoCompleteRule: null },
        { sectionOrder: 1, title: 'Categorize credit card charges', description: 'Review and categorize CC transactions', estimatedMinutes: 45, order: 3, autoCompleteRule: 'all_cc_categorized' },
        { sectionOrder: 2, title: 'Review uncategorized transactions', description: 'Categorize or flag remaining items', estimatedMinutes: 30, order: 1, autoCompleteRule: 'no_uncategorized_remaining' },
        { sectionOrder: 2, title: 'Check for duplicate transactions', description: 'Identify and resolve duplicates', estimatedMinutes: 20, order: 2, autoCompleteRule: null },
        { sectionOrder: 3, title: 'Reconcile primary checking', description: 'Match transactions against bank statement', estimatedMinutes: 45, order: 1, autoCompleteRule: 'checking_reconciled' },
        { sectionOrder: 3, title: 'Reconcile credit card', description: 'Match CC transactions to statement', estimatedMinutes: 30, order: 2, autoCompleteRule: 'cc_reconciled' },
        { sectionOrder: 4, title: 'Post monthly depreciation', description: 'Record depreciation for fixed assets', estimatedMinutes: 15, order: 1, autoCompleteRule: 'depreciation_posted' },
        { sectionOrder: 4, title: 'Post prepaid expense amortization', description: 'Amortize prepaids', estimatedMinutes: 15, order: 2, autoCompleteRule: null },
        { sectionOrder: 5, title: 'Review P&L statement', description: 'Verify P&L accuracy', estimatedMinutes: 30, order: 1, autoCompleteRule: null },
        { sectionOrder: 5, title: 'Review Balance Sheet', description: 'Verify balance sheet', estimatedMinutes: 30, order: 2, autoCompleteRule: null },
    ];

    let tmplIdx = 0;
    let tsIdx = 0;
    let ttIdx = 0;

    for (const f of firms) {
        tmplIdx++;
        const tmplId = `tmpl_${String(tmplIdx).padStart(3, '0')}`;

        await manager.save(CloseTemplateEntity, {
            id: tmplId,
            firmId: f.id!,
            name: 'Standard Monthly Close',
            isDefault: true,
        });

        const sectionIds: Record<number, string> = {};
        for (const sec of templateSections) {
            tsIdx++;
            const tsId = `ts_${String(tsIdx).padStart(3, '0')}`;
            sectionIds[sec.order] = tsId;
            await manager.save(TemplateSectionEntity, {
                id: tsId,
                templateId: tmplId,
                name: sec.name,
                order: sec.order,
            });
        }

        for (const task of templateTasks) {
            ttIdx++;
            await manager.save(TemplateTaskEntity, {
                id: `tt_${String(ttIdx).padStart(3, '0')}`,
                sectionId: sectionIds[task.sectionOrder],
                title: task.title,
                description: task.description,
                estimatedMinutes: task.estimatedMinutes,
                order: task.order,
                autoCompleteRule: task.autoCompleteRule,
            });
        }
    }

    logger.info('');
    logger.info('✅ Seed complete!');
    logger.info(`   🏢 ${firms.length} firms`);
    logger.info(`   👥 ${teamMembersData.length} team members`);
    logger.info(`   📐 ${firms.length} close templates (5 sections, 11 tasks each)`);
    logger.info('');
    logger.info('   ℹ️  No clients seeded — create them from the app.');
    logger.info('');
    logger.info('   📋 Demo logins (password from SEED_DEFAULT_PASSWORD env):');
    for (const f of firms) {
        const mgr = teamMembersData.find(tm => tm.firmId === f.id && tm.role === 'manager');
        if (mgr) {
            logger.info(`      ${f.name}: ${mgr.email}`);
        }
    }

    await AppDataSource.destroy();
    process.exit(0);
}

seed().catch(err => {
    logger.error('❌ Seed failed', err);
    process.exit(1);
});
