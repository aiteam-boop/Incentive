import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FiDollarSign, FiClock, FiCheckCircle, FiTrendingUp, FiAward } from 'react-icons/fi';

const MyIncentives = () => {
  const { user, hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const role = user?.incentive_role;
  const displayName = user?.agentName || user?.username || 'User';

  useEffect(() => { fetchData(); }, [monthFilter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (monthFilter) params.month = monthFilter;
      const [incRes, perfRes] = await Promise.all([
        api.get('/incentives/my', { params }),
        api.get('/incentives/monthly-performance'),
      ]);
      setData(incRes.data);
      setPerformance(perfRes.data.performance);
    } catch (err) {
      toast.error('Failed to load incentives');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amt) => `₹${(amt || 0).toLocaleString('en-IN')}`;

  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>;

  const summary = data?.summary || {};

  const roleLabels = {
    admin: 'Admin',
    prospector: 'Prospector',
    sql_closure: 'SQL Closure',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>My Incentives</h1>
          <p style={{ color: '#6c757d', fontSize: 14 }}>{displayName} • {roleLabels[role] || role}</p>
        </div>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14, cursor: 'pointer' }}
        >
          <option value="">All Time</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { icon: <FiDollarSign />, label: 'Total Earned', value: formatCurrency(summary.totalEarned), bg: '#e6fff7', color: '#00b894' },
          { icon: <FiClock />, label: 'Pending', value: formatCurrency(summary.totalPending), bg: '#fff8e1', color: '#f9a825' },
          { icon: <FiCheckCircle />, label: 'Approved', value: formatCurrency(summary.totalApproved), bg: '#f0f0ff', color: '#6c5ce7' },
          { icon: <FiTrendingUp />, label: 'Paid', value: formatCurrency(summary.totalPaid), bg: '#e3f2fd', color: '#0984e3' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: card.color }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6c757d' }}>{card.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Performance (for sql_closure) */}
      {role === 'sql_closure' && performance.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            <FiAward style={{ marginRight: 8, color: '#fdcb6e' }} />
            Monthly Performance & Milestones
          </h2>
          {performance.map((p) => (
            <div key={p._id} style={{ padding: 16, background: '#f8f9fa', borderRadius: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{p.month}</span>
                <span style={{ fontWeight: 800, color: '#6c5ce7' }}>Bonus: {formatCurrency(p.totalBonuses)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: 10, background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{p.sqlClosedCount}</div>
                  <div style={{ fontSize: 11, color: '#6c757d' }}>SQL Closed</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{p.poCount}</div>
                  <div style={{ fontSize: 11, color: '#6c757d' }}>POs Generated</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: p.sqlMilestoneBonusPaid ? '#e6fff7' : '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.sqlMilestoneBonusPaid ? '#00b894' : '#adb5bd' }}>
                    {p.sqlMilestoneBonusPaid ? '✓ Achieved' : 'Not Yet'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6c757d' }}>SQL Milestone (≥10)</div>
                </div>
                <div style={{ textAlign: 'center', padding: 10, background: p.poMilestoneBonusPaid ? '#e6fff7' : '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.poMilestoneBonusPaid ? '#00b894' : '#adb5bd' }}>
                    {p.poMilestoneBonusPaid ? '✓ Achieved' : 'Not Yet'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6c757d' }}>PO Milestone (≥25)</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prospector: SQL Verification Info */}
      {role === 'prospector' && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            📊 Your SQL Summary
          </h2>
          <p style={{ fontSize: 14, color: '#6c757d' }}>
            You earn ₹300 per verified SQL (max ₹500 cap). 
            Only SQL-type incentives are shown — Closure/PO incentives go to the SQL Closure team.
          </p>
        </div>
      )}

      {/* Incentives List */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Incentive History</h2>
        {(!data?.incentives || data.incentives.length === 0) ? (
          <p style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>No incentives found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontWeight: 600 }}>Lead</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#6c757d', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontWeight: 600 }}>Month</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d', fontWeight: 600 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {data.incentives.map((inc) => (
                  <tr key={inc._id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inc.leadId?.leadName || 'Bonus'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: inc.incentiveType === 'SQL' ? '#e3f2fd' : inc.incentiveType === 'Closure' ? '#e6fff7' : '#fff3cd',
                        color: inc.incentiveType === 'SQL' ? '#0984e3' : inc.incentiveType === 'Closure' ? '#00b894' : '#856404',
                      }}>
                        {inc.incentiveType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inc.amount)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: inc.status === 'Paid' ? '#d4edda' : inc.status === 'Approved' ? '#e0cffc' : inc.status === 'Reversed' ? '#f8d7da' : '#fff3cd',
                        color: inc.status === 'Paid' ? '#155724' : inc.status === 'Approved' ? '#5a4bd1' : inc.status === 'Reversed' ? '#721c24' : '#856404',
                      }}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6c757d' }}>{inc.month}</td>
                    <td style={{ padding: '12px 16px', color: '#6c757d', fontSize: 12 }}>{inc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIncentives;
