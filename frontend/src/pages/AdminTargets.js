import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
    FiRefreshCw, FiEdit2, FiClock, FiCheck, FiX,
    FiAlertTriangle, FiChevronDown, FiChevronUp, FiRotateCcw,
    FiShield, FiTrendingUp, FiTarget, FiArrowLeft
} from 'react-icons/fi';

/* ─── helpers ─── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return d;
    }
};

/* ─── Target fields configuration ─── */
const TARGET_FIELDS = [
    { key: 'Monthly Sql Target', label: 'Monthly SQL Target', unit: 'SQLs', color: '#6c5ce7' },
    { key: 'Monthly Po Target', label: 'Monthly PO Target', unit: 'POs', color: '#0984e3' },
    { key: 'Monthly Price', label: 'Monthly Price', unit: '₹', color: '#00b894', isCurrency: true },
    { key: 'Monthly Mql Target', label: 'Monthly MQL Target', unit: 'MQLs', color: '#fd79a8' },
    { key: 'Monthly Call_Target', label: 'Monthly Call Target', unit: 'Calls', color: '#fdcb6e' },
    { key: 'Quaterly Sql Target', label: 'Quarterly SQL Target', unit: 'SQLs', color: '#6c5ce7' },
    { key: 'Quaterly Po Target', label: 'Quarterly PO Target', unit: 'POs', color: '#0984e3' },
    { key: 'Quaterly Closure Target', label: 'Quarterly Closure Target', unit: 'POs', color: '#e17055' },
];

/* ─── Sub-components ─── */

const Badge = ({ text, color, bg }) => (
    <span style={{
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: bg || '#f0f0ff', color: color || '#6c5ce7', whiteSpace: 'nowrap',
    }}>{text}</span>
);

const FieldRow = ({ label, original, effective, isEditing, editVal, onEdit, color }) => {
    const changed = effective !== original;
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '1fr 90px 90px 120px',
            alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: changed ? 'rgba(0,184,148,0.06)' : '#f8f9fa',
            border: changed ? '1px solid rgba(0,184,148,0.2)' : '1px solid transparent',
            transition: 'all 0.2s',
            marginBottom: 4,
        }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#adb5bd', textAlign: 'right' }}>
                {original}
            </div>
            <div style={{
                fontSize: 13, fontWeight: 800, color: changed ? '#00b894' : '#495057', textAlign: 'right',
                display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end'
            }}>
                {changed && <FiTrendingUp size={11} color="#00b894" />}
                {effective}
            </div>
            {isEditing ? (
                <input
                    type="number"
                    value={editVal}
                    onChange={onEdit}
                    style={{
                        width: '100%', padding: '6px 10px', border: `2px solid ${color}`,
                        borderRadius: 8, fontSize: 13, fontWeight: 700,
                        textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                    }}
                />
            ) : (
                <div style={{ textAlign: 'right', fontSize: 12, color: '#adb5bd' }}>—</div>
            )}
        </div>
    );
};

