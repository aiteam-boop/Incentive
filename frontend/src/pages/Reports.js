import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiBarChart2, FiAward, FiTrendingUp, FiFileText } from 'react-icons/fi';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('team');
  const [teamReport, setTeamReport] = useState(null);
  const [bonusReport, setBonusReport] = useState(null);
  const [conversionReport, setConversionReport] = useState(null);
  const [auditReport, setAuditReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => { fetchReports(); }, [monthFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (monthFilter) params.month = monthFilter;

      const [teamRes, bonusRes, convRes, auditRes] = await Promise.all([
        api.get('/reports/team-incentives', { params }),
        api.get('/reports/monthly-bonus', { params }),
        api.get('/reports/lead-conversion'),
        api.get('/reports/incentive-audit', { params: { ...params, limit: 50 } }),
      ]);

      setTeamReport(teamRes.data);
      setBonusReport(bonusRes.data);
      setConversionReport(convRes.data);
      setAuditReport(auditRes.data);
    } catch (err) {
      toast.error('Failed to load reports');
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

  const tabs = [
    { id: 'team', label: 'Team Incentives', icon: <FiBarChart2 /> },
    { id: 'bonus', label: 'Monthly Bonus', icon: <FiAward /> },
    { id: 'conversion', label: 'Lead Conversion', icon: <FiTrendingUp /> },
    { id: 'audit', label: 'Incentive Audit', icon: <FiFileText /> },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading reports...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Reports</h1>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}>
          <option value="">All Time</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === tab.id ? '#6c5ce7' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#6c757d',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Team Incentives Report */}
      {activeTab === 'team' && teamReport && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Team-wise Incentive Report</h2>
          {teamReport.report.length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>No data available</p>
          ) : (
            teamReport.report.map((team) => (
              <div key={team._id} style={{ marginBottom: 24, padding: 20, background: '#f8f9fa', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{team._id?.replace('_', ' ')}</h3>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#6c5ce7' }}>{formatCurrency(team.grandTotal)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {team.incentiveTypes.map((it) => (
                    <div key={it.type} style={{ padding: 16, background: '#fff', borderRadius: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{it.type.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{formatCurrency(it.totalAmount)}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#f9a825' }}>{formatCurrency(it.pendingAmount)}</div>
                          <div style={{ color: '#adb5bd' }}>Pending</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#6c5ce7' }}>{formatCurrency(it.approvedAmount)}</div>
                          <div style={{ color: '#adb5bd' }}>Approved</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#00b894' }}>{formatCurrency(it.paidAmount)}</div>
                          <div style={{ color: '#adb5bd' }}>Paid</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6c757d', marginTop: 8 }}>{it.count} entries</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Monthly Bonus Report */}
      {activeTab === 'bonus' && bonusReport && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Monthly Bonus Report</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, background: '#f0f0ff', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#6c5ce7' }}>{bonusReport.summary.totalSqlMilestones}</div>
              <div style={{ fontSize: 12, color: '#6c757d' }}>SQL Milestones Achieved</div>
            </div>
            <div style={{ padding: 16, background: '#e6fff7', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#00b894' }}>{bonusReport.summary.totalPoMilestones}</div>
              <div style={{ fontSize: 12, color: '#6c757d' }}>PO Milestones Achieved</div>
            </div>
            <div style={{ padding: 16, background: '#fff8e1', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f9a825' }}>{formatCurrency(bonusReport.summary.totalBonusesPaid)}</div>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Total Bonuses Paid</div>
            </div>
          </div>
          {bonusReport.performances.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#6c757d' }}>User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d' }}>Month</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d' }}>SQL Closed</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d' }}>PO Count</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d' }}>SQL Milestone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#6c757d' }}>PO Milestone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#6c757d' }}>Total Bonus</th>
                </tr>
              </thead>
              <tbody>
                {bonusReport.performances.map((p) => (
                  <tr key={p._id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.userId?.agentName || p.userId?.username || 'N/A'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.month}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{p.sqlClosedCount}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{p.poCount}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: p.sqlMilestoneBonusPaid ? '#00b894' : '#adb5bd', fontWeight: 700 }}>
                        {p.sqlMilestoneBonusPaid ? '✓ Achieved' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: p.poMilestoneBonusPaid ? '#00b894' : '#adb5bd', fontWeight: 700 }}>
                        {p.poMilestoneBonusPaid ? '✓ Achieved' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#6c5ce7' }}>{formatCurrency(p.totalBonuses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Lead Conversion Report */}
      {activeTab === 'conversion' && conversionReport && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Lead Stage Conversion Report</h2>
          <p style={{ color: '#6c757d', marginBottom: 20 }}>Total Leads: {conversionReport.totalLeads}</p>

          {/* Stage bars */}
          <div style={{ display: 'grid', gap: 16, marginBottom: 28 }}>
            {conversionReport.stageBreakdown.map((s) => {
              const colors = { Prospect: '#74b9ff', SQL: '#fdcb6e', Closed: '#55efc4', PO_Generated: '#a29bfe', Rejected: '#fab1a0' };
              return (
                <div key={s.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.stage?.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{s.count} ({s.percentage}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 12, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${s.percentage}%`, height: '100%', background: colors[s.stage] || '#adb5bd', borderRadius: 6, transition: 'width 0.5s' }} />
                  </div>
                  {s.totalDealValue > 0 && (
                    <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>
                      Deal Value: {formatCurrency(s.totalDealValue)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incentive Audit Trail */}
      {activeTab === 'audit' && auditReport && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Incentive Audit Trail</h2>

          {/* Summary */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            {auditReport.summary.map((s) => (
              <div key={s._id} style={{
                padding: '12px 20px',
                background: s._id === 'Paid' ? '#e6fff7' : s._id === 'Approved' ? '#f0f0ff' : s._id === 'Reversed' ? '#f8d7da' : '#fff8e1',
                borderRadius: 10,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{formatCurrency(s.totalAmount)}</div>
                <div style={{ fontSize: 12, color: '#6c757d' }}>{s._id} ({s.count})</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6c757d' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6c757d' }}>User</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6c757d' }}>Lead</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6c757d' }}>Type</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6c757d' }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6c757d' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditReport.entries.map((e) => (
                  <tr key={e._id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                    <td style={{ padding: '10px 12px', color: '#6c757d' }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.userId?.agentName || e.userId?.username || 'N/A'}</td>
                    <td style={{ padding: '10px 12px' }}>{e.leadId?.leadName || 'Bonus'}</td>
                    <td style={{ padding: '10px 12px' }}>{e.incentiveType}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(e.amount)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: e.status === 'Paid' ? '#d4edda' : e.status === 'Approved' ? '#e0cffc' : e.status === 'Reversed' ? '#f8d7da' : '#fff3cd',
                        color: e.status === 'Paid' ? '#155724' : e.status === 'Approved' ? '#5a4bd1' : e.status === 'Reversed' ? '#721c24' : '#856404',
                      }}>{e.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

