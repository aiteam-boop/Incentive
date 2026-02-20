/**
 * Sales OS Dashboard Card Component Example
 * 
 * This is a ready-to-use component for your Sales OS dashboard.
 * Simply import this component and add it to your dashboard layout.
 * 
 * Requirements:
 * - Your Sales OS must have access to the current logged-in user
 * - You need jsonwebtoken library (npm install jsonwebtoken)
 * - Set environment variable: REACT_APP_INCENTIVE_DASHBOARD_URL
 * - Set environment variable: REACT_APP_SSO_SECRET (or REACT_APP_JWT_SECRET)
 */

import React from 'react';
import jwt from 'jsonwebtoken';

const IncentiveDashboardCard = ({ currentUser }) => {
  // Get configuration from environment variables
  const incentiveDashboardUrl = process.env.REACT_APP_INCENTIVE_DASHBOARD_URL || 'http://localhost:3000';
  const ssoSecret = process.env.REACT_APP_SSO_SECRET || process.env.REACT_APP_JWT_SECRET;

  const handleOpenIncentiveDashboard = () => {
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }

    try {
      // Generate SSO token with user information
      const ssoToken = jwt.sign(
        {
          userId: currentUser._id, // MongoDB ObjectId - REQUIRED
          email: currentUser.email, // Optional fallback
          username: currentUser.username, // Optional fallback
          // Include incentive_role if available in Sales OS user object
          incentive_role: currentUser.incentive_role,
        },
        ssoSecret,
        { expiresIn: '5m' } // Short expiration for security (5 minutes)
      );

      // Redirect to Incentive Dashboard SSO endpoint
      window.location.href = `${incentiveDashboardUrl}/sso-login?token=${ssoToken}`;
    } catch (error) {
      console.error('Error generating SSO token:', error);
      alert('Failed to open Incentive Dashboard. Please contact support.');
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
        borderRadius: 12,
        padding: 20,
        color: '#fff',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 15px rgba(108,92,231,0.3)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      onClick={handleOpenIncentiveDashboard}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,92,231,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 15px rgba(108,92,231,0.3)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 32, marginRight: 12 }}>💰</div>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Incentive Dashboard</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, opacity: 0.9 }}>
            View your SQL, Closure, PO incentives, and quarterly targets
          </p>
        </div>
      </div>
      <button
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.2)',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: 8,
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
        }}
      >
        Open Incentive Dashboard →
      </button>
    </div>
  );
};

export default IncentiveDashboardCard;

/**
 * Usage Example in Sales OS Dashboard:
 * 
 * import IncentiveDashboardCard from './components/IncentiveDashboardCard';
 * import { useAuth } from './context/AuthContext';
 * 
 * function Dashboard() {
 *   const { user } = useAuth();
 *   
 *   return (
 *     <div className="dashboard-grid">
 *       <IncentiveDashboardCard currentUser={user} />
 *       {/* Other dashboard cards */}
 *     </div>
 *   );
 * }
 */


