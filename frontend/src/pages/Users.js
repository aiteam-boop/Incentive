import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FiShield, FiSave, FiUsers } from 'react-icons/fi';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState({});

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}`, { incentive_role: role || null });
      toast.success('Role updated successfully!');
      setEditingRole({});
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const roleColors = {
    admin: { bg: '#e0cffc', color: '#5a4bd1' },
    prospector: { bg: '#e6fff7', color: '#00b894' },
    sql_closure: { bg: '#e3f2fd', color: '#0984e3' },
  };

  const roleLabels = {
    admin: 'Admin',
    prospector: 'Prospector',
    sql_closure: 'SQL Closure',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>Loading...</div>;

  // Separate users with and without incentive roles
  const assignedUsers = users.filter((u) => u.incentive_role);
  const unassignedUsers = users.filter((u) => !u.incentive_role);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>
          <FiUsers style={{ marginRight: 10, verticalAlign: 'middle' }} />
          User Role Management
        </h1>
        <p style={{ color: '#6c757d', fontSize: 14 }}>
          Manage incentive system access. Users come from the existing Sales Dashboard database.
        </p>
      </div>

      {/* Assigned Users */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          <FiShield style={{ marginRight: 8, color: '#6c5ce7' }} />
          Users with Incentive Roles ({assignedUsers.length})
        </h2>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Name</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Username</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Email</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Sales Role</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Incentive Role</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignedUsers.map((u) => {
                const rc = roleColors[u.incentive_role] || {};
                const editing = editingRole[u._id] !== undefined;
                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{u.agentName || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#6c757d' }}>{u.username}</td>
                    <td style={{ padding: '14px 16px', color: '#6c757d' }}>{u.email}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#f0f0f0', color: '#666' }}>
                        {u.role || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {editing ? (
                        <select
                          value={editingRole[u._id]}
                          onChange={(e) => setEditingRole({ ...editingRole, [u._id]: e.target.value })}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #e9ecef', fontSize: 12 }}
                        >
                          <option value="">No Access</option>
                          <option value="admin">Admin</option>
                          <option value="sql_closure">SQL Closure</option>
                          <option value="prospector">Prospector</option>
                        </select>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: rc.bg || '#f0f0f0', color: rc.color || '#666' }}>
                          {roleLabels[u.incentive_role] || '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {editing ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => handleRoleChange(u._id, editingRole[u._id])}
                            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6c5ce7', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            <FiSave /> Save
                          </button>
                          <button
                            onClick={() => { const next = { ...editingRole }; delete next[u._id]; setEditingRole(next); }}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e9ecef', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingRole({ ...editingRole, [u._id]: u.incentive_role || '' })}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e9ecef', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Edit Role
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unassigned Users */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          Other Users ({unassignedUsers.length})
          <span style={{ fontSize: 13, fontWeight: 400, color: '#6c757d', marginLeft: 8 }}>— No incentive system access</span>
        </h2>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Name</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Username</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>Email</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Sales Role</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>Assign Role</th>
              </tr>
            </thead>
            <tbody>
              {unassignedUsers.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{u.agentName || '—'}</td>
                  <td style={{ padding: '14px 16px', color: '#6c757d' }}>{u.username}</td>
                  <td style={{ padding: '14px 16px', color: '#6c757d' }}>{u.email}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#f0f0f0', color: '#666' }}>
                      {u.role || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleRoleChange(u._id, e.target.value);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #e9ecef', fontSize: 12 }}
                    >
                      <option value="">-- Assign Role --</option>
                      <option value="admin">Admin</option>
                      <option value="sql_closure">SQL Closure</option>
                      <option value="prospector">Prospector</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
