import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
    FiX, FiArrowLeft, FiClock, FiCheck, FiRotateCcw,
    FiShield, FiChevronRight, FiRefreshCw, FiAlertTriangle,
} from 'react-icons/fi';

/* ─────────────────────────────────────────────────
   DESIGN TOKENS  (single accent = indigo #4f46e5)
───────────────────────────────────────────────── */
const C = {
    accent: '#4f46e5',
    accentLight: 'rgba(79,70,229,0.08)',
    accentBorder: 'rgba(79,70,229,0.25)',
    success: '#16a34a',
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
───────────────────────────────────────────────── */
const EDIT_FIELDS = [
    { key: 'Monthly Sql Target', label: 'Monthly SQL Target', short: 'Mo. SQL' },
    { key: 'Monthly Po Target', label: 'Monthly PO Target', short: 'Mo. PO' },
    { key: 'Monthly Price', label: 'Monthly Price', short: 'Mo. Price', isCurrency: true },
    { key: 'Monthly Mql Target', label: 'Monthly MQL Target', short: 'Mo. MQL' },
    { key: 'Monthly Call_Target', label: 'Monthly Call Target', short: 'Mo. Calls' },
    { key: 'Quaterly Sql Target', label: 'Quarterly SQL Target', short: 'Q. SQL' },
    { key: 'Quaterly Po Target', label: 'Quarterly PO Target', short: 'Q. PO' },
    { key: 'Quaterly Closure Target', label: 'Quarterly Closure Target', short: 'Q. Closure' },
];

const FIELD_MAP = Object.fromEntries(EDIT_FIELDS.map(f => [f.key, f]));

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

/** Deterministic avatar background — a fixed muted palette */
const AVATAR_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#0284c7', '#65a30d'];
function avatarColor(name = 'X') {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/**
 * Given a history entry and its "previous" state (original doc OR previous history entry),
 * return only EDIT_FIELDS where the value actually changed.
 */
function getChangedFields(entry, prevEntry) {
    return EDIT_FIELDS.filter(f => {
        const curr = entry[f.key];
        const prev = prevEntry?.[f.key];
        // Only include if field exists in this entry AND value differs from previous
        return curr !== undefined && curr !== null && Number(curr) !== Number(prev ?? null);
    });
}

/* ─────────────────────────────────────────────────
   TINY SHARED ATOMS
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

/* ══════════════════════════════════════════════════
   LAYER 1 — User list
══════════════════════════════════════════════════ */
const UserListLayer = ({ targets, loading, onSelectUser, onClose }) => (
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
                    Select an agent to view or edit targets
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
            ) : targets.length === 0 ? (
                <div style={centeredStyle}>
                    <div style={{ fontSize: 13, color: C.textMuted }}>No targets found.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {targets.map(t => (
                        <UserRow key={t.Lead_Owner} target={t} onClick={() => onSelectUser(t.Lead_Owner)} />
                    ))}
                </div>
            )}
        </div>
    </>
);

const UserRow = ({ target: t, onClick }) => {
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
            <Avatar name={t.Lead_Owner} size={34} />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{t.Lead_Owner}</div>
                <div style={{ marginTop: 3 }}>
                    {t.hasHistory
                        ? <Pill color={C.success} bg="rgba(22,163,74,0.08)">{t.historyCount} update{t.historyCount !== 1 ? 's' : ''}</Pill>
                        : <Pill>Original</Pill>}
                </div>
            </div>

            {/* Quick stats — monochrome */}
            <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
                <MiniStat label="PO" value={t['Monthly Po Target'] ?? '—'} />
                <MiniStat label="SQL" value={t['Monthly Sql Target'] ?? '—'} />
                <MiniStat label="Price" value={fmt(t['Monthly Price'])} />
            </div>

            <FiChevronRight size={15} color={C.textMuted} style={{ flexShrink: 0 }} />
        </div>
    );
};

const MiniStat = ({ label, value }) => (
    <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.textMuted, letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
);