const HistoryModal = ({ target, onClose }) => {
    if (!target) return null;
    const history = target.target_update_history || [];

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720,
                maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                    padding: '20px 24px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderRadius: '20px 20px 0 0',
                }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                            📋 Change History — {target.Lead_Owner}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                            {history.length} update{history.length !== 1 ? 's' : ''} recorded
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
                        width: 32, height: 32, cursor: 'pointer', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <FiX size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#adb5bd' }}>
                            <FiClock size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                            <p style={{ fontWeight: 600 }}>No update history yet.</p>
                            <p style={{ fontSize: 13 }}>Original imported values are in use.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[...history].reverse().map((entry, idx) => {
                                const isLatest = idx === 0;
                                return (
                                    <div key={idx} style={{
                                        border: isLatest ? '2px solid #00b894' : '1px solid #e9ecef',
                                        borderRadius: 14, padding: '16px 20px',
                                        background: isLatest ? 'rgba(0,184,148,0.04)' : '#fff',
                                        position: 'relative',
                                    }}>
                                        {isLatest && (
                                            <div style={{
                                                position: 'absolute', top: -10, left: 16,
                                                background: '#00b894', color: '#fff',
                                                fontSize: 10, fontWeight: 800, padding: '2px 10px',
                                                borderRadius: 20,
                                            }}>ACTIVE</div>
                                        )}
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', marginBottom: 12,
                                        }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
                                                Update #{history.length - idx}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#6c757d' }}>
                                                By <strong>{entry.updatedBy}</strong> at {fmtDate(entry.updatedAt)}
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                            gap: 8,
                                        }}>
                                            {TARGET_FIELDS.map(f => {
                                                const val = entry[f.key];
                                                if (val === undefined || val === null) return null;
                                                return (
                                                    <div key={f.key} style={{
                                                        background: '#f8f9fa', borderRadius: 8, padding: '8px 12px',
                                                    }}>
                                                        <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>
                                                            {f.label}
                                                        </div>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: f.color }}>
                                                            {f.isCurrency ? fmt(val) : val}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─── Target Card ─── */
const TargetCard = ({ target, onSave, onReset, saving, resetting }) => {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editValues, setEditValues] = useState({});
    const [showHistory, setShowHistory] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const startEdit = () => {
        // Seed edit values from current effective values
        const seed = {};
        TARGET_FIELDS.forEach(f => {
            seed[f.key] = target[f.key] ?? 0;
        });
        setEditValues(seed);
        setEditing(true);
        setExpanded(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditValues({});
    };

    const handleChange = (key, val) => {
        setEditValues(prev => ({ ...prev, [key]: val }));
    };

    const handleSave = async () => {
        await onSave(target.Lead_Owner, editValues);
        setEditing(false);
        setEditValues({});
    };

    const agentColor = stringToColor(target.Lead_Owner || 'X');

    return (
        <>
            {showHistory && (
                <HistoryModal target={target} onClose={() => setShowHistory(false)} />
            )}

            <div style={{
                background: '#fff', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: editing ? '2px solid #6c5ce7' : '1px solid #f0f0f0',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}>
                {/* Card Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                    borderBottom: expanded ? '1px solid #f0f0f0' : 'none',
                    cursor: 'pointer',
                }} onClick={() => !editing && setExpanded(p => !p)}>
                    {/* Avatar */}
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: agentColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0,
                    }}>
                        {(target.Lead_Owner || '?')[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>
                                {target.Lead_Owner}
                            </span>
                            {target.hasHistory && (
                                <Badge text={`${target.historyCount} update${target.historyCount !== 1 ? 's' : ''}`}
                                    color="#00b894" bg="rgba(0,184,148,0.1)" />
                            )}
                            {!target.hasHistory && (
                                <Badge text="Original" color="#adb5bd" bg="#f8f9fa" />
                            )}
                        </div>
                        {target.latestUpdate && (
                            <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 2 }}>
                                Last updated by <strong>{target.latestUpdate.updatedBy}</strong> on {fmtDate(target.latestUpdate.updatedAt)}
                            </div>
                        )}
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'flex', gap: 12, marginRight: 8 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600 }}>PO Target</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0984e3' }}>
                                {target['Monthly Po Target'] ?? '—'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600 }}>SQL Target</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#6c5ce7' }}>
                                {target['Monthly Sql Target'] ?? '—'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600 }}>Monthly Price</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#00b894' }}>
                                {fmt(target['Monthly Price'])}
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowHistory(true)}
                            title="View full history"
                            style={{
                                padding: '6px 10px', borderRadius: 8, border: '1px solid #e9ecef',
                                background: '#fff', color: '#6c757d', fontSize: 12, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
                            }}
                        >
                            <FiClock size={13} /> History
                        </button>
                        {target.hasHistory && (
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                title="Reset to original imported values"
                                style={{
                                    padding: '6px 10px', borderRadius: 8, border: '1px solid #ffeaa7',
                                    background: '#fffbf0', color: '#e17055', fontSize: 12, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
                                }}
                            >
                                <FiRotateCcw size={13} /> Reset
                            </button>
                        )}
                        <button
                            onClick={startEdit}
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none',
                                background: '#6c5ce7', color: '#fff', fontSize: 12, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700,
                            }}
                        >
                            <FiEdit2 size={13} /> Edit
                        </button>
                        <div style={{ color: '#adb5bd', marginLeft: 4 }}>
                            {expanded ? <FiChevronUp /> : <FiChevronDown />}
                        </div>
                    </div>
                </div>

                {/* Reset confirmation */}
                {showResetConfirm && (
                    <div style={{
                        background: '#fff8e1', borderTop: '1px solid #ffeaa7',
                        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <FiAlertTriangle color="#e17055" size={18} />
                        <span style={{ fontSize: 13, color: '#495057', flex: 1 }}>
                            This will clear <strong>all {target.historyCount} history entries</strong> for {target.Lead_Owner}.
                            Original imported values will become active again.
                        </span>
                        <button
                            onClick={async () => { setShowResetConfirm(false); await onReset(target.Lead_Owner); }}
                            disabled={resetting}
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none',
                                background: '#e17055', color: '#fff', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {resetting ? 'Resetting...' : 'Yes, Reset'}
                        </button>
                        <button
                            onClick={() => setShowResetConfirm(false)}
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: '1px solid #e9ecef',
                                background: '#fff', color: '#495057', fontSize: 12, cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Expanded body */}
                {expanded && (
                    <div style={{ padding: '16px 20px' }}>
                        {/* Column headers */}
                        {editing && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 90px 90px 120px',
                                gap: 8, padding: '4px 12px', marginBottom: 4,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase' }}>Field</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', textAlign: 'right' }}>Original</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#adb5bd', textTransform: 'uppercase', textAlign: 'right' }}>Current</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#6c5ce7', textTransform: 'uppercase', textAlign: 'right' }}>New Value</div>
                            </div>
                        )}

                        {TARGET_FIELDS.map(f => (
                            <FieldRow
                                key={f.key}
                                label={f.label}
                                original={f.isCurrency ? fmt(target.original?.[f.key]) : (target.original?.[f.key] ?? 0)}
                                effective={f.isCurrency ? fmt(target[f.key]) : (target[f.key] ?? 0)}
                                isEditing={editing}
                                editVal={editValues[f.key] !== undefined ? editValues[f.key] : ''}
                                onEdit={e => handleChange(f.key, e.target.value)}
                                color={f.color}
                            />
                        ))}

                        {/* Edit action buttons */}
                        {editing && (
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                                <div style={{ flex: 1, fontSize: 12, color: '#6c757d', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FiShield size={13} color="#00b894" />
                                    Original imported data will NOT be modified — a new history entry will be appended.
                                </div>
                                <button onClick={cancelEdit} style={{
                                    padding: '8px 18px', borderRadius: 10, border: '1px solid #e9ecef',
                                    background: '#fff', color: '#495057', fontSize: 13, fontWeight: 600,
                                    cursor: 'pointer',
                                }}>
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        padding: '8px 22px', borderRadius: 10, border: 'none',
                                        background: saving ? '#adb5bd' : '#6c5ce7',
                                        color: '#fff', fontSize: 13, fontWeight: 700,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                    }}
                                >
                                    {saving ? <FiRefreshCw className="spin" size={14} /> : <FiCheck size={14} />}
                                    {saving ? 'Saving...' : 'Save Update'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

/* ─── Deterministic color from string ─── */
function stringToColor(str) {
    const palette = ['#6c5ce7', '#0984e3', '#00b894', '#e17055', '#fd79a8', '#fdcb6e', '#00cec9', '#a29bfe'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
const AdminTargets = () => {
    const navigate = useNavigate();
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [resetting, setResetting] = useState({});
    const [search, setSearch] = useState('');

    const fetchTargets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/targets');
            setTargets(res.data.targets || []);
        } catch (err) {
            toast.error('Failed to load targets: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTargets(); }, [fetchTargets]);

    const handleSave = async (leadOwner, editValues) => {
        setSaving(prev => ({ ...prev, [leadOwner]: true }));
        try {
            // Convert all values to numbers
            const payload = {};
            TARGET_FIELDS.forEach(f => {
                if (editValues[f.key] !== undefined && editValues[f.key] !== '') {
                    payload[f.key] = Number(editValues[f.key]);
                }
            });

            const res = await api.put(`/targets/${encodeURIComponent(leadOwner)}`, payload);
            toast.success(`✅ ${res.data.message}`);

            // Refresh targets list
            await fetchTargets();
        } catch (err) {
            toast.error('Save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(prev => ({ ...prev, [leadOwner]: false }));
        }
    };

    const handleReset = async (leadOwner) => {
        setResetting(prev => ({ ...prev, [leadOwner]: true }));
        try {
            const res = await api.delete(`/targets/${encodeURIComponent(leadOwner)}/reset`);
            toast.success(`🔁 ${res.data.message}`);
            await fetchTargets();
        } catch (err) {
            toast.error('Reset failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setResetting(prev => ({ ...prev, [leadOwner]: false }));
        }
    };

    const filtered = targets.filter(t =>
        !search || (t.Lead_Owner || '').toLowerCase().includes(search.toLowerCase())
    );

    const totalWithHistory = targets.filter(t => t.hasHistory).length;

    return (
        <div style={{ height: '100vh', overflow: 'hidden', background: '#f5f6fa', display: 'flex', flexDirection: 'column' }}>
            {/* ── Dark Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                color: '#fff', padding: '12px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '6px 12px', borderRadius: 8, border: 'none',
                            background: 'rgba(255,255,255,0.12)', color: '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        <FiArrowLeft size={14} /> Dashboard
                    </button>
                    <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiTarget size={18} color="#a29bfe" />
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>Target Management</div>
                            <div style={{ fontSize: 11, opacity: 0.6 }}>Admin — versioned target history</div>
                        </div>
                    </div>
                </div>
                <button
                    onClick={fetchTargets}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'rgba(255,255,255,0.12)', color: '#fff',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    <FiRefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {/* ── Scrollable Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                {/* Page title */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>🎯 Target Management</h1>
                    <p style={{ color: '#6c757d', fontSize: 14, marginTop: 4 }}>
                        View and update performance targets. All changes are versioned — original data is never overwritten.
                    </p>
                </div>

                {/* Stats Bar */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{
                        background: '#fff', borderRadius: 12, padding: '12px 20px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: '1 1 140px',
                        borderLeft: '3px solid #6c5ce7',
                    }}>
                        <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 700, textTransform: 'uppercase' }}>Total Agents</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{targets.length}</div>
                    </div>
                    <div style={{
                        background: '#fff', borderRadius: 12, padding: '12px 20px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: '1 1 140px',
                        borderLeft: '3px solid #00b894',
                    }}>
                        <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 700, textTransform: 'uppercase' }}>Updated by Admin</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#00b894' }}>{totalWithHistory}</div>
                    </div>
                    <div style={{
                        background: '#fff', borderRadius: 12, padding: '12px 20px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: '1 1 140px',
                        borderLeft: '3px solid #e9ecef',
                    }}>
                        <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 700, textTransform: 'uppercase' }}>Using Original</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#adb5bd' }}>{targets.length - totalWithHistory}</div>
                    </div>
                </div>

                {/* Data Integrity Notice */}
                <div style={{
                    background: 'linear-gradient(135deg, #f0f0ff, #e8f5e9)',
                    borderRadius: 12, padding: '12px 18px', marginBottom: 20,
                    border: '1px solid #e0cffc',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <FiShield size={18} color="#6c5ce7" />
                    <div style={{ fontSize: 13, color: '#495057' }}>
                        <strong style={{ color: '#6c5ce7' }}>Data Protection:</strong>{' '}
                        Original imported fields are read-only and can never be overwritten.
                        Every admin update is stored as a new versioned entry in{' '}
                        <code style={{ background: 'rgba(108,92,231,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
                            target_update_history
                        </code>.
                        The dashboard always uses the <strong>latest entry</strong>, falling back to the original if no history exists.
                    </div>
                </div>

                {/* Search */}
                <div style={{ marginBottom: 16 }}>
                    <input
                        type="text"
                        placeholder="🔍 Search by agent name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', maxWidth: 320, padding: '10px 16px',
                            border: '2px solid #e9ecef', borderRadius: 10, fontSize: 14,
                            outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#6c5ce7')}
                        onBlur={e => (e.target.style.borderColor = '#e9ecef')}
                    />
                </div>

                {/* Target Cards */}
                {loading ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6c757d' }}>
                        <FiRefreshCw size={40} className="spin" style={{ marginBottom: 12 }} />
                        <p style={{ fontWeight: 600 }}>Loading targets...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#adb5bd', background: '#fff', borderRadius: 16 }}>
                        <FiTarget size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>No targets found.</p>
                        {search && <p style={{ fontSize: 13 }}>Try a different search term.</p>}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filtered.map(t => (
                            <TargetCard
                                key={t.Lead_Owner}
                                target={t}
                                onSave={handleSave}
                                onReset={handleReset}
                                saving={!!saving[t.Lead_Owner]}
                                resetting={!!resetting[t.Lead_Owner]}
                            />
                        ))}
                    </div>
                )}

                {/* CSS for spin animation */}
                <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
            </div> {/* end scrollable body */}
        </div>
    );
};

export default AdminTargets;
