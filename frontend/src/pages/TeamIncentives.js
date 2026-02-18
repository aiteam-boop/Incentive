import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiCheck, FiDollarSign, FiRotateCcw } from 'react-icons/fi';

const TeamIncentives = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  useEffect(() => { fetchData(); }, [monthFilter, teamFilter]);

  const fetchData = async () => {
    try {
      const params = {};
      if (monthFilter) params.month = monthFilter;
      if (teamFilter) params.team = teamFilter;
      const res = await api.get('/incentives/team', { params });
      setData(res.data.teamIncentives);
    } catch (err) {
      toast.error('Failed to load team incentives');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/incentives/${id}/approve`);
      toast.success('Incentive approved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handlePay = async (id) => {
    try {
      await api.put(`/incentives/${id}/pay`);
      toast.success('Incentive marked as paid!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to pay');
    }
  };

  const handleReverse = async (id) => {
    const reason = prompt('Reason for reversal:');
    if (!reason) return;
    try {
      await api.put(`/incentives/${id}/reverse`, { reason });
      toast.success('Incentive reversed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse');
    }
  };

  const formatCurrency = (amt) => `₹${(amt || 0).toLocaleString('en-IN')}`;

  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const roleLabels = {
    admin: 'Admin',
    prospector: 'Prospector',
    sql_closure: 'SQL Closure',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Team Incentives</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}>
            <option value="">All Teams</option>
            <option value="prospector">Prospectors</option>
            <option value="sql_closure">SQL Closure</option>
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e9ecef', fontSize: 14 }}>
            <option value="">All Time</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#6c757d', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          No incentives found for the selected filters.
        </div>
      ) : (
        data.map((team) => (
          <div key={team.user._id} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{team.user.agentName || team.user.username}</h3>
                <span style={{
                  padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: team.user.incentive_role === 'prospector' ? '#e6fff7' : '#e3f2fd',
                  color: team.user.incentive_role === 'prospector' ? '#00b894' : '#0984e3',
                }}>{roleLabels[team.user.incentive_role] || team.user.incentive_role}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#6c757d' }}>Total Active</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#6c5ce7' }}>
                  {formatCurrency(team.totalPending + team.totalApproved + team.totalPaid)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: '#fff8e1', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f9a825' }}>{formatCurrency(team.totalPending)}</div>
                <div style={{ fontSize: 11, color: '#6c757d' }}>Pending</div>
              </div>
              <div style={{ padding: 12, background: '#f0f0ff', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#6c5ce7' }}>{formatCurrency(team.totalApproved)}</div>
                <div style={{ fontSize: 11, color: '#6c757d' }}>Approved</div>
              </div>
              <div style={{ padding: 12, background: '#e6fff7', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#00b894' }}>{formatCurrency(team.totalPaid)}</div>
                <div style={{ fontSize: 11, color: '#6c757d' }}>Paid</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c757d' }}>Lead</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c757d' }}>Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6c757d' }}>Amount</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6c757d' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6c757d' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {team.incentives.map((inc) => (
                    <tr key={inc._id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{inc.leadId?.leadName || 'Bonus'}</td>
                      <td style={{ padding: '10px 12px' }}>{inc.incentiveType.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(inc.amount)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: inc.status === 'Paid' ? '#d4edda' : inc.status === 'Approved' ? '#e0cffc' : inc.status === 'Reversed' ? '#f8d7da' : '#fff3cd',
                          color: inc.status === 'Paid' ? '#155724' : inc.status === 'Approved' ? '#5a4bd1' : inc.status === 'Reversed' ? '#721c24' : '#856404',
                        }}>{inc.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {inc.status === 'Pending' && (
                            <button onClick={() => handleApprove(inc._id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#6c5ce7', color: '#fff', fontSize: 12, cursor: 'pointer' }} title="Approve">
                              <FiCheck />
                            </button>
                          )}
                          {inc.status === 'Approved' && (
                            <button onClick={() => handlePay(inc._id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#00b894', color: '#fff', fontSize: 12, cursor: 'pointer' }} title="Mark Paid">
                              <FiDollarSign />
                            </button>
                          )}
                          {['Pending', 'Approved'].includes(inc.status) && (
                            <button onClick={() => handleReverse(inc._id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#e17055', color: '#fff', fontSize: 12, cursor: 'pointer' }} title="Reverse">
                              <FiRotateCcw />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TeamIncentives;
