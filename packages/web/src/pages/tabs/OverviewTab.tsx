import type { WorkflowSectionData, RiskFactor, CommunicationEntry } from '@doublehq/shared';
import { TaskStatus } from '@doublehq/shared';
import { useState } from 'react';

interface OverviewTabProps {
    sections: WorkflowSectionData[];
    riskAssessment: RiskFactor;
    communications: CommunicationEntry[];
    onToggleTask: (taskId: string, newStatus: string) => void;
    onTaskNavigate: (targetTab: string) => void;
}

const taskStatusIcon: Record<string, { icon: string; color: string; filled: boolean }> = {
    complete: { icon: 'check_circle', color: 'text-green-500', filled: true },
    in_progress: { icon: 'circle', color: 'text-primary', filled: false },
    not_started: { icon: 'circle', color: 'text-slate-300', filled: false },
    blocked: { icon: 'lock', color: 'text-slate-300', filled: false },
};

const riskColors: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
    low: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', iconColor: 'text-emerald-600' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', iconColor: 'text-amber-600' },
    medium_high: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', iconColor: 'text-red-600' },
    high: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', iconColor: 'text-red-700' },
    critical: { bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-800' },
};

export default function OverviewTab({ sections, riskAssessment, communications, onToggleTask, onTaskNavigate }: OverviewTabProps) {
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const risk = riskColors[riskAssessment.riskLevel] || riskColors.medium;

    const toggleSection = (name: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const handleTaskClick = (targetTab: string) => {
        onTaskNavigate(targetTab);
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Task Sections */}
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {sections.map((section, idx) => {
                    const isCollapsed = collapsedSections.has(section.name);
                    return (
                        <div key={section.name} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection(section.name)}
                                className="w-full flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`material-symbols-outlined text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                                        expand_more
                                    </span>
                                    <h3 className="font-bold text-slate-900">{idx + 1}. {section.label}</h3>
                                    {section.isBlocked ? (
                                        <span className="text-[10px] font-black text-white bg-red-500 px-2 py-0.5 rounded uppercase tracking-tighter">
                                            Blocked
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded">
                                            {section.completedTasks}/{section.totalTasks} Tasks
                                        </span>
                                    )}
                                </div>
                                {section.isBlocked && section.blockedReason && (
                                    <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">error</span>
                                        {section.blockedReason}
                                    </span>
                                )}
                            </button>
                            {!isCollapsed && (
                                <div className={`divide-y divide-slate-50 ${section.isBlocked ? 'opacity-60 bg-slate-50' : ''}`}>
                                    {section.tasks.map((task) => {
                                        const ts = taskStatusIcon[task.status] || taskStatusIcon.not_started;
                                        const isAuto = !!task.autoCompleteRule;
                                        const canToggle = !isAuto && !section.isBlocked;
                                        return (
                                            <div
                                                key={task.id}
                                                className={`flex items-center justify-between p-4 group cursor-pointer hover:bg-slate-50 transition-colors ${task.status === 'in_progress' ? 'bg-primary/5' : ''}`}
                                                onClick={() => handleTaskClick(task.targetTab || 'overview')}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        type="button"
                                                        className={`material-symbols-outlined text-xl ${ts.color} ${ts.filled ? 'filled' : ''} ${canToggle ? 'hover:text-green-400 transition-colors' : ''}`}
                                                        style={ts.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                                        onClick={(e) => {
                                                            if (!canToggle) return;
                                                            e.stopPropagation();
                                                            const newStatus = task.status === TaskStatus.COMPLETE ? TaskStatus.NOT_STARTED : TaskStatus.COMPLETE;
                                                            onToggleTask(task.id, newStatus);
                                                        }}
                                                        title={isAuto ? 'Auto-completed by the system' : canToggle ? 'Click to toggle completion' : undefined}
                                                    >
                                                        {ts.icon}
                                                    </button>
                                                    <span className={`text-sm font-medium ${task.status === 'complete' ? 'text-slate-600 line-through' : 'text-slate-900'
                                                        }`}>
                                                        {task.title}
                                                    </span>
                                                    {isAuto && (
                                                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                            Auto
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {task.assignee && (
                                                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                            {task.assignee}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Communication Timeline */}
                {communications.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-widest px-1">
                            Client Communication Timeline
                        </h3>
                        <div className="relative border-l-2 border-slate-200 ml-3 pl-8 space-y-6">
                            {communications.map((entry, i) => (
                                <div key={i} className="relative">
                                    <div className={`absolute -left-[41px] top-0 size-5 rounded-full border-4 border-white ${entry.type === 'no_response' ? 'bg-red-500' : 'bg-slate-200'
                                        }`} />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-400">
                                            {new Date(entry.date).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric',
                                            }).toUpperCase()}
                                        </span>
                                        <p className={`text-sm ${entry.type === 'no_response' ? 'font-bold text-red-600' : 'text-slate-600'
                                            }`}>
                                            {entry.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right Sidebar: AI Risk Assessment */}
            <aside className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto hidden lg:block">
                <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">AI Risk Assessment</h2>
                </div>
                <div className={`${risk.bg} rounded-xl p-5 border ${risk.border} mb-6`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`material-symbols-outlined ${risk.iconColor} text-lg`}>dangerous</span>
                        <span className={`text-sm font-black ${risk.text} uppercase tracking-tighter`}>
                            {riskAssessment.riskLevel.replace('_', '-')} Risk
                        </span>
                    </div>
                    <p className={`text-sm ${risk.text} leading-relaxed mb-4`}>
                        {riskAssessment.summary}
                    </p>
                    {riskAssessment.factors.length > 0 && (
                        <ul className="text-xs mb-4 space-y-1">
                            {riskAssessment.factors.map((f, i) => (
                                <li key={i} className={risk.text}>• {f}</li>
                            ))}
                        </ul>
                    )}
                    <div className={`bg-white/60 rounded-lg p-3 border ${risk.border} text-xs ${risk.text} font-medium`}>
                        <p className="mb-2"><strong>AI Recommendation:</strong></p>
                        <p>{riskAssessment.recommendation}</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
