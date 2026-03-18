import { useState } from 'react';
import { useTeamWorkload } from '../hooks/queries/useTeam';
import { useCreateTeamMember } from '../hooks/mutations/useCloseMutations';
import Modal from '../components/ui/Modal';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import type { CapacityStatus } from '@doublehq/shared';

const capacityStyles: Record<CapacityStatus, { badge: string; badgeBg: string; label: string; avatarBg: string; avatarText: string }> = {
    overloaded: { badge: 'text-red-600', badgeBg: 'bg-red-100', label: 'Overloaded', avatarBg: 'bg-red-100', avatarText: 'text-red-600' },
    moderate: { badge: 'text-amber-600', badgeBg: 'bg-amber-100', label: 'Moderate', avatarBg: 'bg-amber-100', avatarText: 'text-amber-600' },
    balanced: { badge: 'text-emerald-600', badgeBg: 'bg-emerald-100', label: 'Balanced', avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-600' },
    available: { badge: 'text-primary', badgeBg: 'bg-blue-100', label: 'Available', avatarBg: 'bg-blue-100', avatarText: 'text-primary' },
};

export default function TeamPage() {
    const { data, isLoading, error } = useTeamWorkload();
    const createMember = useCreateTeamMember();
    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('preparer');

    const handleAdd = () => {
        if (!newName || !newEmail) return;
        createMember.mutate(
            { name: newName, email: newEmail, role: newRole },
            {
                onSuccess: () => {
                    setShowAddModal(false);
                    setNewName(''); setNewEmail(''); setNewRole('preparer');
                },
            },
        );
    };

    return (
        <>
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Team Workload</h1>
                        {data && <p className="text-slate-500 mt-1 font-medium text-lg">{data.period} Close Cycle</p>}
                    </div>
                    <div className="flex items-center gap-4">
                        {data && (
                            <div className="flex gap-8 items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <DataCard label="Team" value={`${data.summary.totalMembers} members`} />
                                <div className="w-px h-8 bg-slate-200" />
                                <DataCard label="Active" value={`${data.summary.totalActiveCloses} closes`} />
                                <div className="w-px h-8 bg-slate-200" />
                                <DataCard label="Done" value={`${data.summary.totalCompleted} completed`} />
                            </div>
                        )}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">person_add</span>
                            Add Member
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
                    <EmptyState loading={isLoading} error={error?.message}>
                        {data && (
                            <>
                                {/* Team Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {data.members.map((member) => {
                                        const cap = capacityStyles[member.capacityStatus] || capacityStyles.balanced;
                                        const total = member.statusBreakdown.onTrack + member.statusBreakdown.atRisk + member.statusBreakdown.behind + member.statusBreakdown.completed;
                                        const pctOn = total > 0 ? Math.round((member.statusBreakdown.onTrack / total) * 100) : 0;
                                        const pctAt = total > 0 ? Math.round((member.statusBreakdown.atRisk / total) * 100) : 0;
                                        const pctBehind = total > 0 ? Math.round((member.statusBreakdown.behind / total) * 100) : 0;

                                        return (
                                            <div key={member.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex gap-4 items-center">
                                                        <div className={`w-14 h-14 rounded-full ${cap.avatarBg} ${cap.avatarText} flex items-center justify-center font-bold text-xl border-2 border-white`}>
                                                            {member.initials}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-slate-900 leading-none">{member.name}</h3>
                                                            <p className="text-slate-500 text-sm mt-1 capitalize">{member.role}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full ${cap.badgeBg} ${cap.badge} text-xs font-bold uppercase tracking-wider`}>
                                                        {cap.label}
                                                    </span>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center text-sm font-medium">
                                                        <span className="text-slate-600">{member.clientCount} clients assigned</span>
                                                        <span className="text-slate-900">Avg. close: {member.averageCloseTime}d</span>
                                                    </div>
                                                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
                                                        <div className="bg-emerald-500" style={{ width: `${pctOn}%` }} />
                                                        <div className="bg-amber-400" style={{ width: `${pctAt}%` }} />
                                                        <div className="bg-red-500" style={{ width: `${pctBehind}%` }} />
                                                    </div>
                                                    <div className="pt-4 border-t border-slate-50">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Portfolio</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {member.clients.map((c) => {
                                                                const dotColor = c.healthStatus === 'on_track' ? 'bg-emerald-500'
                                                                    : c.healthStatus === 'at_risk' ? 'bg-amber-500'
                                                                        : c.healthStatus === 'behind' ? 'bg-rose-500'
                                                                            : 'bg-slate-300';
                                                                return (
                                                                    <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded text-xs text-slate-600">
                                                                        <span className={`size-1.5 rounded-full ${dotColor}`} />
                                                                        {c.name}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* AI Suggestions */}
                                {data.rebalanceSuggestions.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <span className="material-symbols-outlined text-primary filled">auto_awesome</span>
                                            <h2 className="text-xl font-bold text-slate-900">AI Workload Suggestions</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {data.rebalanceSuggestions.map((suggestion, i) => (
                                                <div key={i} className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-5">
                                                    <div className="flex items-start gap-4">
                                                        <div className="bg-primary/10 rounded-lg p-2 text-primary">
                                                            <span className="material-symbols-outlined">move_item</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">Redistribute {suggestion.client.name}</h4>
                                                            <p className="text-sm text-slate-600 mt-1 max-w-sm">{suggestion.suggestion}</p>
                                                        </div>
                                                    </div>
                                                    <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap shadow-sm">
                                                        Reassign
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </EmptyState>
                </div>
            </div>

            {/* Add Member Modal — uses reusable Modal component */}
            <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Team Member" icon="person_add">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                        <input value={newName} onChange={e => setNewName(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="e.g. Alex Johnson"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="alex@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role</label>
                        <select value={newRole} onChange={e => setNewRole(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                            <option value="preparer">Preparer</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAddModal(false)}
                        className="flex-1 border border-slate-200 text-slate-600 font-bold text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button onClick={handleAdd} disabled={createMember.isPending || !newName || !newEmail}
                        className="flex-1 bg-primary text-white font-bold text-sm py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {createMember.isPending ? 'Adding...' : (<><span className="material-symbols-outlined text-sm">check</span>Add Member</>)}
                    </button>
                </div>
            </Modal>
        </>
    );
}