/* ══════════════════════════════════════════════════
   LAYER 2 — Edit + History
══════════════════════════════════════════════════ */
const UserDetailLayer = ({ leadOwner, onBack, onClose, onSaved }) => {
    const [target, setTarget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [editValues, setEditValues] = useState({});
    const [showReset, setShowReset] = useState(false);

    const fetchTarget = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/targets/${encodeURIComponent(leadOwner)}`);
            const t = res.data.target;
            setTarget(t);
            const seed = {};
            EDIT_FIELDS.forEach(f => { seed[f.key] = t[f.key] ?? 0; });
            setEditValues(seed);
        } catch (err) {
            toast.error('Failed to load: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [leadOwner]);

    useEffect(() => { fetchTarget(); }, [fetchTarget]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {};
            EDIT_FIELDS.forEach(f => {
                if (editValues[f.key] !== undefined && editValues[f.key] !== '') {
                    payload[f.key] = Number(editValues[f.key]);
                }
            });
            await api.put(`/targets/${encodeURIComponent(leadOwner)}`, payload);
            toast.success('✅ Targets updated successfully');
            await fetchTarget();
            onSaved();
        } catch (err) {
            toast.error('Save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setResetting(true);
        try {
            await api.delete(`/targets/${encodeURIComponent(leadOwner)}/reset`);
            toast.success('History cleared. Original values restored.');
            setShowReset(false);
            await fetchTarget();
            onSaved();
        } catch (err) {
            toast.error('Reset failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setResetting(false);
        }
    };

    const history = target?.target_update_history || [];

    return (
        <>
            {/* ── Header ── */}
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

                <Avatar name={leadOwner} size={32} />

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{leadOwner}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                        {target?.hasHistory
                            ? `${target.historyCount} admin update${target.historyCount !== 1 ? 's' : ''} · using latest`
                            : 'Using original imported data'}
                    </div>
                </div>

                <button onClick={onClose} style={closeBtnStyle}>
                    <FiX size={16} />
                </button>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
                {loading ? <CenteredSpinner /> : (
                    <>
                        {/* ─── SECTION 1: EDIT FORM ─── */}
                        <SectionHeading>Edit Targets</SectionHeading>
                        <div style={{
                            background: C.bg, borderRadius: 10,
                            border: `1px solid ${C.border}`,
                            marginBottom: 20, overflow: 'hidden',
                        }}>
                            {/* Column headers */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px',
                                gap: 8, padding: '8px 14px',
                                background: C.surface, borderBottom: `1px solid ${C.border}`,
                            }}>
                                <span style={colHeadStyle}>Field</span>
                                <span style={{ ...colHeadStyle, textAlign: 'right' }}>Original</span>
                                <span style={{ ...colHeadStyle, textAlign: 'right' }}>Active</span>
                                <span style={{ ...colHeadStyle, textAlign: 'right', color: C.accent }}>New Value</span>
                            </div>

                            {EDIT_FIELDS.map((f, idx) => {
                                const origVal = target?.original?.[f.key] ?? 0;
                                const activeVal = target?.[f.key] ?? 0;
                                const changed = Number(activeVal) !== Number(origVal);
                                const isLast = idx === EDIT_FIELDS.length - 1;
                                return (
                                    <div key={f.key} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px',
                                        alignItems: 'center', gap: 8,
                                        padding: '9px 14px',
                                        background: changed ? 'rgba(79,70,229,0.04)' : C.bg,
                                        borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
                                    }}>
                                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{f.label}</span>
                                        <span style={{ fontSize: 12, color: C.textMuted, textAlign: 'right' }}>
                                            {f.isCurrency ? fmt(origVal) : origVal}
                                        </span>
                                        <span style={{
                                            fontSize: 12, fontWeight: 700, textAlign: 'right',
                                            color: changed ? C.accent : C.textSub,
                                        }}>
                                            {f.isCurrency ? fmt(activeVal) : activeVal}
                                        </span>
                                        <input
                                            type="number" min="0"
                                            value={editValues[f.key] ?? ''}
                                            onChange={e => setEditValues(p => ({ ...p, [f.key]: e.target.value }))}
                                            style={{
                                                width: '100%', padding: '5px 8px',
                                                border: `1px solid ${C.borderDark}`,
                                                borderRadius: 6, fontSize: 12, fontWeight: 600,
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
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px', background: C.surface,
                                borderTop: `1px solid ${C.border}`,
                            }}>
                                <FiShield size={11} color={C.textMuted} />
                                <span style={{ fontSize: 11, color: C.textMuted, flex: 1 }}>
                                    Original data is never overwritten — all changes are versioned.
                                </span>
                                {target?.hasHistory && (
                                    <button onClick={() => setShowReset(true)} style={{
                                        padding: '5px 12px', borderRadius: 6,
                                        border: `1px solid ${C.border}`, background: C.bg,
                                        color: C.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        <FiRotateCcw size={11} /> Reset
                                    </button>
                                )}
                                <button onClick={handleSave} disabled={saving} style={{
                                    padding: '5px 16px', borderRadius: 6, border: 'none',
                                    background: saving ? C.textMuted : C.accent,
                                    color: '#fff', fontSize: 12, fontWeight: 600,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    {saving ? <FiRefreshCw size={12} className="tmm-spin" /> : <FiCheck size={12} />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>

                            {/* Reset confirm inline */}
                            {showReset && (
                                <div style={{
                                    padding: '10px 14px', borderTop: `1px solid ${C.border}`,
                                    background: '#fff7ed',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <FiAlertTriangle size={14} color={C.danger} />
                                    <span style={{ fontSize: 11, color: C.text, flex: 1 }}>
                                        Clear all <strong>{target?.historyCount}</strong> history entries? Original values will become active.
                                    </span>
                                    <button onClick={handleReset} disabled={resetting} style={{
                                        padding: '4px 12px', borderRadius: 5, border: 'none',
                                        background: C.danger, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                    }}>
                                        {resetting ? 'Resetting…' : 'Confirm'}
                                    </button>
                                    <button onClick={() => setShowReset(false)} style={{
                                        padding: '4px 10px', borderRadius: 5,
                                        border: `1px solid ${C.border}`, background: C.bg,
                                        color: C.textSub, fontSize: 11, cursor: 'pointer',
                                    }}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ─── SECTION 2: VERSION HISTORY ─── */}
                        <SectionHeading>
                            Version History {history.length > 0 && `· ${history.length} update${history.length !== 1 ? 's' : ''}`}
                        </SectionHeading>

                        {history.length === 0 ? (
                            <div style={{
                                background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`,
                                padding: '28px 20px', textAlign: 'center',
                            }}>
                                <FiClock size={28} color={C.border} style={{ marginBottom: 8 }} />
                                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>No update history yet</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                                    Original imported values are currently active.
                                </div>
                            </div>
                        ) : (
                            <HistoryTimeline history={history} original={target?.original || target} />
                        )}
                    </>
                )}
            </div>
        </>
    );
};

