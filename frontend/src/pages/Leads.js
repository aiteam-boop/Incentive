import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiPlus, FiChevronRight } from 'react-icons/fi';

const stageColors = {
  Prospect: { bg: '#e3f2fd', color: '#0984e3' },
  SQL: { bg: '#fff3cd', color: '#856404' },
  Closed: { bg: '#d4edda', color: '#155724' },
  PO_Generated: { bg: '#e0cffc', color: '#5a4bd1' },
  Rejected: { bg: '#f8d7da', color: '#721c24' },
};

const Leads = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newLead, setNewLead] = useState({ leadName: '', company: '', contactEmail: '', contactPhone: '', source: '', dealValue: '', notes: '' });

  useEffect(() => { fetchLeads(); }, [stageFilter]);

  const fetchLeads = async () => {
    try {
      const params = {};
      if (stageFilter) params.stage = stageFilter;
      const res = await api.get('/leads', { params });
      setLeads(res.data.leads);
    } catch (err) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leads', { ...newLead, dealValue: Number(newLead.dealValue) || 0 });
      toast.success('Lead created successfully!');
      setShowCreate(false);
      setNewLead({ leadName: '', company: '', contactEmail: '', contactPhone: '', source: '', dealValue: '', notes: '' });
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #e9ecef',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>Leads</h1>
          <p style={{ color: '#6c757d', fontSize: 14 }}>{leads.length} leads found</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All Stages</option>
            <option value="Prospect">Prospect</option>
            <option value="SQL">SQL</option>
            <option value="Closed">Closed</option>
            <option value="PO_Generated">PO Generated</option>
            <option value="Rejected">Rejected</option>
          </select>

          {hasRole('prospector', 'admin') && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                boxShadow: '0 4px 15px rgba(108,92,231,0.3)',
                cursor: 'pointer',
              }}
            >
              <FiPlus /> New Lead
            </button>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Create New Lead</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Lead Name *</label>
                  <input style={inputStyle} value={newLead.leadName} onChange={(e) => setNewLead({ ...newLead, leadName: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Company</label>
                  <input style={inputStyle} value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Email</label>
                    <input style={inputStyle} type="email" value={newLead.contactEmail} onChange={(e) => setNewLead({ ...newLead, contactEmail: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Phone</label>
                    <input style={inputStyle} value={newLead.contactPhone} onChange={(e) => setNewLead({ ...newLead, contactPhone: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Source</label>
                    <input style={inputStyle} value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Deal Value (₹)</label>
                    <input style={inputStyle} type="number" value={newLead.dealValue} onChange={(e) => setNewLead({ ...newLead, dealValue: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '10px 24px', borderRadius: 10, border: '2px solid #e9ecef', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6c5ce7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Create Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>No leads found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Lead Name</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Company</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Stage</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Prospector</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>SQL Closer</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>SQL Verified</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#495057' }}>Deal Value</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const sc = stageColors[lead.stage] || { bg: '#f0f0f0', color: '#666' };
                  return (
                    <tr
                      key={lead._id}
                      onClick={() => navigate(`/leads/${lead._id}`)}
                      style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{lead.leadName}</td>
                      <td style={{ padding: '14px 16px', color: '#6c757d' }}>{lead.company || '—'}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>
                          {lead.stage?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6c757d' }}>{lead.createdByProspector?.agentName || lead.createdByProspector?.username || '—'}</td>
                      <td style={{ padding: '14px 16px', color: '#6c757d' }}>{lead.assignedSqlCloser?.agentName || lead.assignedSqlCloser?.username || '—'}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {lead.sqlVerified ? <span style={{ color: '#00b894', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dee2e6' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                        {lead.dealValue ? `₹${lead.dealValue.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#adb5bd' }}><FiChevronRight /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
