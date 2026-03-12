import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
    FiX, FiArrowLeft, FiClock, FiCheck,
    FiShield, FiChevronRight, FiRefreshCw,
} from 'react-icons/fi';

/* ─────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────── */
const C = {
    accent: '#4f46e5',
    accentLight: 'rgba(79,70,229,0.08)',
    accentBorder: 'rgba(79,70,229,0.25)',
    success: '#16a34a',
    successLight: 'rgba(22,163,74,0.08)',
    danger: '#dc2626',
    bg: '#ffffff',
    surface: '#f9fafb',
    border: '#e5e7eb',
    borderDark: '#d1d5db',
    text: '#111827',
    textSub: '#6b7280',
    textMuted: '#9ca3af',
};

/* ─────────────────────────────────────────────────
   FIELD DEFINITIONS
   Keys match MongoDB field names in targets collection
───────────────────────────────────────────────── */
const EDIT_FIELDS = [
    { key: 'Monthly Po Target', label: 'PO Target', short: 'PO' },
    { key: 'Monthly Sql Target', label: 'SQL Target', short: 'SQL' },
    { key: 'Monthly Price', label: 'Price (₹)', short: 'Price', isCurrency: true },
    { key: 'Monthly Mql Target', label: 'MQL Target', short: 'MQL' },
    { key: 'Monthly Call_Target', label: 'Call Target', short: 'Calls' },
];

/* ─────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return String(d); }
};

const AVATAR_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#0284c7', '#65a30d'];
function avatarColor(name = 'X') {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ─────────────────────────────────────────────────
   SHARED ATOMS
───────────────────────────────────────────────── */
const Avatar = ({ name, size = 36 }) => (
    <div style={{
        width: size, height: size, borderRadius: '50%',
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
    }}>
        {(name || '?')[0].toUpperCase()}
    </div>
);

const Pill = ({ children, color = C.textMuted, bg = C.surface }) => (
    <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 20,
        fontSize: 10, fontWeight: 600, background: bg, color,
    }}>
        {children}
    </span>
);

const SectionHeading = ({ children }) => (
    <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: C.textMuted,
        marginBottom: 10, paddingBottom: 6,
        borderBottom: `1px solid ${C.border}`,
    }}>
        {children}
    </div>
);

const MiniStat = ({ label, value }) => (
    <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.textMuted, letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
);

const CenteredSpinner = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 20px' }}>
        <FiRefreshCw size={28} className="tmm-spin" style={{ color: C.accent, marginBottom: 10 }} />
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Loading…</div>
    </div>
);

