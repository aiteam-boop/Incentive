import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiDollarSign, FiClock, FiCheckCircle, FiLogOut, FiRefreshCw, FiX, FiEye, FiCheck } from 'react-icons/fi';

/* ───── helpers ───── */
const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const roleLabels = { admin: 'Admin', prospector: 'Prospector', sql_closure: 'SQL Closure' };
const roleColors = { admin: '#6c5ce7', prospector: '#00b894', sql_closure: '#0984e3' };

/* ───── stat card ───── */
const StatCard = ({ icon, label, value, sub, color, bg, onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 200px', minWidth: 200,
    cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s',
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'none')}
  >
    <div style={{ width: 46, height: 46, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 12, color: '#6c757d' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#adb5bd' }}>{sub}</div>}
    </div>
  </div>
);

/* ───── approval badge ───── */
const ApprovalBadge = ({ approved, label, onClick, canClick }) => (
  <div
    onClick={(e) => { e.stopPropagation(); if (canClick) onClick(); }}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8,
      fontSize: 11, fontWeight: 700, cursor: canClick ? 'pointer' : 'default',
      background: approved ? '#d4edda' : '#fff3cd',
      color: approved ? '#155724' : '#856404',
      border: `1px solid ${approved ? '#c3e6cb' : '#ffeaa7'}`,
      transition: 'all .15s',
    }}
    title={canClick ? (approved ? `Revoke ${label} approval` : `Approve as ${label}`) : ''}
  >
    {approved ? <FiCheck size={12} /> : <FiClock size={12} />}
    {label}: {approved ? 'Approved' : 'Pending'}
  </div>
);

