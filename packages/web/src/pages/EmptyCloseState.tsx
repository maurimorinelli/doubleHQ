import { useState, useEffect } from 'react';
import { fetchTemplates, startClose, fetchTeamMembers, suggestAssignment, type TeamMember } from '../api/client';

interface Template {
    id: string;
    name: string;
    isDefault: boolean;
    sections: Array<{ name: string; tasks: Array<{ title: string }> }>;
}

interface EmptyCloseStateProps {
    clientId: string;
    clientName: string;
    onCloseStarted: () => void;
}

function getPreviousPeriod(): string {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

export default function EmptyCloseState({ clientId, clientName, onCloseStarted }: EmptyCloseStateProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState(getPreviousPeriod());
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Team assignment state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [selectedPreparerId, setSelectedPreparerId] = useState('');
    const [selectedReviewerId, setSelectedReviewerId] = useState('');
    const [suggestedPreparerId, setSuggestedPreparerId] = useState('');
    const [suggestedReviewerId, setSuggestedReviewerId] = useState('');

    useEffect(() => {
        Promise.all([
            fetchTemplates(),
            fetchTeamMembers(),
            suggestAssignment(),
        ])
            .then(([templateData, teamData, suggestion]) => {
                setTemplates(templateData.templates);
                const defaultTpl = templateData.templates.find(t => t.isDefault);
                setSelectedTemplateId(defaultTpl?.id || templateData.templates[0]?.id || '');

                setTeamMembers(teamData.members);

                // Set AI suggestions as defaults
                if (suggestion.suggestedPreparer) {
                    setSelectedPreparerId(suggestion.suggestedPreparer.id);
                    setSuggestedPreparerId(suggestion.suggestedPreparer.id);
                } else if (teamData.members.length > 0) {
                    setSelectedPreparerId(teamData.members.find(m => m.role === 'preparer')?.id || teamData.members[0].id);
                }

                if (suggestion.suggestedReviewer) {
                    setSelectedReviewerId(suggestion.suggestedReviewer.id);
                    setSuggestedReviewerId(suggestion.suggestedReviewer.id);
                } else if (teamData.members.length > 0) {
                    setSelectedReviewerId(teamData.members.find(m => m.role === 'manager')?.id || teamData.members[0].id);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const totalTasks = selectedTemplate?.sections.reduce((sum, s) => sum + s.tasks.length, 0) || 0;

    // Format period for display
    const [pYear, pMonth] = selectedPeriod.split('-').map(Number);
    const periodDisplay = new Date(pYear, pMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const preparers = teamMembers.filter(m => m.role === 'preparer');
    const reviewers = teamMembers.filter(m => m.role === 'manager' || m.role === 'reviewer');
    // Fallback: show all if no role matches
    const preparerOptions = preparers.length > 0 ? preparers : teamMembers;
    const reviewerOptions = reviewers.length > 0 ? reviewers : teamMembers;

    const handleStart = async () => {
        if (!selectedTemplateId) return;
        setStarting(true);
        setError(null);
        try {
            await startClose(clientId, selectedTemplateId, selectedPeriod, selectedPreparerId || undefined, selectedReviewerId || undefined);
            onCloseStarted();
        } catch (err: any) {
            setError(err.message);
            setStarting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                    <p style={{ marginTop: 12 }}>Loading templates...</p>
                </div>
            </div>
        );
    }

    const selectStyle = {
        width: '100%',
        fontSize: 14, fontWeight: 600 as const, color: '#0f172a',
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '8px 10px',
        fontFamily: 'inherit', outline: 'none',
        cursor: 'pointer',
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 180px)', padding: '32px 40px' }}>
            <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                maxWidth: 800,
                width: '100%',
                padding: '32px 36px',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                        width: 52, height: 52,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #ebf0ff, #d8e3ff)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 14,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#135bec' }}>
                            rocket_launch
                        </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                        Start Monthly Close for {clientName}
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                        No active close period. Configure and start below.
                    </p>
                </div>

                {/* Two Column Layout */}
                <div style={{ display: 'flex', gap: 24 }}>

                    {/* Left Column — Config */}
                    <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Period */}
                        <div style={{
                            padding: '12px 14px',
                            background: '#f8fafc', borderRadius: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#135bec' }}>calendar_month</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Period</span>
                            </div>
                            <input
                                type="month"
                                value={selectedPeriod}
                                onChange={e => setSelectedPeriod(e.target.value)}
                                style={{
                                    width: '100%',
                                    fontSize: 14, fontWeight: 600, color: '#0f172a',
                                    background: '#fff', border: '1px solid #e2e8f0',
                                    borderRadius: 8, padding: '8px 10px',
                                    fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                                Closing books for {periodDisplay}
                            </div>
                        </div>

                        {/* Template */}
                        <div style={{
                            padding: '12px 14px',
                            background: '#f8fafc', borderRadius: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#135bec' }}>checklist</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Template</span>
                            </div>
                            <select
                                value={selectedTemplateId}
                                onChange={e => setSelectedTemplateId(e.target.value)}
                                style={selectStyle}
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Preparer Assignment */}
                        <div style={{
                            padding: '12px 14px',
                            background: '#f8fafc', borderRadius: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#135bec' }}>person</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Preparer</span>
                            </div>
                            <select
                                value={selectedPreparerId}
                                onChange={e => setSelectedPreparerId(e.target.value)}
                                style={selectStyle}
                            >
                                <option value="">— Select preparer —</option>
                                {preparerOptions.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}{m.id === suggestedPreparerId ? ' ⭐ Recommended' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedPreparerId === suggestedPreparerId && suggestedPreparerId && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 11, color: '#059669', marginTop: 5, fontWeight: 500,
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#059669' }}>auto_awesome</span>
                                    AI recommended — lowest workload
                                </div>
                            )}
                        </div>

                        {/* Reviewer Assignment */}
                        <div style={{
                            padding: '12px 14px',
                            background: '#f8fafc', borderRadius: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#135bec' }}>verified_user</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reviewer</span>
                            </div>
                            <select
                                value={selectedReviewerId}
                                onChange={e => setSelectedReviewerId(e.target.value)}
                                style={selectStyle}
                            >
                                <option value="">— Select reviewer —</option>
                                {reviewerOptions.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}{m.id === suggestedReviewerId ? ' ⭐ Recommended' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedReviewerId === suggestedReviewerId && suggestedReviewerId && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 11, color: '#059669', marginTop: 5, fontWeight: 500,
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#059669' }}>auto_awesome</span>
                                    AI recommended — lowest workload
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: '#fef2f2', color: '#dc2626', borderRadius: 8,
                                padding: '8px 12px', fontSize: 12,
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Start Button */}
                        <button
                            onClick={handleStart}
                            disabled={!selectedTemplateId || starting}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                background: starting ? '#94a3b8' : '#135bec',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: starting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                marginTop: 4,
                            }}
                        >
                            {starting ? (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                                    Creating close...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                                    Start Close — {totalTasks} tasks
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Column — Task Preview */}
                    <div style={{
                        flex: 1,
                        background: '#f8fafc',
                        borderRadius: 12,
                        padding: '16px 20px',
                        borderLeft: '3px solid #e2e8f0',
                    }}>
                        {selectedTemplate ? (
                            <>
                                <div style={{
                                    fontSize: 13, fontWeight: 700, color: '#334155',
                                    marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#135bec' }}>assignment</span>
                                    {totalTasks} tasks · {selectedTemplate.sections.length} sections
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {selectedTemplate.sections.map((section, i) => (
                                        <div key={i}>
                                            <div style={{
                                                fontSize: 11, fontWeight: 700, color: '#135bec',
                                                textTransform: 'uppercase', letterSpacing: 0.5,
                                                marginBottom: 4,
                                            }}>
                                                {section.name}
                                            </div>
                                            {section.tasks.map((task, j) => (
                                                <div key={j} style={{
                                                    fontSize: 13, color: '#475569',
                                                    paddingLeft: 12, marginBottom: 3,
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                }}>
                                                    <span style={{
                                                        width: 14, height: 14, borderRadius: 4,
                                                        border: '1.5px solid #cbd5e1',
                                                        flexShrink: 0,
                                                    }} />
                                                    {task.title}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 40 }}>
                                Select a template to see tasks
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