/* ══════════════════════════════════════════════════
   HISTORY TIMELINE — changed fields only
══════════════════════════════════════════════════ */
const HistoryTimeline = ({ history, original }) => {
    // Display newest first. For diff: compare entry[i] against entry[i-1] (or original for first entry).
    const reversed = [...history].reverse(); // index 0 = latest

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {reversed.map((entry, displayIdx) => {
                const isLatest = displayIdx === 0;
                // chronological index: history[history.length - 1 - displayIdx] is this entry
                // the "previous" entry in chronological order:
                const chronoIdx = history.length - 1 - displayIdx;
                const prevEntry = chronoIdx > 0 ? history[chronoIdx - 1] : original;

                const changedFields = getChangedFields(entry, prevEntry);

                return (
                    <HistoryEntry
                        key={displayIdx}
                        entry={entry}
                        changedFields={changedFields}
                        updateNumber={history.length - displayIdx}
                        isLatest={isLatest}
                        isLast={displayIdx === reversed.length - 1}
                    />
                );
            })}
        </div>
    );
};

const HistoryEntry = ({ entry, changedFields, updateNumber, isLatest, isLast }) => {
    return (
        <div style={{ display: 'flex', gap: 0 }}>
            {/* Timeline spine */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 14,
                    background: isLatest ? C.accent : C.borderDark,
                    border: `2px solid ${isLatest ? C.bg : C.border}`,
                    boxShadow: isLatest ? `0 0 0 2px ${C.accentBorder}` : 'none',
                    zIndex: 1,
                }} />
                {!isLast && (
                    <div style={{ flex: 1, width: 1, background: C.border, minHeight: 12 }} />
                )}
            </div>

            {/* Card */}
            <div style={{
                flex: 1, marginBottom: isLast ? 8 : 10, marginLeft: 8,
                background: C.bg,
                border: `1px solid ${isLatest ? C.accentBorder : C.border}`,
                borderRadius: 8, overflow: 'hidden',
            }}>
                {/* Card header row */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px',
                    background: isLatest ? C.accentLight : C.surface,
                    borderBottom: changedFields.length > 0 ? `1px solid ${C.border}` : 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                            Update #{updateNumber}
                        </span>
                        {isLatest && (
                            <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                                color: C.accent, background: C.accentLight,
                                border: `1px solid ${C.accentBorder}`,
                                padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase',
                            }}>
                                Active
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'right' }}>
                        <span style={{ fontWeight: 500, color: C.textSub }}>{entry.updatedBy}</span>
                        <span style={{ margin: '0 5px', color: C.border }}>·</span>
                        {fmtDate(entry.updatedAt)}
                    </div>
                </div>

                {/* Changed fields list */}
                {changedFields.length > 0 ? (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {changedFields.map(f => (
                            <ChangedFieldRow key={f.key} field={f} entry={entry} />
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
                            No field changes detected in this entry.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const ChangedFieldRow = ({ field: f, entry }) => {
    const val = entry[f.key];
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px', borderRadius: 5,
            background: C.surface, border: `1px solid ${C.border}`,
        }}>
            <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>{f.label}</span>
            <span style={{
                fontSize: 12, fontWeight: 700, color: C.accent,
                fontVariantNumeric: 'tabular-nums',
            }}>
                {f.isCurrency ? fmt(val) : val}
            </span>
        </div>
    );
};

/* ══════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT
══════════════════════════════════════════════════ */
const TargetManagementModal = ({ isOpen, onClose }) => {
    const [targets, setTargets] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const overlayRef = useRef(null);

    const fetchList = useCallback(async () => {
        if (!isOpen) return;
        setLoadingList(true);
        try {
            const res = await api.get('/targets');
            setTargets(res.data.targets || []);
        } catch (err) {
            toast.error('Failed to load targets: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingList(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) { setSelectedUser(null); fetchList(); }
    }, [isOpen, fetchList]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const layer = selectedUser ? 'detail' : 'list';

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
                        maxWidth: layer === 'detail' ? 620 : 540,
                        maxHeight: '86vh',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
                        animation: layer === 'detail' ? 'tmm-right .2s ease' : 'tmm-up .2s ease',
                    }}
                >
                    {layer === 'list' ? (
                        <UserListLayer
                            targets={targets} loading={loadingList}
                            onSelectUser={setSelectedUser} onClose={onClose}
                        />
                    ) : (
                        <UserDetailLayer
                            leadOwner={selectedUser}
                            onBack={() => setSelectedUser(null)}
                            onClose={onClose}
                            onSaved={fetchList}
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
    background: C.surface, border: `1px solid ${C.border}`,
    cursor: 'pointer', color: C.textSub, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const centeredStyle = {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '52px 20px',
};

const colHeadStyle = {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: C.textMuted,
};

const CenteredSpinner = () => (
    <div style={centeredStyle}>
        <FiRefreshCw size={28} className="tmm-spin" style={{ color: C.accent, marginBottom: 10 }} />
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Loading…</div>
    </div>
);
