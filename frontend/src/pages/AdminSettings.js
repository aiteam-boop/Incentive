import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiSave, FiRefreshCw } from 'react-icons/fi';

const settingLabels = {
  sql_incentive_rate: { label: 'SQL Incentive Rate (₹)', description: 'Amount paid to Prospector per verified SQL', max: 500 },
  sql_incentive_cap: { label: 'SQL Incentive Hard Cap (₹)', description: 'Maximum allowed per SQL (system enforced)', readOnly: true },
  closure_incentive_rate: { label: 'Closure Incentive Rate (₹)', description: 'Amount paid to SQL Closer per PO generated', max: 1000 },
  closure_incentive_cap: { label: 'Closure Incentive Hard Cap (₹)', description: 'Maximum allowed per closure (system enforced)', readOnly: true },
  sql_milestone_threshold: { label: 'SQL Milestone Threshold', description: 'Number of SQLs closed to earn SQL milestone bonus' },
  sql_milestone_bonus: { label: 'SQL Milestone Bonus (₹)', description: 'Bonus amount for reaching SQL milestone' },
  po_milestone_threshold: { label: 'PO Milestone Threshold', description: 'Number of POs generated to earn PO milestone bonus' },
  po_milestone_bonus: { label: 'PO Milestone Bonus (₹)', description: 'Bonus amount for reaching PO milestone' },
};

const AdminSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data.settings);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key) => {
    setSaving({ ...saving, [key]: true });
    try {
      const config = settingLabels[key];
      const value = settings[key]?.value;
      if (config.max && value > config.max) {
        toast.error(`Value cannot exceed ${config.max}`);
        return;
      }
      await api.put('/admin/settings', {
        key,
        value,
        description: config.description,
      });
      toast.success(`${config.label} updated!`);
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const handleChange = (key, value) => {
    setSettings({
      ...settings,
      [key]: { ...settings[key], value: Number(value) },
    });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>Admin Settings</h1>
          <p style={{ color: '#6c757d', fontSize: 14 }}>Configure incentive rates, caps, and bonus thresholds</p>
        </div>
        <button onClick={fetchSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '2px solid #e9ecef', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Incentive Rates */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#6c5ce7' }}>💰 Incentive Rates</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {['sql_incentive_rate', 'sql_incentive_cap', 'closure_incentive_rate', 'closure_incentive_cap'].map((key) => {
              const config = settingLabels[key];
              const setting = settings[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#f8f9fa', borderRadius: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{config.label}</div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>{config.description}</div>
                    {setting?.updatedBy && (
                      <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 4 }}>
                        Last updated by {setting.updatedBy.agentName || setting.updatedBy.username} at {new Date(setting.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      value={setting?.value ?? ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      disabled={config.readOnly}
                      style={{
                        width: 120,
                        padding: '10px 14px',
                        border: '2px solid #e9ecef',
                        borderRadius: 8,
                        fontSize: 16,
                        fontWeight: 700,
                        textAlign: 'right',
                        background: config.readOnly ? '#e9ecef' : '#fff',
                      }}
                    />
                    {!config.readOnly && (
                      <button
                        onClick={() => handleSave(key)}
                        disabled={saving[key]}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#6c5ce7',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <FiSave /> Save
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bonus Thresholds */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#00b894' }}>🏆 Bonus Thresholds</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {['sql_milestone_threshold', 'sql_milestone_bonus', 'po_milestone_threshold', 'po_milestone_bonus'].map((key) => {
              const config = settingLabels[key];
              const setting = settings[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#f8f9fa', borderRadius: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{config.label}</div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>{config.description}</div>
                    {setting?.updatedBy && (
                      <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 4 }}>
                        Last updated by {setting.updatedBy.agentName || setting.updatedBy.username} at {new Date(setting.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      value={setting?.value ?? ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      style={{
                        width: 120,
                        padding: '10px 14px',
                        border: '2px solid #e9ecef',
                        borderRadius: 8,
                        fontSize: 16,
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <button
                      onClick={() => handleSave(key)}
                      disabled={saving[key]}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#00b894',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <FiSave /> Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div style={{ background: '#f0f0ff', borderRadius: 16, padding: 20, border: '1px solid #e0cffc' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#6c5ce7', marginBottom: 8 }}>ℹ️ Important Notes</h3>
          <ul style={{ fontSize: 13, color: '#495057', lineHeight: 2, paddingLeft: 20 }}>
            <li>Hard caps (₹500 for SQL, ₹1000 for Closure) are system-enforced and cannot be overridden</li>
            <li>Incentive rates must not exceed their respective caps</li>
            <li>Changes take effect immediately for new incentive calculations</li>
            <li>Existing incentives are not affected by rate changes</li>
            <li>All changes are logged in the audit trail</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;

