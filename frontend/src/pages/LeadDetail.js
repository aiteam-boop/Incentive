import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCheck, FiX, FiUserPlus, FiFileText } from 'react-icons/fi';

const stageFlow = ['Prospect', 'SQL', 'Closed', 'PO_Generated'];

const LeadDetail = () => {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [incentives, setIncentives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closers, setClosers] = useState([]);
  const [selectedCloser, setSelectedCloser] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [poNumber, setPoNumber] = useState('');

  const role = user?.incentive_role;

  useEffect(() => {
    fetchLead();
    if (hasRole('admin')) fetchClosers();
  }, [id]);

  const fetchLead = async () => {
    try {
      const res = await api.get(`/leads/${id}`);
      setLead(res.data.lead);
      setIncentives(res.data.incentives || []);
    } catch (err) {
      toast.error('Failed to load lead');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchClosers = async () => {
    try {
      const res = await api.get('/auth/users');
      setClosers(res.data.users.filter((u) => u.incentive_role === 'sql_closure'));
    } catch (err) { /* ignore */ }
  };

  const handleAction = async (endpoint, data = {}, successMsg) => {
    try {
      await api.put(`/leads/${id}/${endpoint}`, data);
      toast.success(successMsg);
      fetchLead();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>;
  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Lead not found</div>;

  const stageIdx = stageFlow.indexOf(lead.stage);
  const isRejected = lead.stage === 'Rejected';

  const formatCurrency = (amt) => `₹${(amt || 0).toLocaleString('en-IN')}`;
  const getName = (u) => u?.agentName || u?.username || '—';

  const btnStyle = (bg, color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    background: bg,
    color: color || '#fff',
    cursor: 'pointer',
  });

  return (
    <div>
      {/* Back Button */}
      <button onClick={() => navigate('/leads')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6c5ce7', fontSize: 14, fontWeight: 600, marginBottom: 20, cursor: 'pointer' }}>
        <FiArrowLeft /> Back to Leads
      </button>

      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{lead.leadName}</h1>
            <p style={{ color: '#6c757d', fontSize: 14 }}>{lead.company || 'No company'} • {lead.contactEmail || 'No email'}</p>
          </div>
          <span style={{
            padding: '6px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            background: isRejected ? '#f8d7da' : stageIdx >= 0 ? '#e0cffc' : '#f0f0f0',
            color: isRejected ? '#721c24' : '#5a4bd1',
          }}>
            {lead.stage?.replace('_', ' ')}
          </span>
        </div>

        {/* Stage Progress */}
        {!isRejected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            {stageFlow.map((stage, i) => (
              <React.Fragment key={stage}>
                <div style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: i <= stageIdx ? '#6c5ce7' : '#e9ecef',
                  transition: 'background 0.3s',
                }} />
              </React.Fragment>
            ))}
          </div>
        )}
        {!isRejected && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#6c757d' }}>
            {stageFlow.map((s) => <span key={s}>{s.replace('_', ' ')}</span>)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Lead Details */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Lead Details</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            {[
              ['Contact Phone', lead.contactPhone],
              ['Source', lead.source],
              ['Deal Value', formatCurrency(lead.dealValue)],
              ['Prospector', getName(lead.createdByProspector)],
              ['SQL Closer', lead.assignedSqlCloser ? getName(lead.assignedSqlCloser) : 'Not assigned'],
              ['SQL Marked', lead.sqlMarkedDate ? new Date(lead.sqlMarkedDate).toLocaleDateString() : '—'],
              ['SQL Verified', lead.sqlVerified ? `Yes (${new Date(lead.sqlVerifiedDate).toLocaleDateString()})` : 'No'],
              ['Closure Verified', lead.closureVerified ? 'Yes' : 'No'],
              ['PO Generated', lead.poGenerated ? `Yes - ${lead.poNumber}` : 'No'],
              ['Created', new Date(lead.createdAt).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f9fa' }}>
                <span style={{ color: '#6c757d' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{val || '—'}</span>
              </div>
            ))}
          </div>
          {lead.notes && (
            <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13, color: '#495057' }}>
              <strong>Notes:</strong> {lead.notes}
            </div>
          )}
          {lead.rejectionReason && (
            <div style={{ marginTop: 16, padding: 12, background: '#f8d7da', borderRadius: 8, fontSize: 13, color: '#721c24' }}>
              <strong>Rejection Reason:</strong> {lead.rejectionReason}
            </div>
          )}
        </div>

        {/* Actions & Verification */}
        <div>
          {/* Actions */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Actions</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {/* Prospector: Mark as SQL */}
              {hasRole('prospector', 'admin') && lead.stage === 'Prospect' && (
                <button style={btnStyle('#0984e3')} onClick={() => handleAction('mark-sql', {}, 'Lead marked as SQL!')}>
                  <FiCheck /> Mark as SQL
                </button>
              )}

              {/* Admin: Verify SQL */}
              {hasRole('admin') && lead.stage === 'SQL' && !lead.sqlVerified && (
                <>
                  {!lead.sqlVerifiedByAdmin && (
                    <button style={btnStyle('#00b894')} onClick={() => handleAction('verify-sql', { verifierRole: 'Admin' }, 'SQL verified as Admin!')}>
                      <FiCheck /> Verify SQL (Admin)
                    </button>
                  )}
                  {!lead.sqlVerifiedByCEO && (
                    <button style={btnStyle('#6c5ce7')} onClick={() => handleAction('verify-sql', { verifierRole: 'CEO' }, 'SQL verified as CEO!')}>
                      <FiCheck /> Verify SQL (CEO)
                    </button>
                  )}
                </>
              )}

              {/* Admin: Assign Closer */}
              {hasRole('admin') && lead.sqlVerified && !lead.assignedSqlCloser && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                  <select
                    value={selectedCloser}
                    onChange={(e) => setSelectedCloser(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}
                  >
                    <option value="">Select SQL Closer</option>
                    {closers.map((c) => <option key={c._id} value={c._id}>{c.agentName || c.username}</option>)}
                  </select>
                  <button
                    style={btnStyle('#e17055')}
                    onClick={() => {
                      if (!selectedCloser) return toast.warning('Select a closer first');
                      handleAction('assign-closer', { closerId: selectedCloser }, 'Closer assigned!');
                    }}
                  >
                    <FiUserPlus /> Assign
                  </button>
                </div>
              )}

              {/* SQL Closure / Admin: Mark Closed */}
              {hasRole('sql_closure', 'admin') && lead.stage === 'SQL' && lead.sqlVerified && (
                <button style={btnStyle('#00b894')} onClick={() => handleAction('mark-closed', {}, 'Deal marked as closed!')}>
                  <FiCheck /> Mark as Closed
                </button>
              )}

              {/* Admin: Verify Closure */}
              {hasRole('admin') && lead.stage === 'Closed' && !lead.closureVerified && (
                <>
                  {!lead.closureVerifiedByAdmin && (
                    <button style={btnStyle('#00b894')} onClick={() => handleAction('verify-closure', { verifierRole: 'Admin' }, 'Closure verified as Admin!')}>
                      <FiCheck /> Verify Closure (Admin)
                    </button>
                  )}
                  {!lead.closureVerifiedByCEO && (
                    <button style={btnStyle('#6c5ce7')} onClick={() => handleAction('verify-closure', { verifierRole: 'CEO' }, 'Closure verified as CEO!')}>
                      <FiCheck /> Verify Closure (CEO)
                    </button>
                  )}
                </>
              )}

              {/* Generate PO */}
              {hasRole('admin', 'sql_closure') && lead.stage === 'Closed' && lead.closureVerified && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                  <input
                    placeholder="PO Number (optional)"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}
                  />
                  <button style={btnStyle('#6c5ce7')} onClick={() => handleAction('generate-po', { poNumber }, 'PO Generated!')}>
                    <FiFileText /> Generate PO
                  </button>
                </div>
              )}

              {/* Admin: Reject Lead */}
              {hasRole('admin') && !isRejected && lead.stage !== 'PO_Generated' && (
                <>
                  <button style={btnStyle('#e17055')} onClick={() => setShowReject(true)}>
                    <FiX /> Reject Lead
                  </button>
                  {showReject && (
                    <div style={{ width: '100%', marginTop: 8 }}>
                      <input
                        placeholder="Rejection reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }}
                      />
                      <button
                        style={btnStyle('#e17055')}
                        onClick={() => {
                          handleAction('reject', { reason: rejectReason }, 'Lead rejected');
                          setShowReject(false);
                        }}
                      >
                        Confirm Reject
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Admin: Cancel PO */}
              {hasRole('admin') && lead.stage === 'PO_Generated' && (
                <button style={btnStyle('#e17055')} onClick={() => handleAction('cancel-po', { reason: 'Admin cancelled PO' }, 'PO Cancelled!')}>
                  <FiX /> Cancel PO
                </button>
              )}

              {/* No actions available */}
              {!hasRole('admin') && lead.stage === 'PO_Generated' && (
                <div style={{ color: '#6c757d', fontSize: 14 }}>No actions available — PO has been generated.</div>
              )}
            </div>
          </div>

          {/* Verification Status — visible to admin only */}
          {hasRole('admin') && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Verification Status</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { label: 'SQL Verified by Admin', done: lead.sqlVerifiedByAdmin, name: getName(lead.sqlVerifiedByAdmin) },
                  { label: 'SQL Verified by CEO', done: lead.sqlVerifiedByCEO, name: getName(lead.sqlVerifiedByCEO) },
                  { label: 'Closure Verified by Admin', done: lead.closureVerifiedByAdmin, name: getName(lead.closureVerifiedByAdmin) },
                  { label: 'Closure Verified by CEO', done: lead.closureVerifiedByCEO, name: getName(lead.closureVerifiedByCEO) },
                ].map((v) => (
                  <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: v.done ? '#e6fff7' : '#f8f9fa', borderRadius: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: v.done ? '#00b894' : '#dee2e6', color: '#fff', fontSize: 14 }}>
                      {v.done ? '✓' : '—'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{v.label}</div>
                      <div style={{ fontSize: 12, color: '#6c757d' }}>{v.done ? v.name : 'Pending'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incentives */}
          {incentives.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Incentives for this Lead</h3>
              {incentives.map((inc) => (
                <div key={inc._id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  background: '#f8f9fa',
                  borderRadius: 10,
                  marginBottom: 8,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inc.incentiveType} Incentive</div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>{inc.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{formatCurrency(inc.amount)}</div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: inc.status === 'Paid' ? '#d4edda' : inc.status === 'Approved' ? '#e0cffc' : inc.status === 'Reversed' ? '#f8d7da' : '#fff3cd',
                      color: inc.status === 'Paid' ? '#155724' : inc.status === 'Approved' ? '#5a4bd1' : inc.status === 'Reversed' ? '#721c24' : '#856404',
                    }}>
                      {inc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