/* ═══════ MAIN DASHBOARD ═══════ */
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const role = user?.incentive_role;
  const isAdmin = role === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/data');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* sync incentives (admin only) */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/dashboard/sync-incentives');
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /* approve / revoke */
  const handleApproval = async (id, type, currentlyApproved) => {
    try {
      if (currentlyApproved) {
        await api.put(`/dashboard/revoke/${id}`, { approvalType: type });
      } else {
        await api.put(`/dashboard/approve/${id}`, { approvalType: type });
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  /* open lead detail */
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 16, color: '#6c757d' }}>Loading dashboard...</div>;
  if (!data) return null;

  const { leads, incentives, summary } = data;

  /* group incentives by enquiryCode for quick lookup */
  const incMap = {};
  incentives.forEach(inc => {
    if (!incMap[inc.enquiryCode]) incMap[inc.enquiryCode] = [];
    incMap[inc.enquiryCode].push(inc);
  });

  /* earnings breakdown data */
  const earningsBreakdown = {};
  incentives.filter(i => i.status !== 'Reversed' && i.adminApproved && i.ceoApproved).forEach(i => {
    if (!earningsBreakdown[i.enquiryCode]) earningsBreakdown[i.enquiryCode] = { company: i.clientCompanyName, items: [], total: 0 };
    earningsBreakdown[i.enquiryCode].items.push(i);
    earningsBreakdown[i.enquiryCode].total += i.amount;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {/* ── header ── */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 28 }}>💰</span>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Incentive Dashboard</h1>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{user?.agentName} • <span style={{ color: roleColors[role], fontWeight: 600 }}>{roleLabels[role]}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <FiRefreshCw className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Incentives'}
            </button>
          )}
          <button onClick={() => { logout(); window.location.href = '/login'; }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'rgba(225,112,85,0.2)', color: '#e17055', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* ── stat cards ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <StatCard
            icon={<FiDollarSign />} label="Total Earned" value={fmt(summary.totalEarned)}
            sub="Both Admin + CEO approved" color="#00b894" bg="#e6fff7"
            onClick={() => setShowBreakdown(true)}
          />
          <StatCard icon={<FiClock />} label="Pending Approval" value={fmt(summary.totalPending)} sub="Awaiting approvals" color="#fdcb6e" bg="#fff8e1" />
          <StatCard icon={<FiCheckCircle />} label="Total Entries" value={summary.totalEntries} sub="Incentive records" color="#6c5ce7" bg="#f0f0ff" />
        </div>

        {/* ── SQL Closure View ── */}
        {(role === 'sql_closure' || isAdmin) && (
          <Section title={isAdmin ? '🔵 SQL Closure Team — PO Incentives (₹1,000/PO)' : '📋 Your PO Incentives (₹1,000 per PO)'}>
            <IncentiveTable
              leads={leads.filter(l => l.poDate)}
              incentives={incentives}
              incMap={incMap}
              type="CLOSURE"
              isAdmin={isAdmin}
              role={role}
              onApproval={handleApproval}
              onViewDetail={openDetail}
              showOwner={isAdmin}
            />
          </Section>
        )}

        {/* ── SQL Closure: SQL leads without PO ── */}
        {(role === 'sql_closure') && (
          <Section title="📊 Your SQL Leads (Awaiting PO)">
            <SQLLeadsTable leads={leads.filter(l => !l.poDate)} onViewDetail={openDetail} />
          </Section>
        )}

        {/* ── Prospector View ── */}
        {(role === 'prospector' || isAdmin) && (
          <Section title={isAdmin ? '🟢 Prospector Team — SQL & PO Conversion Incentives' : '📋 Your SQL Incentives'}>
            <ProspectorTable
              leads={leads.filter(l => l.sqlDate)}
              incentives={incentives}
              incMap={incMap}
              isAdmin={isAdmin}
              role={role}
              onApproval={handleApproval}
              onViewDetail={openDetail}
              showOwner={isAdmin}
            />
          </Section>
        )}
      </div>

      {/* ── Earnings Breakdown Modal ── */}
      {showBreakdown && (
        <Modal title="💰 Total Earnings Breakdown" onClose={() => setShowBreakdown(false)}>
          {Object.keys(earningsBreakdown).length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>No approved earnings yet.</p>
          ) : (
            <div>
              {Object.entries(earningsBreakdown).map(([code, data]) => (
                <div key={code} style={{ padding: 14, background: '#f8f9fa', borderRadius: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{code}</span>
                      <span style={{ color: '#6c757d', marginLeft: 8, fontSize: 13 }}>{data.company}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: '#00b894', fontSize: 16 }}>{fmt(data.total)}</span>
                  </div>
                  {data.items.map(item => (
                    <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#495057', padding: '4px 0' }}>
                      <span>{item.incentiveType === 'SQL' ? '✅ SQL Verified' : item.incentiveType === 'PO_CONVERSION' ? '📦 PO Conversion' : item.incentiveType === 'CLOSURE' ? '🎯 PO Closure' : item.incentiveType}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ borderTop: '2px solid #e9ecef', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>Grand Total</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#00b894' }}>{fmt(summary.totalEarned)}</span>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Lead Detail Modal ── */}
      {(detailLead || detailLoading) && (
        <Modal title={detailLoading ? 'Loading...' : `Lead: ${detailLead?.lead?.enquiryCode}`} onClose={() => { setDetailLead(null); setDetailLoading(false); }} wide>
          {detailLoading ? <p style={{ textAlign: 'center', padding: 20 }}>Loading lead details...</p> : detailLead && <LeadDetailContent data={detailLead} role={role} />}
        </Modal>
      )}
    </div>
  );
};

/* ═══════ SUB COMPONENTS ═══════ */

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>{title}</h2>
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>{children}</div>
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
    <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: wide ? 900 : 600, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6c757d' }}><FiX /></button>
      </div>
      {children}
    </div>
  </div>
);

/* ── SQL Closure incentive table ── */
const IncentiveTable = ({ leads, incMap, type, isAdmin, onApproval, onViewDetail, showOwner }) => {
  if (!leads.length) return <p style={{ color: '#6c757d', textAlign: 'center', padding: 24 }}>No PO leads found from Jan 6, 2026.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
            <th style={th}>Enquiry Code</th>
            <th style={th}>Client Company</th>
            {showOwner && <th style={th}>Owner</th>}
            <th style={{ ...th, textAlign: 'center' }}>PO Date</th>
            <th style={{ ...th, textAlign: 'right' }}>PO Value</th>
            <th style={th}>PO Number</th>
            <th style={{ ...th, textAlign: 'right' }}>Incentive</th>
            <th style={{ ...th, textAlign: 'center' }}>Admin</th>
            <th style={{ ...th, textAlign: 'center' }}>CEO</th>
            <th style={{ ...th, textAlign: 'center' }}>Status</th>
            <th style={{ ...th, textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const incs = (incMap[lead.enquiryCode] || []).filter(i => i.incentiveType === type && i.status !== 'Reversed');
            const inc = incs[0];
            return (
              <tr key={lead.enquiryCode} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{lead.enquiryCode}</td>
                <td style={td}>{lead.clientCompanyName || '—'}</td>
                {showOwner && <td style={{ ...td, color: '#6c757d' }}>{lead.salesOwner || lead.leadOwner}</td>}
                <td style={{ ...td, textAlign: 'center' }}>{fmtDate(lead.poDate)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{lead.poValue ? fmt(lead.poValue) : '—'}</td>
                <td style={{ ...td, color: '#6c757d', fontSize: 12 }}>{lead.poNumber || '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#00b894' }}>{inc ? fmt(inc.amount) : '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {inc ? <ApprovalBadge approved={inc.adminApproved} label="Admin" canClick={isAdmin} onClick={() => onApproval(inc._id, 'admin', inc.adminApproved)} /> : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {inc ? <ApprovalBadge approved={inc.ceoApproved} label="CEO" canClick={isAdmin} onClick={() => onApproval(inc._id, 'ceo', inc.ceoApproved)} /> : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {inc ? <StatusBadge status={inc.adminApproved && inc.ceoApproved ? 'Earned' : 'Pending'} /> : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button onClick={() => onViewDetail(lead.enquiryCode)} style={viewBtn}><FiEye size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ── SQL Leads table (no PO yet) ── */
const SQLLeadsTable = ({ leads, onViewDetail }) => {
  if (!leads.length) return <p style={{ color: '#6c757d', textAlign: 'center', padding: 24 }}>No SQL leads awaiting PO.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
            <th style={th}>Enquiry Code</th>
            <th style={th}>Client Company</th>
            <th style={{ ...th, textAlign: 'center' }}>SQL Date</th>
            <th style={{ ...th, textAlign: 'center' }}>Status</th>
            <th style={{ ...th, textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.enquiryCode} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{lead.enquiryCode}</td>
              <td style={td}>{lead.clientCompanyName || '—'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{fmtDate(lead.sqlDate)}</td>
              <td style={{ ...td, textAlign: 'center' }}><StatusBadge status={lead.status} /></td>
              <td style={{ ...td, textAlign: 'center' }}>
                <button onClick={() => onViewDetail(lead.enquiryCode)} style={viewBtn}><FiEye size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ── Prospector incentive table ── */
const ProspectorTable = ({ leads, incMap, isAdmin, onApproval, onViewDetail, showOwner }) => {
  if (!leads.length) return <p style={{ color: '#6c757d', textAlign: 'center', padding: 24 }}>No SQL leads found from Jan 6, 2026.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
            <th style={th}>Enquiry Code</th>
            <th style={th}>Client Company</th>
            {showOwner && <th style={th}>Prospector</th>}
            <th style={{ ...th, textAlign: 'center' }}>SQL Date</th>
            <th style={{ ...th, textAlign: 'center' }}>SQL ₹300</th>
            <th style={{ ...th, textAlign: 'center' }}>Admin</th>
            <th style={{ ...th, textAlign: 'center' }}>CEO</th>
            <th style={{ ...th, textAlign: 'center' }}>PO?</th>
            <th style={{ ...th, textAlign: 'center' }}>PO ₹200</th>
            <th style={{ ...th, textAlign: 'center' }}>Admin</th>
            <th style={{ ...th, textAlign: 'center' }}>CEO</th>
            <th style={{ ...th, textAlign: 'right' }}>Total</th>
            <th style={{ ...th, textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => {
            const allIncs = incMap[lead.enquiryCode] || [];
            const sqlInc = allIncs.find(i => i.incentiveType === 'SQL' && i.status !== 'Reversed');
            const poInc = allIncs.find(i => i.incentiveType === 'PO_CONVERSION' && i.status !== 'Reversed');
            const hasPO = !!lead.poDate;
            let leadTotal = 0;
            if (sqlInc && sqlInc.adminApproved && sqlInc.ceoApproved) leadTotal += sqlInc.amount;
            if (poInc && poInc.adminApproved && poInc.ceoApproved) leadTotal += poInc.amount;

            return (
              <tr key={lead.enquiryCode} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{lead.enquiryCode}</td>
                <td style={td}>{lead.clientCompanyName || '—'}</td>
                {showOwner && <td style={{ ...td, color: '#6c757d' }}>{lead.leadOwner}</td>}
                <td style={{ ...td, textAlign: 'center' }}>{fmtDate(lead.sqlDate)}</td>
                {/* SQL Incentive */}
                <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: sqlInc ? '#00b894' : '#adb5bd' }}>
                  {sqlInc ? fmt(sqlInc.amount) : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {sqlInc ? <ApprovalBadge approved={sqlInc.adminApproved} label="Admin" canClick={isAdmin} onClick={() => onApproval(sqlInc._id, 'admin', sqlInc.adminApproved)} /> : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {sqlInc ? <ApprovalBadge approved={sqlInc.ceoApproved} label="CEO" canClick={isAdmin} onClick={() => onApproval(sqlInc._id, 'ceo', sqlInc.ceoApproved)} /> : '—'}
                </td>
                {/* PO Conversion */}
                <td style={{ ...td, textAlign: 'center' }}>
                  {hasPO
                    ? <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>✓ Yes</span>
                    : <span style={{ color: '#adb5bd' }}>No</span>
                  }
                </td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: poInc ? '#0984e3' : '#adb5bd' }}>
                  {poInc ? fmt(poInc.amount) : hasPO ? '—' : ''}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {poInc ? <ApprovalBadge approved={poInc.adminApproved} label="Admin" canClick={isAdmin} onClick={() => onApproval(poInc._id, 'admin', poInc.adminApproved)} /> : ''}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {poInc ? <ApprovalBadge approved={poInc.ceoApproved} label="CEO" canClick={isAdmin} onClick={() => onApproval(poInc._id, 'ceo', poInc.ceoApproved)} /> : ''}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: leadTotal > 0 ? '#00b894' : '#adb5bd' }}>
                  {leadTotal > 0 ? fmt(leadTotal) : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button onClick={() => onViewDetail(lead.enquiryCode)} style={viewBtn}><FiEye size={14} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ── Status badge ── */
const StatusBadge = ({ status }) => {
  const map = {
    Earned: { bg: '#d4edda', color: '#155724' },
    Approved: { bg: '#d4edda', color: '#155724' },
    Pending: { bg: '#fff3cd', color: '#856404' },
    PO: { bg: '#e0cffc', color: '#5a4bd1' },
    SQL: { bg: '#e3f2fd', color: '#0984e3' },
    Lost: { bg: '#f8d7da', color: '#721c24' },
    'Follow Up': { bg: '#fff8e1', color: '#f9a825' },
    'SRF/MQL': { bg: '#e3f2fd', color: '#0984e3' },
  };
  const s = map[status] || { bg: '#f0f0f0', color: '#666' };
  return <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>;
};

/* ── Lead Detail Content ── */
const LeadDetailContent = ({ data, role }) => {
  const { lead, remarks, incentives } = data;

  // Build timeline
  const timeline = [];
  if (lead.date) timeline.push({ date: lead.date, label: 'Lead Created', color: '#74b9ff' });
  if (lead.sqlDate) timeline.push({ date: lead.sqlDate, label: 'SQL Marked', color: '#fdcb6e' });
  if (lead.poDate) timeline.push({ date: lead.poDate, label: 'PO Generated', color: '#6c5ce7' });
  if (lead.lostDate) timeline.push({ date: lead.lostDate, label: 'Lost', color: '#e17055' });
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div>
      {/* Lead Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          ['Enquiry Code', lead.enquiryCode],
          ['Client Company', lead.clientCompanyName],
          ['Client Person', lead.clientPersonName],
          ['Contact', lead.clientNumber],
          ['Email', lead.clientEmail],
          ['Industry', lead.industry],
          ['Product', lead.product],
          ['Size', lead.size],
          ['Location', lead.location],
          ['Lead Source', lead.leadSource],
          ['Lead Owner', lead.leadOwner],
          ['Sales Owner', lead.salesOwner],
          ['Status', lead.status],
          ['SQL Date', fmtDate(lead.sqlDate)],
          ['PO Date', fmtDate(lead.poDate)],
          ['PO Number', lead.poNumber],
          ['PO Value', lead.poValue ? fmt(lead.poValue) : '—'],
          ['Lead Type', lead.leadType],
          ['Quantity', lead.quantity],
          ['Order Number', lead.orderNumber],
        ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
          <div key={label} style={{ fontSize: 13 }}>
            <span style={{ color: '#6c757d' }}>{label}: </span>
            <span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🧭 Lead Journey</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {timeline.map((t, i) => (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#6c757d' }}>{fmtDate(t.date)}</div>
                </div>
                {i < timeline.length - 1 && <div style={{ flex: 1, height: 2, background: '#e9ecef', minWidth: 30 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Remarks */}
      {lead.remarks && (
        <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <strong>Initial Remarks:</strong> {lead.remarks}
        </div>
      )}

      {/* Follow-up Timeline */}
      {[
        { title: 'MQL Follow-ups', items: lead.mqlFollowUps },
        { title: 'SQL Follow-ups', items: lead.sqlFollowUps },
        { title: 'PO Follow-ups', items: lead.poFollowUps },
      ].filter(s => s.items?.length > 0).map(section => (
        <div key={section.title} style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{section.title}</h4>
          {section.items.map((f, i) => (
            <div key={i} style={{ padding: 10, background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
              {f.date && <div style={{ color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>{fmtDate(f.date)}</div>}
              <div>{f.remark}</div>
            </div>
          ))}
        </div>
      ))}

      {/* Activity entries from follow_up_control */}
      {lead.followUpControl?.entries?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Activity Log</h4>
          {lead.followUpControl.entries.slice().reverse().map((e, i) => (
            <div key={i} style={{ padding: 10, background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 12, borderLeft: '3px solid #6c5ce7' }}>
              <div style={{ color: '#6c757d', fontWeight: 600 }}>{fmtDate(e.date)} {e.createdBy ? `— ${e.createdBy}` : ''} {e.type ? `(${e.type})` : ''}</div>
              <div>{e.remark}</div>
              {e.completed && <span style={{ color: '#00b894', fontSize: 11, fontWeight: 600 }}>✓ Completed</span>}
            </div>
          ))}
        </div>
      )}

      {/* Sales Remark Form entries */}
      {remarks?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sales Remarks</h4>
          {remarks.map((r, i) => (
            <div key={i} style={{ padding: 10, background: '#f8f9fa', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
              <div style={{ color: '#6c757d', fontWeight: 600 }}>{r.timestamp ? new Date(r.timestamp).toLocaleString() : ''} — {r.lead_owner} — {r.status}</div>
              {r.follow_up_remark && <div>{r.follow_up_remark}</div>}
              {r.sql_follow_up_remark && <div>{r.sql_follow_up_remark}</div>}
              {r.po_follow_up_remark && <div>{r.po_follow_up_remark}</div>}
              {r.mql_follow_up_remark && <div>{r.mql_follow_up_remark}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Incentives for this lead */}
      {incentives?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💰 Incentives</h4>
          {incentives.map(inc => (
            <div key={inc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#f0f0ff', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{inc.incentiveType === 'SQL' ? 'SQL Incentive' : inc.incentiveType === 'PO_CONVERSION' ? 'PO Conversion' : inc.incentiveType === 'CLOSURE' ? 'PO Closure' : inc.incentiveType}</span>
                <span style={{ color: '#6c757d', marginLeft: 8 }}>({inc.agentName})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, color: '#6c5ce7' }}>{fmt(inc.amount)}</span>
                <span style={{ fontSize: 11, color: inc.adminApproved && inc.ceoApproved ? '#00b894' : '#856404', fontWeight: 600 }}>
                  {inc.status === 'Reversed' ? '❌ Reversed' : inc.adminApproved && inc.ceoApproved ? '✅ Earned' : '⏳ Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── shared styles ── */
const th = { padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#495057', fontSize: 12, whiteSpace: 'nowrap' };
const td = { padding: '12px 14px', fontSize: 13 };
const viewBtn = { background: 'none', border: '1px solid #e9ecef', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#6c5ce7', display: 'flex', alignItems: 'center' };

export default Dashboard;
