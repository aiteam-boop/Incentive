import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiUsers, FiTarget, FiDollarSign, FiSettings, FiFileText, FiBarChart2, FiLogOut, FiMenu, FiX, FiShield } from 'react-icons/fi';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.incentive_role;
  const displayName = user?.agentName || user?.username || 'User';

  // Navigation items with role-based visibility
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome />, roles: ['admin', 'prospector', 'sql_closure'] },
    { path: '/leads', label: 'Leads', icon: <FiTarget />, roles: ['admin', 'prospector', 'sql_closure'] },
    { path: '/my-incentives', label: 'My Incentives', icon: <FiDollarSign />, roles: ['admin', 'prospector', 'sql_closure'] },
    // Admin-only pages
    { path: '/team-incentives', label: 'Team Incentives', icon: <FiUsers />, roles: ['admin'] },
    { path: '/reports', label: 'Reports', icon: <FiBarChart2 />, roles: ['admin'] },
    { path: '/users', label: 'Users', icon: <FiShield />, roles: ['admin'] },
    { path: '/settings', label: 'Settings', icon: <FiSettings />, roles: ['admin'] },
    { path: '/audit-logs', label: 'Audit Logs', icon: <FiFileText />, roles: ['admin'] },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  const roleColors = {
    admin: '#6c5ce7',
    prospector: '#00b894',
    sql_closure: '#0984e3',
  };

  const roleLabels = {
    admin: 'Admin',
    prospector: 'Prospector',
    sql_closure: 'SQL Closure',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 260 : 70,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {sidebarOpen && <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>💰 Incentives</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, padding: 4, cursor: 'pointer' }}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                marginBottom: 4,
                borderRadius: 10,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(108,92,231,0.3)' : 'transparent',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {sidebarOpen && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</div>
              <div style={{
                display: 'inline-block',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: roleColors[role] || '#666',
                color: '#fff',
                marginTop: 4,
              }}>
                {roleLabels[role] || role}
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(225,112,85,0.2)',
            border: 'none',
            color: '#e17055',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 14,
            width: '100%',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            cursor: 'pointer',
          }}>
            <FiLogOut />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: sidebarOpen ? 260 : 70,
        transition: 'margin-left 0.3s ease',
        padding: '24px 32px',
        minHeight: '100vh',
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
