import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiCheck, FiClock, FiEye, FiX } from 'react-icons/fi';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const StatusBadge = ({ status }) => {
  const map = {
    Earned: { bg: '#d4edda', color: '#155724' },
    Approved: { bg: '#d4edda', color: '#155724' },
    Pending: { bg: '#fff3cd', color: '#856404' },
  };
  const s = map[status] || { bg: '#f0f0f0', color: '#666' };
  return <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>;
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 12 }}>
    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>{title}</h2>
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>{children}</div>
  </div>
);

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#495057', fontSize: 11, whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 12 };

const ApprovalTable = ({ title, items, leadMap, isCEO, onApproval, onViewDetail }) => {
  if (!items || items.length === 0) {
    return (
      <Section title={title}>
        <div style={{ padding: 28, textAlign: 'center', color: '#6c757d', fontSize: 12 }}>
          No pending items in this group.
        </div>
      </Section>
    );
  }

  return (
    <Section title={`${title} — ${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <th style={th}>Enquiry Code</th>
              <th style={th}>Owner</th>
              <th style={th}>Client Company</th>
              <th style={th}>Lead Status</th>
              <th style={th}>Incentive Type</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, textAlign: 'center' }}>Admin</th>
              <th style={{ ...th, textAlign: 'center' }}>CEO</th>
              <th style={{ ...th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(inc => {
              const lead = leadMap[inc.enquiryCode];
              const needsAdminApproval = !inc.adminApproved;
              const needsCeoApproval = !inc.ceoApproved;

              return (
                <tr key={inc._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{inc.enquiryCode}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{inc.agentName}</td>
                  <td style={td}>{inc.clientCompanyName || '—'}</td>
                  <td style={td}>
                    {lead ? <StatusBadge status={lead.status || '—'} /> : <span style={{ color: '#adb5bd' }}>—</span>}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: inc.incentiveType === 'SQL' ? '#e3f2fd' : inc.incentiveType === 'PO_CONVERSION' ? '#fff3e0' : '#e0cffc',
                      color: inc.incentiveType === 'SQL' ? '#0984e3' : inc.incentiveType === 'PO_CONVERSION' ? '#f9a825' : '#6c5ce7',
                    }}>
                      {inc.incentiveType === 'SQL' ? '✅ SQL' : inc.incentiveType === 'PO_CONVERSION' ? '📦 PO Conversion' : inc.incentiveType === 'CLOSURE' ? '🎯 PO Closure' : inc.incentiveType}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#00b894' }}>{fmt(inc.amount)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {needsAdminApproval ? (
                      isCEO ? (
                        <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fff3cd', color: '#856404' }}>
                          <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending Admin
                        </span>
                      ) : (
                        <button
                          onClick={() => onApproval(inc._id, 'admin', false)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6c5ce7',
                            color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                          title="Approve as Admin"
                        >
                          <FiCheck size={12} /> Approve
                        </button>
                      )
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                        <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {needsCeoApproval ? (
                      isCEO ? (
                        (!isCEO || inc.adminApproved) ? (
                          <button
                            onClick={() => onApproval(inc._id, 'ceo', false)}
                            disabled={isCEO && !inc.adminApproved}
                            style={{
                              padding: '6px 12px', borderRadius: 8, border: 'none', background: (isCEO && !inc.adminApproved) ? '#adb5bd' : '#00b894',
                              color: '#fff', fontSize: 11, fontWeight: 700, cursor: (isCEO && !inc.adminApproved) ? 'not-allowed' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              opacity: (isCEO && !inc.adminApproved) ? 0.6 : 1,
                            }}
                            title={isCEO && !inc.adminApproved ? 'Wait for Admin approval first' : 'Approve as CEO'}
                          >
                            <FiCheck size={12} /> Approve
                          </button>
                        ) : (
                          <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fff3cd', color: '#856404' }}>
                            <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending
                          </span>
                        )
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fff3cd', color: '#856404' }}>
                          <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending CEO
                        </span>
                      )
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                        <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      onClick={() => onViewDetail(inc.enquiryCode)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, border: '1px solid #e9ecef',
                        background: '#fff', color: '#6c5ce7', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                      title="View Lead Details"
                    >
                      <FiEye size={12} /> Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const ApprovalsGrouped = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLead, setDetailLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const role = user?.incentive_role;
  const isAdmin = role === 'admin';
  const isCEO = user?.agentName && user.agentName.toLowerCase().includes('ceo');

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/data');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApproval = async (id, type, currentlyApproved) => {
    try {
      if (currentlyApproved) {
        await api.put(`/dashboard/revoke/${id}`, { approvalType: type });
        toast.success(`${type === 'admin' ? 'Admin' : 'CEO'} approval revoked`);
      } else {
        await api.put(`/dashboard/approve/${id}`, { approvalType: type });
        toast.success(`Approved as ${type === 'admin' ? 'Admin' : 'CEO'}`);
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const openDetail = async (enquiryCode) => {
    setDetailLoading(true);
    setDetailLead(null);
    try {
      const res = await api.get(`/dashboard/lead-details/${enquiryCode}`);
      setDetailLead(res.data);
    } catch (err) {
      toast.error('Failed to load lead details');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 16, color: '#6c757d' }}>Loading approvals...</div>;
  if (!data || !isAdmin) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Access denied. Admin access required.</div>;

  const { leads, incentives } = data;
  const leadMap = {};
  leads.forEach(l => { leadMap[l.enquiryCode] = l; });

  const pendingIncentives = incentives.filter(inc => {
    if (inc.status === 'Reversed') return false;
    if (isCEO) {
      return inc.adminApproved && !inc.ceoApproved;
    }
    return !inc.adminApproved || !inc.ceoApproved;
  });

  // Groups
  const SQL_CLOSURE_TEAM = ['Gauri', 'gauri', 'Anjali', 'anjali', 'Amisha', 'amisha'];
  const PROSPECTOR_TEAM = ['Aparna', 'aparna', 'Sapna', 'sapna'];

  const closureApprovals = pendingIncentives.filter(
    inc => inc.incentiveType === 'CLOSURE' && SQL_CLOSURE_TEAM.includes(inc.agentName)
  );

  const prospectorApprovals = pendingIncentives.filter(
    inc => (inc.incentiveType === 'SQL' || inc.incentiveType === 'PO_CONVERSION') &&
      PROSPECTOR_TEAM.includes(inc.agentName)
  );

  const otherApprovals = pendingIncentives.filter(
    inc => !closureApprovals.includes(inc) && !prospectorApprovals.includes(inc)
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', padding: '12px 20px', marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>🔔 Incentive Approvals</h1>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{user?.agentName} • {isCEO ? 'CEO' : 'Admin'}</div>
      </div>

      <div style={{ padding: '12px 20px', maxWidth: 1400, margin: '0 auto' }}>
        {pendingIncentives.length === 0 ? (
          <Section title={`Pending Approvals — ${user?.agentName || 'Admin'}`}>
            <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>
              <FiCheck size={48} style={{ marginBottom: 12, color: '#00b894' }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No pending approvals</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>All incentives have been approved</p>
            </div>
          </Section>
        ) : (
          <>
            <ApprovalTable
              title="SQL Closure Team — PO Incentives"
              items={closureApprovals}
              leadMap={leadMap}
              isCEO={isCEO}
              onApproval={handleApproval}
              onViewDetail={openDetail}
            />
            <ApprovalTable
              title="Prospector Team — SQL & PO Conversion"
              items={prospectorApprovals}
              leadMap={leadMap}
              isCEO={isCEO}
              onApproval={handleApproval}
              onViewDetail={openDetail}
            />
            {otherApprovals.length > 0 && (
              <ApprovalTable
                title="Other Pending Approvals"
                items={otherApprovals}
                leadMap={leadMap}
                isCEO={isCEO}
                onApproval={handleApproval}
                onViewDetail={openDetail}
              />
            )}
          </>
        )}
      </div>

      {(detailLead || detailLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => { setDetailLead(null); setDetailLoading(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 900, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detailLoading ? 'Loading...' : `Lead: ${detailLead?.lead?.enquiryCode}`}</h2>
              <button onClick={() => { setDetailLead(null); setDetailLoading(false); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6c757d' }}><FiX /></button>
            </div>
            {detailLoading ? <p style={{ textAlign: 'center', padding: 20 }}>Loading lead details...</p> : detailLead && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    ['Enquiry Code', detailLead.lead.enquiryCode],
                    ['Client Company', detailLead.lead.clientCompanyName],
                    ['Client Person', detailLead.lead.clientPersonName],
                    ['Contact', detailLead.lead.clientNumber],
                    ['Email', detailLead.lead.clientEmail],
                    ['Lead Owner', detailLead.lead.leadOwner],
                    ['Sales Owner', detailLead.lead.salesOwner],
                    ['Status', detailLead.lead.status],
                    ['SQL Date', fmtDate(detailLead.lead.sqlDate)],
                    ['PO Date', fmtDate(detailLead.lead.poDate)],
                    ['PO Number', detailLead.lead.poNumber],
                    ['PO Value', detailLead.lead.poValue ? fmt(detailLead.lead.poValue) : '—'],
                  ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
                    <div key={label} style={{ fontSize: 13 }}>
                      <span style={{ color: '#6c757d' }}>{label}: </span>
                      <span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsGrouped;


