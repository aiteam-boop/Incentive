import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

/**
 * SSO Login Page
 * Handles automatic login from Sales OS dashboard via JWT token
 * 
 * URL format: /sso-login?token=JWT_TOKEN
 */
const SSOLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ssoLogin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (user) {
      navigate('/');
      return;
    }

    const token = searchParams.get('token');

    if (!token) {
      setError('No authentication token provided. Please access this page from Sales OS dashboard.');
      setLoading(false);
      return;
    }

    // Attempt SSO login
    const handleSSOLogin = async () => {
      try {
        setLoading(true);
        const userData = await ssoLogin(token);
        toast.success(`Welcome, ${userData.agentName || userData.username}!`);
        // Redirect to dashboard after successful login
        navigate('/');
      } catch (err) {
        console.error('SSO login error:', err);
        const errorMessage = err.response?.data?.message || 'SSO login failed. Please try logging in manually.';
        setError(errorMessage);
        toast.error(errorMessage);
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    handleSSOLogin();
  }, [searchParams, navigate, ssoLogin, user]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: 20,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: '48px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
            Signing you in...
          </h2>
          <p style={{ color: '#6c757d', fontSize: 14, marginBottom: 24 }}>
            Please wait while we verify your credentials
          </p>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: 20,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: '48px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#dc3545', marginBottom: 12 }}>
            Authentication Failed
          </h2>
          <p style={{ color: '#6c757d', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            {error}
          </p>
          <p style={{ color: '#6c757d', fontSize: 12 }}>
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default SSOLogin;

