# Sales OS Dashboard Integration Guide

This guide explains how to integrate the Incentive Dashboard with your Sales OS dashboard using Single Sign-On (SSO).

## 🎯 Overview

Users logged into Sales OS can click a card on the dashboard to automatically access the Incentive Dashboard without needing to log in again.

## 📋 Prerequisites

1. Both systems must share the same JWT secret OR configure a separate `SSO_SECRET`
2. Both systems must use the same `users` collection in MongoDB
3. Users must have an `incentive_role` assigned in the database

## 🔧 Step 1: Configure Environment Variables

### Incentive Dashboard Backend

Add to your `.env` file:

```env
# Use the same JWT_SECRET as Sales OS, or set a separate SSO_SECRET
JWT_SECRET=your_shared_jwt_secret_key
# OR
SSO_SECRET=your_sso_secret_key  # If different from JWT_SECRET
```

### Sales OS Backend

Ensure your Sales OS uses the same `JWT_SECRET` (or `SSO_SECRET`) when generating tokens for SSO.

## 🖥 Step 2: Add Card to Sales OS Dashboard

Add the following card component to your Sales OS dashboard:

### React Component Example

```jsx
import React from 'react';
import { useAuth } from '../context/AuthContext'; // Your Sales OS auth context
import jwt from 'jsonwebtoken';

const IncentiveDashboardCard = () => {
  const { user, token } = useAuth(); // Get current logged-in user from Sales OS

  const handleOpenIncentiveDashboard = () => {
    // Generate SSO token with user information
    const ssoToken = jwt.sign(
      {
        userId: user._id, // MongoDB ObjectId
        email: user.email, // Optional fallback
        username: user.username, // Optional fallback
        // Include incentive_role if available in Sales OS user object
        incentive_role: user.incentive_role,
      },
      process.env.REACT_APP_SSO_SECRET || process.env.REACT_APP_JWT_SECRET,
      { expiresIn: '5m' } // Short expiration for security
    );

    // Redirect to Incentive Dashboard SSO endpoint
    const incentiveDashboardUrl = process.env.REACT_APP_INCENTIVE_DASHBOARD_URL || 'http://localhost:3000';
    window.location.href = `${incentiveDashboardUrl}/sso-login?token=${ssoToken}`;
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
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
      >
        Open Incentive Dashboard →
      </button>
    </div>
  );
};

export default IncentiveDashboardCard;
```

### HTML/JavaScript Example (if not using React)

```html
<div class="incentive-dashboard-card" onclick="openIncentiveDashboard()">
  <div style="display: flex; align-items: center; margin-bottom: 12px;">
    <div style="font-size: 32px; margin-right: 12px;">💰</div>
    <div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 700;">Incentive Dashboard</h3>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">
        View your SQL, Closure, PO incentives, and quarterly targets
      </p>
    </div>
  </div>
  <button>Open Incentive Dashboard →</button>
</div>

<script>
async function openIncentiveDashboard() {
  // Get current user from Sales OS session
  const currentUser = getCurrentUser(); // Your function to get logged-in user
  
  // Generate SSO token (you'll need a JWT library like jsonwebtoken)
  const ssoToken = await generateSSOToken({
    userId: currentUser._id,
    email: currentUser.email,
    username: currentUser.username,
  });
  
  // Redirect to Incentive Dashboard
  const incentiveDashboardUrl = 'http://localhost:3000'; // Or your production URL
  window.location.href = `${incentiveDashboardUrl}/sso-login?token=${ssoToken}`;
}
</script>
```

## 🔐 Step 3: Token Generation Requirements

The SSO token must include at least one of the following fields:

- `userId` (MongoDB ObjectId) - **Recommended**
- `email` (string) - Fallback option
- `username` (string) - Fallback option

Optional fields:
- `incentive_role` - Will be fetched from database if not provided

### Example Token Payload

```javascript
{
  userId: "507f1f77bcf86cd799439011", // MongoDB ObjectId
  email: "gauri@example.com",
  username: "gauri",
  incentive_role: "sql_closure", // Optional
  iat: 1234567890,
  exp: 1234568190 // 5 minutes from now
}
```

## 🚀 Step 4: User Flow

1. **User logs into Sales OS** → Session created
2. **User sees "Incentive Dashboard" card** → On Sales OS dashboard
3. **User clicks card** → Sales OS generates JWT token with user info
4. **Redirect to Incentive Dashboard** → `https://incentive.yourdomain.com/sso-login?token=JWT_TOKEN`
5. **Incentive Dashboard verifies token** → Backend validates and finds user
6. **Automatic login** → User is logged in and redirected to dashboard
7. **User sees their incentive data** → No additional login required

## 🔒 Security Considerations

1. **Token Expiration**: Set token expiration to 5-15 minutes for security
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Verification**: Backend verifies token signature before processing
4. **User Validation**: System checks that user has `incentive_role` assigned
5. **Error Handling**: Invalid/expired tokens redirect to login page

## 🧪 Testing

### Test SSO Login Manually

1. Generate a test token in Sales OS:
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'YOUR_USER_ID', email: 'user@example.com' },
  'YOUR_JWT_SECRET',
  { expiresIn: '5m' }
);
console.log(token);
```

2. Open in browser:
```
http://localhost:3000/sso-login?token=YOUR_GENERATED_TOKEN
```

3. Should automatically log in and redirect to dashboard

## 📝 Environment Variables Reference

### Sales OS Frontend
```env
REACT_APP_INCENTIVE_DASHBOARD_URL=http://localhost:3000
REACT_APP_SSO_SECRET=your_shared_secret
# OR
REACT_APP_JWT_SECRET=your_shared_secret
```

### Incentive Dashboard Backend
```env
JWT_SECRET=your_shared_secret
SSO_SECRET=your_shared_secret  # Optional, uses JWT_SECRET if not set
FRONTEND_URL=http://localhost:3000
```

## 🐛 Troubleshooting

### Error: "Token is required"
- Ensure Sales OS is passing the token in the URL query parameter

### Error: "Invalid token"
- Check that both systems use the same JWT secret
- Verify token hasn't expired
- Ensure token signature is valid

### Error: "User not found"
- Verify user exists in the `users` collection
- Check that `userId`, `email`, or `username` in token matches database

### Error: "You do not have access to the Incentive System"
- User must have an `incentive_role` assigned in the database
- Contact admin to assign role: `admin`, `sql_closure`, or `prospector`

## 📞 Support

For issues or questions, check:
- Backend logs for SSO login errors
- Browser console for frontend errors
- Network tab for API request/response details


