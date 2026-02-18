import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';

const actionColors = {
  INCENTIVE_CREATED: { bg: '#e6fff7', color: '#00b894' },
  INCENTIVE_REVERSED: { bg: '#f8d7da', color: '#721c24' },
  MILESTONE_BONUS_AWARDED: { bg: '#fff3cd', color: '#856404' },
  SETTING_CHANGED: { bg: '#e0cffc', color: '#5a4bd1' },
  LEAD_CREATED: { bg: '#e3f2fd', color: '#0984e3' },
  LEAD_MARKED_SQL: { bg: '#e3f2fd', color: '#0984e3' },
  SQL_VERIFIED_COMPLETE: { bg: '#e6fff7', color: '#00b894' },
  LEAD_MARKED_CLOSED: { bg: '#d4edda', color: '#155724' },
  CLOSURE_VERIFIED: { bg: '#e6fff7', color: '#00b894' },
  PO_GENERATED: { bg: '#f0f0ff', color: '#6c5ce7' },
  LEAD_REJECTED: { bg: '#f8d7da', color: '#721c24' },
  PO_CANCELLED: { bg: '#f8d7da', color: '#721c24' },
  USER_UPDATED: { bg: '#e3f2fd', color: '#0984e3' },
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => { fetchLogs(); }, [page, actionFilter]);

  const fetchLogs = async () => {
    try {
      const params = { page, limit: 30 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/admin/audit-logs', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Audit Logs</h1>
          <p style={{ color: '#6c757d', fontSize: 14 }}>{total} total entries</p>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}
        >
          <option value="">All Actions</option>
          {Object.keys(actionColors).map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>No audit logs found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Action</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Entity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ac = actionColors[log.action] || { bg: '#f0f0f0', color: '#666' };
                  return (
                    <tr key={log._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 16px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{log.userId?.agentName || log.userId?.username || 'System'}</div>
                        <div style={{ fontSize: 11, color: '#adb5bd' }}>{log.userId?.incentive_role || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: ac.bg, color: ac.color }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6c757d' }}>{log.entity}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#495057', maxWidth: 300 }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {JSON.stringify(log.details, null, 1)}
                        </pre>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, borderTop: '1px solid #f0f0f0' }}>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e9ecef', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ padding: '8px 16px', fontSize: 14, color: '#6c757d' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e9ecef', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