/* ══════════════════════════════════════════════════
   LAYER 1 — Team list with agent cards
══════════════════════════════════════════════════ */
const UserListLayer = ({ groupedUsers, teamTargets, loading, onSelectTeam, onClose }) => {
    const teams = [
        { id: 'inbound', label: '1️⃣ Inbound Team' },
        { id: 'outbound', label: '2️⃣ Outbound Team' },
        { id: 'sql_closure', label: '3️⃣ SQL Closure Team' },
    ];

    const getTeamTarget = (teamId) => teamTargets.find(t => t.team === teamId) || {};

    return (
        <>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
                background: C.bg,
            }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Target Management</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        Click a team to edit targets. Updates apply to all team members.
                    </div>
                </div>
                <button onClick={onClose} style={closeBtnStyle}>
                    <FiX size={16} />
                </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
                {loading ? (
                    <CenteredSpinner />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {teams.map(team => {
                            const users = groupedUsers[team.id] || [];
                            const target = getTeamTarget(team.id);
                            const historyCount = target.history?.length || 0;

                            return (
                                <div key={team.id}>
                                    <SectionHeading>{team.label}</SectionHeading>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {users.length === 0 ? (
                                            <div style={{ fontSize: 12, color: C.textMuted, padding: '10px 14px', fontStyle: 'italic' }}>
                                                No agents in this team.
                                            </div>
                                        ) : (
                                            users.map(u => (
                                                <UserRow
                                                    key={u.username}
                                                    user={u}
                                                    target={target}
                                                    historyCount={historyCount}
                                                    onClick={() => onSelectTeam(team.id)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
};

const UserRow = ({ user, target, historyCount, onClick }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: hovered ? C.accentLight : C.bg,
                border: `1px solid ${hovered ? C.accentBorder : C.border}`,
                transition: 'background .12s, border-color .12s',
            }}
        >
            <Avatar name={user.agentName || user.username} size={34} />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{user.agentName || user.username}</div>
                <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill color={C.accent} bg={C.accentLight}>{user.incentive_role}</Pill>
                    {historyCount > 0 ? (
                        <Pill color={C.success} bg={C.successLight}>
                            {historyCount} update{historyCount !== 1 ? 's' : ''}
                        </Pill>
                    ) : (
                        <Pill>Original</Pill>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
                <MiniStat label="PO" value={target.po_target ?? '—'} />
                <MiniStat label="SQL" value={target.sql_target ?? '—'} />
                <MiniStat label="Price" value={fmt(target.price_target)} />
            </div>

            <FiChevronRight size={15} color={C.textMuted} style={{ flexShrink: 0 }} />
        </div>
    );
};

/* ══════════════════════════════════════════════════
   LAYER 2 — Edit Team Targets
══════════════════════════════════════════════════ */
const TeamDetailLayer = ({ team, onBack, onClose, onSaved }) => {
    const [target, setTarget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editValues, setEditValues] = useState({});

    const fetchTarget = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/team-targets');
            const found = res.data.teamTargets.find(t => t.team === team) || {};
            setTarget(found);

            // Seed edit form with current team values (map team keys → MongoDB field names)
            setEditValues({
                'Monthly Po Target': found.po_target ?? 0,
                'Monthly Sql Target': found.sql_target ?? 0,
                'Monthly Price': found.price_target ?? 0,
                'Monthly Mql Target': found.mql_target ?? 0,
                'Monthly Call_Target': found.call_target ?? 0,
            });
        } catch (err) {
            toast.error('Failed to load: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [team]);

    useEffect(() => { fetchTarget(); }, [fetchTarget]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Send using team-field keys; backend maps to MongoDB fields AND syncs targets collection
            await api.put(`/team-targets/${team}`, {
                po_target: Number(editValues['Monthly Po Target'] || 0),
                sql_target: Number(editValues['Monthly Sql Target'] || 0),
                price_target: Number(editValues['Monthly Price'] || 0),
            });
            toast.success('✅ Team targets saved and synced to all agents!');
            await fetchTarget();
            onSaved();
        } catch (err) {
            toast.error('Save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const teamLabel = team === 'inbound' ? 'Inbound Team' : team === 'outbound' ? 'Outbound Team' : 'SQL Closure Team';
    const potentialPreview = (editValues['Monthly Po Target'] || 0) * (editValues['Monthly Price'] || 0);

    return (
        <>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
                flexShrink: 0, background: C.bg,
            }}>
                <button onClick={onBack} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 7,
                    border: `1px solid ${C.border}`, background: C.surface,
                    color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                    <FiArrowLeft size={13} /> Back
                </button>

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{teamLabel}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                        Editing targets for all team members
                    </div>
                </div>

                <button onClick={onClose} style={closeBtnStyle}>
                    <FiX size={16} />
                </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
                {loading ? <CenteredSpinner /> : (
                    <>
                        {/* Potential Preview Banner */}
                        <div style={{
                            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                            borderRadius: 10, padding: '14px 18px', marginBottom: 20,
                            color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Potential Preview</div>
                                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmt(potentialPreview)}</div>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.8, textAlign: 'right' }}>
                                PO: {editValues['Monthly Po Target'] || 0} × {fmt(editValues['Monthly Price'] || 0)}
                            </div>
                        </div>

                        <SectionHeading>Edit Team Targets</SectionHeading>
                        <div style={{
                            background: C.bg, borderRadius: 10,
                            border: `1px solid ${C.border}`,
                            marginBottom: 20, overflow: 'hidden',
                        }}>
                            {/* Column headers */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 100px 120px',
                                gap: 20, padding: '8px 20px',
                                background: C.surface, borderBottom: `1px solid ${C.border}`,
                            }}>
                                <span style={colHeadStyle}>Field</span>
                                <span style={{ ...colHeadStyle, textAlign: 'right' }}>Current</span>
                                <span style={{ ...colHeadStyle, textAlign: 'right', color: C.accent }}>New Value</span>
                            </div>

                            {EDIT_FIELDS.map((f, idx) => {
                                // Map MongoDB field key → team target key for "current" value
                                const teamKeyMap = {
                                    'Monthly Po Target': 'po_target',
                                    'Monthly Sql Target': 'sql_target',
                                    'Monthly Price': 'price_target',
                                    'Monthly Mql Target': 'mql_target',
                                    'Monthly Call_Target': 'call_target',
                                };
                                const activeVal = target[teamKeyMap[f.key]] ?? 0;
                                const isLast = idx === EDIT_FIELDS.length - 1;

                                return (
                                    <div key={f.key} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 100px 120px',
                                        alignItems: 'center', gap: 20,
                                        padding: '14px 20px',
                                        borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
                                    }}>
                                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{f.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', color: C.textSub }}>
                                            {f.isCurrency ? fmt(activeVal) : activeVal}
                                        </span>
                                        <input
                                            type="number" min="0"
                                            value={editValues[f.key] ?? ''}
                                            onChange={e => setEditValues(p => ({ ...p, [f.key]: e.target.value }))}
                                            style={{
                                                width: '100%', padding: '8px 12px',
                                                border: `1px solid ${C.borderDark}`,
                                                borderRadius: 8, fontSize: 13, fontWeight: 600,
                                                textAlign: 'right', outline: 'none',
                                                boxSizing: 'border-box', color: C.text,
                                                background: C.bg, transition: 'border-color .12s',
                                            }}
                                            onFocus={e => (e.target.style.borderColor = C.accent)}
                                            onBlur={e => (e.target.style.borderColor = C.borderDark)}
                                        />
                                    </div>
                                );
                            })}

                            {/* Action bar */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '16px 20px', background: C.surface,
                                borderTop: `1px solid ${C.border}`,
                            }}>
                                <FiShield size={14} color={C.textMuted} />
                                <span style={{ fontSize: 11, color: C.textMuted, flex: 1 }}>
                                    Saves to all agents in this team &amp; updates dashboard.
                                </span>
                                <button onClick={handleSave} disabled={saving} style={{
                                    padding: '8px 24px', borderRadius: 8, border: 'none',
                                    background: saving ? C.textMuted : C.accent,
                                    color: '#fff', fontSize: 13, fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    {saving ? <FiRefreshCw size={12} className="tmm-spin" /> : <FiCheck size={14} />}
                                    {saving ? 'Saving…' : 'Save & Sync'}
                                </button>
                            </div>
                        </div>

                        {/* Version History */}
                        <SectionHeading>
                            Version History{target.history?.length > 0 && ` · ${target.history.length} update${target.history.length !== 1 ? 's' : ''}`}
                        </SectionHeading>

                        {(!target.history || target.history.length === 0) ? (
                            <div style={{
                                background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`,
                                padding: '28px 20px', textAlign: 'center',
                            }}>
                                <FiClock size={28} color={C.border} style={{ marginBottom: 8 }} />
                                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>No update history yet</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                                    Save changes above to create the first history entry.
                                </div>
                            </div>
                        ) : (
                            <TeamHistoryTimeline history={target.history} />
                        )}
                    </>
                )}
            </div>
        </>
    );
};

/* ══════════════════════════════════════════════════
   HISTORY TIMELINE
══════════════════════════════════════════════════ */
const TeamHistoryTimeline = ({ history }) => {
    const reversed = [...history].reverse();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {reversed.map((entry, idx) => (
                <HistoryEntry
                    key={idx}
                    entry={entry}
                    updateNumber={history.length - idx}
                    isLatest={idx === 0}
                    isLast={idx === reversed.length - 1}
                />
            ))}
        </div>
    );
};

const HistoryEntry = ({ entry, updateNumber, isLatest, isLast }) => {
    return (
        <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 14,
                    background: isLatest ? C.accent : C.borderDark,
                    border: `3px solid ${isLatest ? C.accentLight : C.bg}`,
                    zIndex: 1,
                }} />
                {!isLast && <div style={{ flex: 1, width: 2, background: C.border, minHeight: 12 }} />}
            </div>

            <div style={{
                flex: 1, marginBottom: isLast ? 8 : 12, marginLeft: 10,
                background: C.bg,
                border: `1px solid ${isLatest ? C.accentBorder : C.border}`,
                borderRadius: 10, overflow: 'hidden',
                boxShadow: isLatest ? '0 4px 12px rgba(79,70,229,0.06)' : 'none',
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: isLatest ? C.accentLight : C.surface,
                    borderBottom: `1px solid ${C.border}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Update #{updateNumber}</span>
                        {isLatest && <span style={{ fontSize: 9, fontWeight: 800, color: C.accent, background: '#fff', border: `1px solid ${C.accentBorder}`, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Active</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>
                        {entry.updatedBy} · {fmtDate(entry.updatedAt)}
                    </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                        { label: 'PO', value: entry.po_target, isCurrency: false },
                        { label: 'SQL', value: entry.sql_target, isCurrency: false },
                        { label: 'Price', value: entry.price_target, isCurrency: true },
                    ].map(f => (
                        <div key={f.label} style={{ padding: '6px 10px', borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{f.isCurrency ? fmt(f.value) : (f.value ?? '—')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT
══════════════════════════════════════════════════ */
const TargetManagementModal = ({ isOpen, onClose, onSaved }) => {
    const [groupedUsers, setGroupedUsers] = useState({ inbound: [], outbound: [], sql_closure: [] });
    const [teamTargets, setTeamTargets] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const overlayRef = useRef(null);

    const fetchList = useCallback(async () => {
        if (!isOpen) return;
        setLoadingList(true);
        try {
            const res = await api.get('/team-targets');
            setGroupedUsers(res.data.groupedUsers || { inbound: [], outbound: [], sql_closure: [] });
            setTeamTargets(res.data.teamTargets || []);
        } catch (err) {
            toast.error('Failed to load targets: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingList(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) { setSelectedTeam(null); fetchList(); }
    }, [isOpen, fetchList]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const layer = selectedTeam ? 'detail' : 'list';

    const handleSaved = () => {
        fetchList();
        if (onSaved) onSaved(); // trigger dashboard refetch
    };

    return (
        <>
            <style>{`
        @keyframes tmm-fade  { from{opacity:0} to{opacity:1} }
        @keyframes tmm-up    { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes tmm-right { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes tmm-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .tmm-spin { animation:tmm-spin 1s linear infinite; display:inline-block; }
      `}</style>

            {/* Overlay */}
            <div
                ref={overlayRef}
                onClick={e => e.target === overlayRef.current && onClose()}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(17,24,39,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20, backdropFilter: 'blur(3px)',
                    animation: 'tmm-fade .18s ease',
                }}
            >
                {/* Modal */}
                <div
                    key={layer}
                    style={{
                        background: C.surface,
                        borderRadius: 12, width: '100%',
                        maxWidth: layer === 'detail' ? 600 : 520,
                        maxHeight: '86vh',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
                        animation: layer === 'detail' ? 'tmm-right .2s ease' : 'tmm-up .2s ease',
                    }}
                >
                    {layer === 'list' ? (
                        <UserListLayer
                            groupedUsers={groupedUsers}
                            teamTargets={teamTargets}
                            loading={loadingList}
                            onSelectTeam={setSelectedTeam}
                            onClose={onClose}
                        />
                    ) : (
                        <TeamDetailLayer
                            team={selectedTeam}
                            onBack={() => setSelectedTeam(null)}
                            onClose={onClose}
                            onSaved={handleSaved}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default TargetManagementModal;

/* ── Shared style objects ── */
const closeBtnStyle = {
    width: 30, height: 30, borderRadius: 7,
    background: '#f9fafb', border: '1px solid #e5e7eb',
    cursor: 'pointer', color: '#6b7280', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const colHeadStyle = {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: '#9ca3af',
};
