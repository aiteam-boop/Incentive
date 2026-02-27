import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiDollarSign, FiClock, FiCheckCircle, FiLogOut, FiRefreshCw, FiX, FiEye, FiCheck, FiUser, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';

/* ───── helpers ───── */
const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const roleLabels = { admin: 'Admin', prospector: 'Prospector', sql_closure: 'SQL Closure' };
const roleColors = { admin: '#6c5ce7', prospector: '#00b894', sql_closure: '#0984e3' };

/* ───── stat card ───── */
const StatCard = ({ icon, label, value, sub, color, bg, onClick }) => (
  <div onClick={onClick} style={{
    background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 150px', minWidth: 150,
    cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s',
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'none')}
  >
    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 11, color: '#6c757d' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#adb5bd' }}>{sub}</div>}
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

/* ── Pending Approvals Section (Admin/CEO) ── */
const PendingApprovalsSection = ({ incentives, leads, incMap, userRole, userName, isCEO, onApproval, onViewDetail }) => {
  // Get pending incentives that need approval
  // For CEO: only show items where admin has approved but CEO hasn't
  // For Admin: show all pending items
  const pendingIncentives = incentives.filter(inc => {
    if (inc.status === 'Reversed') return false;
    if (isCEO) {
      // CEO can only see items where admin approved but CEO hasn't
      return inc.adminApproved && !inc.ceoApproved;
    }
    return !inc.adminApproved || !inc.ceoApproved;
  });

  if (pendingIncentives.length === 0) {
    return (
      <Section title={`🔔 Pending Approvals — ${userName || 'Admin'}`}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>
          <FiCheckCircle size={48} style={{ marginBottom: 12, color: '#00b894' }} />
          <p style={{ fontSize: 14, fontWeight: 600 }}>No pending approvals</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>All incentives have been approved</p>
        </div>
      </Section>
    );
  }

  // Create a map of enquiry codes to leads
  const leadMap = {};
  leads.forEach(l => { leadMap[l.enquiryCode] = l; });

  return (
    <Section title={`🔔 Pending Approvals — ${pendingIncentives.length} ${pendingIncentives.length === 1 ? 'item' : 'items'} (${userName || 'Admin'})`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <th style={th}>Enquiry Code</th>
              <th style={th}>Lead Owner</th>
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
            {pendingIncentives.map(inc => {
              const lead = leadMap[inc.enquiryCode];
              const needsAdminApproval = !inc.adminApproved;
              const needsCeoApproval = !inc.ceoApproved;

              return (
                <tr key={inc._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{inc.enquiryCode}</td>
                  <td style={{ ...td, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiUser size={14} style={{ color: '#6c757d' }} />
                    <span style={{ fontWeight: 600 }}>{inc.agentName}</span>
                  </td>
                  <td style={td}>{inc.clientCompanyName || '—'}</td>
                  <td style={td}>
                    {lead ? (
                      <StatusBadge status={lead.status || '—'} />
                    ) : (
                      <span style={{ color: '#adb5bd' }}>—</span>
                    )}
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
                      ) : onApproval ? (
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
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fff3cd', color: '#856404' }}>
                          <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending
                        </span>
                      )
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                        <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {needsCeoApproval ? (
                      onApproval && (!isCEO || inc.adminApproved) ? (
                        <button
                          onClick={() => onApproval(inc._id, 'ceo', false)}
                          disabled={isCEO && !inc.adminApproved}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none', background: isCEO && !inc.adminApproved ? '#adb5bd' : '#00b894',
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
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                        <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
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
                    </div>
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

/* ═══════ MAIN DASHBOARD ═══════ */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [detailLead, setDetailLead] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Quarter selection state (lock year to 2026 for now)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const month = new Date().getMonth();
    if (month >= 0 && month <= 2) return 'Q1';
    if (month >= 3 && month <= 5) return 'Q2';
    if (month >= 6 && month <= 8) return 'Q3';
    return 'Q4';
  });
  const [selectedMonth, setSelectedMonth] = useState(''); // '' means no specific month (all quarter)
  const [quarterlyData, setQuarterlyData] = useState(null);
  const [quarterlyLoading, setQuarterlyLoading] = useState(false);
  // Full Calculator State
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState(null);
  const [calcOp, setCalcOp] = useState(null);
  const [calcWait, setCalcWait] = useState(false);

  const computeCalc = (a, b, op) => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return b;
  };

  const handleCalcClick = (val) => {
    if (val === 'AC') {
      setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); setCalcWait(false); return;
    }
    if (val === '+/-') {
      setCalcDisplay(String(parseFloat(calcDisplay) * -1)); return;
    }
    if (val === '%') {
      setCalcDisplay(String(parseFloat(calcDisplay) / 100)); return;
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      if (calcOp && !calcWait && calcPrev !== null) {
        const computed = computeCalc(calcPrev, parseFloat(calcDisplay), calcOp);
        setCalcDisplay(String(computed));
        setCalcPrev(computed);
      } else {
        setCalcPrev(parseFloat(calcDisplay));
      }
      setCalcOp(val);
      setCalcWait(true);
      return;
    }
    if (val === '=') {
      if (calcOp && calcPrev !== null) {
        const computed = computeCalc(calcPrev, parseFloat(calcDisplay), calcOp);
        setCalcDisplay(String(computed));
        setCalcPrev(null);
        setCalcOp(null);
        setCalcWait(true);
      }
      return;
    }
    if (calcWait) {
      setCalcDisplay(val === '.' ? '0.' : val);
      setCalcWait(false);
    } else {
      setCalcDisplay(calcDisplay === '0' && val !== '.' ? val : calcDisplay + val);
    }
  };

  const quarterMonths = {
    Q1: ['Jan', 'Feb', 'Mar'],
    Q2: ['Apr', 'May', 'Jun'],
    Q3: ['Jul', 'Aug', 'Sep'],
    Q4: ['Oct', 'Nov', 'Dec']
  };

  // User switching for Admin/CEO
  const [selectedViewUser, setSelectedViewUser] = useState(null); // null = own dashboard
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const role = user?.incentive_role;
  const isAdmin = role === 'admin';
  const currentAgentName = (user?.agentName || '').trim();
  const isCEO = currentAgentName.toLowerCase().includes('ceo');
  const isPushpalata = currentAgentName.toLowerCase() === 'pushpalata';
  // Treat CEO specially by name: CEO should not see their own incentives
  const isCeo = isCEO;

  // Check if user should see dropdown (Admin, CEO, or Pushpalata)
  const shouldShowDropdown = isAdmin || isCEO || isPushpalata;

  // Get the viewed user's info (if viewing another user's dashboard)
  const viewedUser = quarterlyData?.viewAsUser;
  const viewedRole = viewedUser?.incentive_role || role;
  const viewedAgentName = viewedUser?.agentName || currentAgentName;
  const viewedIsCEO = (viewedAgentName || '').toLowerCase().includes('ceo');

  // SQL Closure team members (by agentName) - even if they have admin role
  // These users should only see PO closure incentives, not SQL incentives
  const SQL_CLOSURE_TEAM = ['Pushpalata', 'pushpalata', 'Anjali', 'anjali', 'Gauri', 'gauri', 'Amisha', 'amisha'];
  const isSQLClosureTeamMember = SQL_CLOSURE_TEAM.includes(user?.agentName);
  const shouldTreatAsSQLClosure = isSQLClosureTeamMember || role === 'sql_closure';

  // For viewed user
  const viewedIsSQLClosureTeamMember = SQL_CLOSURE_TEAM.includes(viewedAgentName);
  const viewedShouldTreatAsSQLClosure = viewedIsSQLClosureTeamMember || viewedRole === 'sql_closure';

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

  // Fetch users list for admin dropdown
  // Only show: Anjali, Amisha, Gauri, Pushpalata, CEO, and Sapna
  const ALLOWED_DROPDOWN_USERS = ['Anjali', 'Amisha', 'Gauri', 'Pushpalata', 'CEO', 'Sapna'];

  const fetchUsers = useCallback(async () => {
    if (!shouldShowDropdown) return;

    setLoadingUsers(true);
    try {
      // Fetch all users with incentive roles
      const res = await api.get('/auth/users');
      const allUsers = res.data.users || [];

      // Filter to only allowed users
      let filteredUsers = allUsers.filter(u => {
        const agentName = (u.agentName || '').trim();
        return ALLOWED_DROPDOWN_USERS.some(name =>
          agentName.toLowerCase() === name.toLowerCase()
        );
      });

      // If Pushpalata is logged in, exclude CEO from the list
      if (isPushpalata) {
        filteredUsers = filteredUsers.filter(u =>
          !(u.agentName || '').toLowerCase().includes('ceo')
        );
      }

      // Also exclude the current user from the dropdown (they can use "My Dashboard")
      filteredUsers = filteredUsers.filter(u => {
        const uName = (u.agentName || '').trim().toLowerCase();
        const currentName = currentAgentName.toLowerCase();
        return uName !== currentName;
      });

      // Sort users in the order: Anjali, Amisha, Gauri, Pushpalata, CEO, Sapna
      const sortOrder = ['Anjali', 'Amisha', 'Gauri', 'Pushpalata', 'CEO', 'Sapna'];
      filteredUsers.sort((a, b) => {
        const aName = (a.agentName || '').trim();
        const bName = (b.agentName || '').trim();
        const aIndex = sortOrder.findIndex(name => aName.toLowerCase() === name.toLowerCase());
        const bIndex = sortOrder.findIndex(name => bName.toLowerCase() === name.toLowerCase());
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

      setUsersList(filteredUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load users list');
    } finally {
      setLoadingUsers(false);
    }
  }, [shouldShowDropdown, isPushpalata, currentAgentName]);

  const fetchQuarterlyData = useCallback(async (quarter, viewAsUserId = null, month = '') => {
    if (!quarter) return;
    setQuarterlyLoading(true);
    try {
      let url = `/incentives/dashboard?quarter=${quarter}`;
      if (viewAsUserId) {
        url += `&viewAs=${viewAsUserId}`;
      }
      if (month) {
        url += `&month=${month}`;
      }
      const res = await api.get(url);
      setQuarterlyData(res.data);
    } catch (err) {
      toast.error('Failed to load quarterly data');
      setQuarterlyData(null);
    } finally {
      setQuarterlyLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (shouldShowDropdown) {
      fetchUsers();
    }
  }, [shouldShowDropdown, fetchUsers]);

  useEffect(() => {
    const quarter = `${selectedYear}-${selectedQuarter}`;
    // If viewing CEO's own dashboard (or no selection), don't pass viewAs
    const viewAsId = (selectedViewUser && (selectedViewUser.agentName || '').toLowerCase().includes('ceo'))
      ? null
      : (selectedViewUser?._id || selectedViewUser?.agentName || null);
    fetchQuarterlyData(quarter, viewAsId, selectedMonth);
  }, [selectedYear, selectedQuarter, selectedViewUser, selectedMonth, fetchQuarterlyData]);

  // Reset month when quarter changes
  useEffect(() => {
    setSelectedMonth('');
  }, [selectedQuarter, selectedYear]);

  // Handle user selection change
  const handleUserChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setSelectedViewUser(null);
    } else {
      // Try to find by _id first, then by agentName
      const selectedUser = usersList.find(u =>
        u._id === value ||
        u._id?.toString() === value ||
        u.agentName === value ||
        (u.agentName || '').toLowerCase() === value.toLowerCase()
      );
      setSelectedViewUser(selectedUser || null);
    }
  };

  /* sync incentives (admin only) */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/dashboard/sync-incentives');
      toast.success(res.data.message);
      fetchData();
      // Refresh quarterly data
      const quarter = `${selectedYear}-${selectedQuarter}`;
      const viewAsId = (selectedViewUser && (selectedViewUser.agentName || '').toLowerCase().includes('ceo'))
        ? null
        : (selectedViewUser?._id || selectedViewUser?.agentName || null);
      fetchQuarterlyData(quarter, viewAsId);
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
      // Refresh quarterly data
      const quarter = `${selectedYear}-${selectedQuarter}`;
      const viewAsId = (selectedViewUser && (selectedViewUser.agentName || '').toLowerCase().includes('ceo'))
        ? null
        : (selectedViewUser?._id || selectedViewUser?.agentName || null);
      fetchQuarterlyData(quarter, viewAsId);
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

  // Use quarterly data if available, otherwise fall back to all-time data
  const { leads: allTimeLeads, incentives: allTimeIncentives, summary: allTimeSummary } = data;

  // Use quarterly filtered data for tables and metrics
  const leads = quarterlyData ? (
    role === 'sql_closure' ? (quarterlyData.sql_leads || []) :
      role === 'prospector' ? (quarterlyData.prospector_leads || []) :
        (quarterlyData.po_incentives?.map(inc => inc.lead).filter(Boolean) || [])
  ) : allTimeLeads;

  const incentives = quarterlyData ? (
    quarterlyData.po_incentives || quarterlyData.prospector_incentives || []
  ) : allTimeIncentives;

  const summary = quarterlyData ? {
    totalEarned: quarterlyData.earned || 0,
    totalPending: quarterlyData.pending || 0,
    totalEntries: quarterlyData.total_entries || 0,
  } : allTimeSummary;

  /* group incentives by enquiryCode for quick lookup */
  const incMap = {};
  (quarterlyData?.po_incentives || quarterlyData?.prospector_incentives || incentives || []).forEach(inc => {
    if (!incMap[inc.enquiryCode]) incMap[inc.enquiryCode] = [];
    incMap[inc.enquiryCode].push(inc);
  });

  /* earnings breakdown data - use quarterly data if available */
  const earningsBreakdown = {};
  const breakdownIncentives = quarterlyData?.po_incentives || incentives || [];
  breakdownIncentives.filter(i => i.status !== 'Reversed' && i.adminApproved && i.ceoApproved).forEach(i => {
    if (!earningsBreakdown[i.enquiryCode]) earningsBreakdown[i.enquiryCode] = { company: i.clientCompanyName, items: [], total: 0 };
    earningsBreakdown[i.enquiryCode].items.push(i);
    earningsBreakdown[i.enquiryCode].total += i.amount;
  });

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#f5f6fa', display: 'flex', flexDirection: 'column' }}>
      {/* ── header ── */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>💰</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Incentive Dashboard</h1>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {quarterlyData?.viewAsUser ? (
                <>
                  Viewing: <span style={{ fontWeight: 700 }}>{quarterlyData.viewAsUser.agentName}</span> • {roleLabels[quarterlyData.viewAsUser.incentive_role] || 'User'}
                </>
              ) : (
                <>
                  {user?.agentName} • <span style={{ color: roleColors[role], fontWeight: 600 }}>{roleLabels[role]}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* User Dropdown for Admin/CEO/Pushpalata */}
          {shouldShowDropdown && usersList.length > 0 && (
            <select
              value={selectedViewUser ? (selectedViewUser._id || selectedViewUser.agentName) : ''}
              onChange={handleUserChange}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.95)',
                color: '#1a1a2e',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: 140,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <option value="" style={{ color: '#1a1a2e', background: '#fff' }}>My Dashboard</option>
              {usersList.map((u) => (
                <option key={u._id || u.agentName} value={u._id || u.agentName} style={{ color: '#1a1a2e', background: '#fff' }}>
                  {u.agentName}
                </option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <FiRefreshCw className={syncing ? 'spin' : ''} size={14} /> {syncing ? 'Syncing...' : 'Sync'}
            </button>
          )}
          <button onClick={() => { logout(); window.location.href = '/login'; }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(225,112,85,0.2)', color: '#e17055', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <FiLogOut size={14} /> Logout
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
        {/* ── Quarter Selection Dropdown ── */}
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '10px 16px',
          marginBottom: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>Select Quarter:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #e9ecef',
              fontSize: 12,
              fontWeight: 600,
              color: '#1a1a2e',
              cursor: 'pointer',
              background: '#fff',
              minWidth: 80,
            }}
          >
            {/* For now we only allow 2026 */}
            <option value={2026}>2026</option>
          </select>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #e9ecef',
              fontSize: 12,
              fontWeight: 600,
              color: '#1a1a2e',
              cursor: 'pointer',
              background: '#fff',
              minWidth: 120,
            }}
          >
            <option value="Q1">Jan – Mar (Q1)</option>
            <option value="Q2">Apr – Jun (Q2)</option>
            <option value="Q3">Jul – Sep (Q3)</option>
            <option value="Q4">Oct – Dec (Q4)</option>
          </select>
          {quarterlyLoading && (
            <span style={{ fontSize: 11, color: '#6c757d' }}>Loading...</span>
          )}
        </div>

        {/* ── 2-COLUMN MASTER GRID ── */}
        <div style={{ display: 'flex', flex: 1, gap: 24, overflow: 'hidden', flexWrap: 'wrap' }}>

          {/* 🔹 LEFT COLUMN — DASHBOARD (Block A) */}
          <div style={{ flex: '1 1 60%', minWidth: 600, overflowY: 'auto', paddingRight: 4, paddingBottom: 20 }}>
            {/* ── Dashboard Content ── */}
            {quarterlyData && !viewedIsCEO && (
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: '20px',
                marginBottom: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                border: '1px solid #f1f3f5'
              }}>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px 0' }}>SALES INCENTIVE DASHBOARD</h2>
                  <p style={{ fontSize: 12, color: '#6c757d', margin: 0, fontWeight: 600 }}>
                    Performance Snapshot — {selectedYear} {selectedQuarter === 'Q1' ? 'Jan–Mar' : selectedQuarter === 'Q2' ? 'Apr–Jun' : selectedQuarter === 'Q3' ? 'Jul–Sep' : 'Oct–Dec'}
                  </p>
                </div>

                {/* ── Top Summary Cards (Stylized for light theme) ── */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #ff7675, #d63031)', borderRadius: 10, padding: '12px 16px', flex: '1 1 160px', minWidth: 140, boxShadow: '0 4px 12px rgba(214, 48, 49, 0.2)', color: '#fff'
                  }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: 4 }}>Current Earned</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(quarterlyData.earned)}</div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #55efc4, #00b894)', borderRadius: 10, padding: '12px 16px', flex: '1 1 160px', minWidth: 140, boxShadow: '0 4px 12px rgba(0, 184, 148, 0.2)', color: '#fff'
                  }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: 4 }}>Total Potential</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {quarterlyData.target_potential > 0 ? fmt(quarterlyData.target_potential) : '₹0'}
                    </div>
                  </div>
                </div>

                {/* ── 3-Column Layout ── */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                  {/* 🟦 LEFT COLUMN - Monthly Earned Cards */}
                  <div style={{ flex: '1 1 210px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, paddingLeft: 2 }}>Monthly Performance</div>
                    {(quarterMonths[selectedQuarter] || []).map(m => {
                      const isSelected = selectedMonth === m;
                      const earned = quarterlyData.monthly_breakdown?.[m] || 0;
                      const monthlyTarget = quarterlyData.target_potential > 0 ? quarterlyData.target_potential / 3 : 0;
                      let completion = monthlyTarget > 0 ? (earned / monthlyTarget) * 100 : 0;
                      if (completion > 100) completion = 100;

                      const bgStyle = earned > 0
                        ? `linear-gradient(90deg, rgba(0, 184, 148, 0.15) ${completion}%, #f8f9fa ${completion}%)`
                        : '#f8f9fa';

                      return (
                        <div key={m} onClick={() => setSelectedMonth(isSelected ? '' : m)} style={{
                          background: bgStyle,
                          borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s',
                          border: isSelected ? '2px solid #00b894' : '1px solid #e9ecef',
                          boxShadow: isSelected ? '0 0 0 4px rgba(0, 184, 148, 0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                          position: 'relative', overflow: 'hidden'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>
                              {m} {selectedYear}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: earned > 0 ? '#00b894' : '#adb5bd' }}>
                              {completion.toFixed(0)}% Achieved
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600 }}>Earned</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: earned > 0 ? '#1a1a2e' : '#6c757d' }}>
                                {fmt(earned)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: '#6c757d', fontWeight: 600 }}>Potential</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#495057' }}>
                                {monthlyTarget > 0 ? fmt(monthlyTarget) : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 🟨 CENTER COLUMN - Styled like attached Image */}
                  <div style={{ flex: '1 1 340px', background: '#212338', borderRadius: 16, padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'stretch', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                    {/* Left side text logic */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>Target Breakdown:</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8', marginBottom: 16 }}>
                        PO Target: 20 × ₹1,000 = <span style={{ color: '#ffffff', fontWeight: 800 }}>₹20,000</span>
                      </div>
                      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}></div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 30 }}>
                        Total Potential: ₹20,000
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>
                        This is not a market problem.
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>
                        This is an EXECUTION opportunity.
                      </div>
                    </div>

                    {/* Right side physical calculator UI */}
                    <div style={{ width: 170, background: '#27293d', borderRadius: 12, padding: 12, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05), 0 8px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ background: '#aab8b1', borderRadius: 6, padding: '8px 10px', textAlign: 'right', fontSize: 22, fontWeight: 400, color: '#1a1a2e', fontFamily: 'monospace', letterSpacing: 1, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {calcDisplay.length > 10 ? parseFloat(calcDisplay).toExponential(4) : calcDisplay}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, flex: 1 }}>
                        {['AC', '+/-', '%', '÷',
                          '7', '8', '9', '×',
                          '4', '5', '6', '-',
                          '1', '2', '3', '+',
                          '0', '.', '='
                        ].map((btn) => (
                          <button
                            key={btn}
                            onClick={() => handleCalcClick(btn)}
                            style={{
                              gridColumn: btn === '=' ? 'span 2' : 'span 1',
                              background: btn === 'AC' ? '#f97316' : '#363a50',
                              border: 'none',
                              borderRadius: 6,
                              color: '#ffffff',
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 0 rgba(0,0,0,0.2)'
                            }}
                          >
                            {btn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 🟪 RIGHT COLUMN - Summary Cards & Insights */}
                  <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, paddingLeft: 2 }}>Summary & Insights</div>

                    {/* Option B / C: Monthly Insight / Action Reminder */}
                    {(() => {
                      const breakdown = quarterlyData.monthly_breakdown || {};
                      const bestMonth = Object.keys(breakdown).reduce((a, b) => breakdown[a] > breakdown[b] ? a : b, '');
                      const bestEarned = breakdown[bestMonth] || 0;
                      const pendingCount = summary.totalPending || 0;

                      if (bestEarned > 0 && pendingCount === 0) {
                        return (
                          <div style={{ background: '#e6fff7', borderRadius: 12, padding: '14px', border: '1px solid rgba(0, 184, 148, 0.2)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#00b894', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginTop: 2 }}>
                              <FiTrendingUp size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: '#00b894', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Performance</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', marginTop: 3 }}>{bestMonth} 2026</div>
                              <div style={{ fontSize: 11, color: '#495057', fontWeight: 700, marginTop: 2 }}>Highest Earnings: {fmt(bestEarned)}</div>
                            </div>
                          </div>
                        );
                      }

                      // Action Reminder
                      return (
                        <div style={{ background: pendingCount > 0 ? '#fff8e1' : '#f8f9fa', borderRadius: 12, padding: '14px', border: `1px solid ${pendingCount > 0 ? 'rgba(253, 203, 110, 0.3)' : '#e9ecef'}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: pendingCount > 0 ? '#fdcb6e' : '#adb5bd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginTop: 2 }}>
                            {pendingCount > 0 ? <FiClock size={16} /> : <FiCheckCircle size={16} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: pendingCount > 0 ? '#b38200' : '#6c757d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{pendingCount > 0 ? 'Action Required' : 'All Caught Up'}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', marginTop: 3 }}>{pendingCount} Pending</div>
                            <div style={{ fontSize: 11, color: '#495057', fontWeight: 700, marginTop: 2 }}>{pendingCount > 0 ? 'Follow up on approvals' : 'Looking good'}</div>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e6fff7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b894' }}><FiDollarSign size={20} /></div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>Total Earned</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#1a1a2e' }}>{fmt(summary.totalEarned)}</div>
                        <div style={{ fontSize: 10, color: '#adb5bd', fontWeight: 600 }}>{selectedYear} {selectedQuarter} {selectedMonth && `- ${selectedMonth}`}</div>
                      </div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff8e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fdcb6e' }}><FiClock size={20} /></div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>Pending Approval</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#1a1a2e' }}>{fmt(summary.totalPending)}</div>
                        <div style={{ fontSize: 10, color: '#adb5bd', fontWeight: 600 }}>{selectedYear} {selectedQuarter} {selectedMonth && `- ${selectedMonth}`}</div>
                      </div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c5ce7' }}><FiCheckCircle size={20} /></div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>Total Entries</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#1a1a2e' }}>{summary.totalEntries}</div>
                        <div style={{ fontSize: 10, color: '#adb5bd', fontWeight: 600 }}>{selectedYear} {selectedQuarter} {selectedMonth && `- ${selectedMonth}`}</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* 🔹 RIGHT COLUMN — PO INCENTIVE TABLE (Block B) */}
          <div style={{ flex: '1 1 35%', minWidth: 400, overflowY: 'auto', paddingRight: 8, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Admin personal PO incentives (her own closures) — only show when viewing own dashboard ── */}
            {isAdmin && !isCEO && !viewedUser && (
              <Section title={`📋 Your PO Incentives (₹1,000 per PO) — ${selectedYear} ${selectedQuarter}`}>
                <IncentiveTable
                  // For admin, show only her own PO incentives from the quarterly data
                  leads={null}
                  incentives={(quarterlyData?.po_incentives || []).filter(
                    inc => {
                      const incAgentName = (inc.agentName || '').trim().toLowerCase();
                      const userAgentName = (user?.agentName || '').trim().toLowerCase();
                      return incAgentName === userAgentName;
                    }
                  )}
                  incMap={incMap}
                  type="CLOSURE"
                  isAdmin={false}       // read-only; approvals for others are in the admin sections below
                  role={role}
                  onApproval={null}
                  onViewDetail={openDetail}
                  showOwner={false}
                />
              </Section>
            )}

            {/* ── Admin approvals: SQL Closure team PO incentives — only show for Admin (Pushpalata), not CEO ── */}
            {/* CEO sees all data in the "SQL Closure Team — PO Incentives" section below */}
            {isAdmin && !isCEO && !viewedUser && (
              <Section title={`🔵 SQL Closure Team — Pending PO Approvals — ${selectedYear} ${selectedQuarter}`}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                        <th style={th}>Enquiry Code</th>
                        <th style={th}>Owner</th>
                        <th style={th}>Client Company</th>
                        <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...th, textAlign: 'center' }}>Admin</th>
                        <th style={{ ...th, textAlign: 'center' }}>CEO</th>
                        <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quarterlyData?.pending_approvals || incentives)
                        .filter(inc => {
                          if (inc.status === 'Reversed') return false;
                          const team = ['Gauri', 'gauri', 'Anjali', 'anjali', 'Amisha', 'amisha'];
                          return inc.incentiveType === 'CLOSURE' && team.includes(inc.agentName);
                        })
                        .map(inc => (
                          <tr key={inc._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{inc.enquiryCode}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{inc.agentName}</td>
                            <td style={td}>{inc.clientCompanyName || '—'}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#00b894' }}>{fmt(inc.amount)}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button
                                onClick={() => handleApproval(inc._id, 'admin', inc.adminApproved)}
                                style={{
                                  padding: '6px 12px', borderRadius: 8, border: 'none',
                                  background: inc.adminApproved ? '#d4edda' : '#6c5ce7',
                                  color: inc.adminApproved ? '#155724' : '#fff',
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}
                                title={inc.adminApproved ? 'Revoke Admin approval' : 'Approve as Admin'}
                              >
                                <FiCheck size={12} /> {inc.adminApproved ? 'Approved' : 'Approve'}
                              </button>
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {isCEO ? (
                                // CEO can approve/reject CEO approvals
                                <button
                                  onClick={() => handleApproval(inc._id, 'ceo', inc.ceoApproved)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 8, border: 'none',
                                    background: inc.ceoApproved ? '#d4edda' : '#fdcb6e',
                                    color: inc.ceoApproved ? '#155724' : '#856404',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                  }}
                                  title={inc.ceoApproved ? 'Revoke CEO approval' : 'Approve as CEO'}
                                >
                                  <FiCheck size={12} /> {inc.ceoApproved ? 'Approved' : 'Approve'}
                                </button>
                              ) : (
                                // Admin sees CEO approval status (read-only)
                                <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: inc.ceoApproved ? '#d4edda' : '#fff3cd', color: inc.ceoApproved ? '#155724' : '#856404' }}>
                                  {inc.ceoApproved ? (
                                    <>
                                      <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                                    </>
                                  ) : (
                                    <>
                                      <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending CEO
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button
                                onClick={() => openDetail(inc.enquiryCode)}
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
                        ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* ── Admin approvals: Prospector team SQL & PO Conversion — only show when viewing own dashboard ── */}
            {isAdmin && !isCEO && !viewedUser && (
              <Section title={`🟢 Prospector Team — Pending SQL & PO Conversion — ${selectedYear} ${selectedQuarter}`}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                        <th style={th}>Enquiry Code</th>
                        <th style={th}>Prospector</th>
                        <th style={th}>Client Company</th>
                        <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...th, textAlign: 'center' }}>Type</th>
                        <th style={{ ...th, textAlign: 'center' }}>Admin</th>
                        <th style={{ ...th, textAlign: 'center' }}>CEO</th>
                        <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quarterlyData?.pending_approvals || incentives)
                        .filter(inc => {
                          if (inc.status === 'Reversed') return false;
                          const team = ['Aparna', 'aparna', 'Sapna', 'sapna'];
                          return (inc.incentiveType === 'SQL' || inc.incentiveType === 'PO_CONVERSION') && team.includes(inc.agentName);
                        })
                        .map(inc => (
                          <tr key={inc._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{inc.enquiryCode}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{inc.agentName}</td>
                            <td style={td}>{inc.clientCompanyName || '—'}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#00b894' }}>{fmt(inc.amount)}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                background: inc.incentiveType === 'SQL' ? '#e3f2fd' : '#fff3e0',
                                color: inc.incentiveType === 'SQL' ? '#0984e3' : '#f9a825',
                              }}>
                                {inc.incentiveType === 'SQL' ? 'SQL' : 'PO Conv.'}
                              </span>
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {inc.adminApproved ? (
                                <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                                  <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleApproval(inc._id, 'admin', false)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6c5ce7',
                                    color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                  }}
                                  title="Approve as Admin"
                                >
                                  <FiCheck size={12} /> Approve
                                </button>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              {inc.ceoApproved ? (
                                <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#d4edda', color: '#155724' }}>
                                  <FiCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Approved
                                </span>
                              ) : (
                                <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fff3cd', color: '#856404' }}>
                                  <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pending CEO
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <button
                                onClick={() => openDetail(inc.enquiryCode)}
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
                        ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* ── SQL Closure View ── */}
            {/* For SQL Closure role: show only their own PO incentives
            For Admin viewing another user: show that user's PO incentives
            For Admin viewing own dashboard: hide (already shown in admin personal section above)
            For CEO: show SQL Closure team PO incentives */}
            {((viewedRole === 'sql_closure') || (viewedRole === 'admin' && viewedUser) || (isCEO && !viewedUser)) && (
              <Section title={(isCEO && !viewedUser) ? `🔵 SQL Closure Team — PO Incentives (₹1,000/PO) — ${selectedYear} ${selectedQuarter}` : `📋 Your PO Incentives (₹1,000 per PO) — ${selectedYear} ${selectedQuarter}`}>
                <IncentiveTable
                  leads={quarterlyData?.po_incentives ? null : leads.filter(l => l.poDate)}
                  incentives={quarterlyData?.po_incentives || null}
                  incMap={incMap}
                  type="CLOSURE"
                  isAdmin={isAdmin}
                  role={viewedRole}
                  onApproval={handleApproval}
                  onViewDetail={openDetail}
                  showOwner={isCeo}
                />
              </Section>
            )}


            {/* ── Prospector View ── */}
            {/* For Prospector role: show only their own SQL/PO Conversion incentives
            For Admin (Pushpalata): show Prospector team incentives if not SQL Closure team member
            For CEO: hide this section (CEO sees SQL Closure approvals instead) */}
            {(viewedRole === 'prospector' || (viewedRole === 'admin' && !viewedIsSQLClosureTeamMember && !isCEO)) && (
              <Section title={viewedIsCEO ? `🟢 Prospector Team — SQL & PO Conversion Incentives — ${selectedYear} ${selectedQuarter}` : `📋 Your SQL Incentives — ${selectedYear} ${selectedQuarter}`}>
                <ProspectorTable
                  leads={quarterlyData?.prospector_leads || leads.filter(l => l.sqlDate)}
                  incentives={quarterlyData?.prospector_leads || null}
                  incMap={incMap}
                  isAdmin={isAdmin}
                  role={role}
                  onApproval={handleApproval}
                  onViewDetail={openDetail}
                  showOwner={isCeo}
                />
              </Section>
            )}

          </div>
        </div>
      </div>

      {/* ── Earnings Breakdown Modal ── */}
      {showBreakdown && (
        <Modal title={`💰 Total Earnings Breakdown — ${selectedYear} ${selectedQuarter}`} onClose={() => setShowBreakdown(false)}>
          {Object.keys(earningsBreakdown).length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>No approved earnings for this quarter yet.</p>
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
                <span style={{ fontWeight: 800, fontSize: 16 }}>Grand Total ({selectedYear} {selectedQuarter})</span>
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
  <div style={{ marginBottom: 12 }}>
    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>{title}</h2>
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>{children}</div>
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
const IncentiveTable = ({ leads, incentives, incMap, type, isAdmin, onApproval, onViewDetail, showOwner }) => {
  // If incentives array is provided (from quarterly data), use it directly
  // Check if we have incentives first, then check leads
  if (incentives && Array.isArray(incentives) && incentives.length > 0) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
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
            {incentives.map(inc => {
              const lead = inc.lead || {};
              return (
                <tr key={inc._id || inc.enquiryCode} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#6c5ce7' }}>{inc.enquiryCode}</td>
                  <td style={td}>{inc.clientCompanyName || lead.clientCompanyName || '—'}</td>
                  {showOwner && <td style={{ ...td, color: '#6c757d' }}>{lead.salesOwner || lead.leadOwner || inc.agentName || '—'}</td>}
                  <td style={{ ...td, textAlign: 'center' }}>{fmtDate(lead.poDate || inc.incentive_date)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{lead.poValue ? fmt(lead.poValue) : '—'}</td>
                  <td style={{ ...td, color: '#6c757d', fontSize: 12 }}>{lead.poNumber || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#00b894' }}>{fmt(inc.amount)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <ApprovalBadge approved={inc.adminApproved} label="Admin" canClick={isAdmin} onClick={() => onApproval(inc._id, 'admin', inc.adminApproved)} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <ApprovalBadge approved={inc.ceoApproved} label="CEO" canClick={isAdmin} onClick={() => onApproval(inc._id, 'ceo', inc.ceoApproved)} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <StatusBadge status={inc.adminApproved && inc.ceoApproved ? 'Earned' : 'Pending'} />
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => onViewDetail(inc.enquiryCode)} style={viewBtn}><FiEye size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback to original leads-based rendering
  // If we have incentives array but it's empty, show message
  if (incentives && Array.isArray(incentives) && incentives.length === 0) {
    return <p style={{ color: '#6c757d', textAlign: 'center', padding: 24 }}>No PO incentives found for this quarter.</p>;
  }
  if (!leads || !leads.length) return <p style={{ color: '#6c757d', textAlign: 'center', padding: 24 }}>No PO leads found for this quarter.</p>;
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
          {leads.map((lead, idx) => {
            const incs = (incMap[lead.enquiryCode] || []).filter(i => i.incentiveType === type && i.status !== 'Reversed');
            const inc = incs[0];
            return (
              <tr key={`${lead.enquiryCode}-${idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
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
                  {sqlInc ? <ApprovalBadge approved={sqlInc.adminApproved} label="Admin" canClick={false} onClick={null} /> : '—'}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {sqlInc ? <ApprovalBadge approved={sqlInc.ceoApproved} label="CEO" canClick={false} onClick={null} /> : '—'}
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
                  {poInc ? <ApprovalBadge approved={poInc.adminApproved} label="Admin" canClick={false} onClick={null} /> : ''}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {poInc ? <ApprovalBadge approved={poInc.ceoApproved} label="CEO" canClick={false} onClick={null} /> : ''}
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
const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#495057', fontSize: 11, whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 12 };
const viewBtn = { background: 'none', border: '1px solid #e9ecef', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#6c5ce7', display: 'flex', alignItems: 'center' };

export default Dashboard;
