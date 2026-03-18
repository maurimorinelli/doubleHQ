import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTemplates, createClient } from '../api/client';
import type { CreateClientRequest } from '@doublehq/shared';

const industries = [
    'Technology', 'Healthcare', 'Retail', 'Restaurant', 'Real Estate',
    'Professional Services', 'Manufacturing', 'Construction', 'Education', 'Nonprofit',
    'E-commerce', 'Legal', 'Financial Services', 'Marketing Agency', 'Other',
];

function getPreviousPeriod(): string {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

export default function NewClientPage() {
    const navigate = useNavigate();

    const [templates, setTemplates] = useState<Array<{ id: string; name: string; isDefault: boolean; sections: Array<{ name: string; tasks: Array<{ title: string }> }> }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startCloseNow, setStartCloseNow] = useState(false);

    // Form state
    const [form, setForm] = useState<CreateClientRequest>({
        name: '',
        industry: 'Technology',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        accountType: 'accrual',
        monthlyRevenue: 50000,
        fiscalYearEnd: 12,
        qboConnected: true,
        notes: '',
        templateId: '',
        closePeriod: getPreviousPeriod(),
    });

    useEffect(() => {
        fetchTemplates().then((data) => {
            setTemplates(data.templates);
            const def = data.templates.find((t) => t.isDefault) || data.templates[0];
            if (def) setForm((prev) => ({ ...prev, templateId: def.id }));
        });
    }, []);

    const update = (key: keyof CreateClientRequest, value: any) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            // When toggle is off, don't send close period data
            const payload = startCloseNow
                ? form
                : { ...form, templateId: undefined, closePeriod: undefined };
            const result = await createClient(payload as CreateClientRequest);
            navigate(`/clients/${result.clientId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create client');
            setLoading(false);
        }
    };

    const selectedTemplate = templates.find((t) => t.id === form.templateId);

    return (
        <>
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">New Client</h1>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8">

                    {/* Client Info */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">business</span>
                            Client Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    placeholder="e.g. Acme Corporation"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry *</label>
                                <select
                                    value={form.industry}
                                    onChange={(e) => update('industry', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                >
                                    {industries.map((i) => (
                                        <option key={i} value={i}>{i}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monthly Revenue *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                    <input
                                        required
                                        type="number"
                                        min={0}
                                        value={form.monthlyRevenue}
                                        onChange={(e) => update('monthlyRevenue', Number(e.target.value))}
                                        className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">person</span>
                            Contact Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.contactName}
                                    onChange={(e) => update('contactName', e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                                <input
                                    required
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={(e) => update('contactEmail', e.target.value)}
                                    placeholder="john@acme.com"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                                <input
                                    type="tel"
                                    value={form.contactPhone}
                                    onChange={(e) => update('contactPhone', e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Accounting Settings */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">settings</span>
                            Accounting Settings
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Type</label>
                                <select
                                    value={form.accountType}
                                    onChange={(e) => update('accountType', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                >
                                    <option value="accrual">Accrual</option>
                                    <option value="cash">Cash</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fiscal Year End</label>
                                <select
                                    value={form.fiscalYearEnd}
                                    onChange={(e) => update('fiscalYearEnd', Number(e.target.value))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(2024, i, 1).toLocaleString('en', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="flex items-center gap-3 cursor-pointer py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={form.qboConnected}
                                        onChange={(e) => update('qboConnected', e.target.checked)}
                                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm font-medium text-slate-700">QBO Connected</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Close Period Toggle */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">calendar_month</span>
                                Monthly Close
                            </h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={startCloseNow}
                                    onChange={(e) => setStartCloseNow(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                <span className="ms-3 text-sm font-medium text-slate-700">Start close now</span>
                            </label>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            {startCloseNow
                                ? 'A close period will be created with AI-generated transactions.'
                                : 'You can start a close later from the client detail page.'}
                        </p>

                        {startCloseNow && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 mt-4">Template</label>
                                    <select
                                        value={form.templateId}
                                        onChange={(e) => update('templateId', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                    >
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name} {t.isDefault ? '(Default)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedTemplate && (
                                        <p className="mt-2 text-xs text-slate-500">
                                            {selectedTemplate.sections.length} sections · {selectedTemplate.sections.reduce((sum, s) => sum + s.tasks.length, 0)} tasks
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 mt-4">Period</label>
                                    <input
                                        type="month"
                                        value={form.closePeriod}
                                        onChange={(e) => update('closePeriod', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">notes</span>
                            Notes
                        </h2>
                        <textarea
                            value={form.notes}
                            onChange={(e) => update('notes', e.target.value)}
                            placeholder="Optional notes about this client..."
                            rows={3}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-4 pt-2 pb-8">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !form.name}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                    {startCloseNow ? 'Creating client & generating data...' : 'Creating client...'}
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">add_circle</span>
                                    {startCloseNow ? 'Create Client & Start Close' : 'Create Client'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
