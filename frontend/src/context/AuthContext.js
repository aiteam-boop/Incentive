import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('incentive_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (err) {
      console.error('Auth error:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Login with existing Sales Dashboard credentials (username + password)
  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('incentive_token', newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('incentive_token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  // Helper: get the user's incentive_role
  const getRole = () => user?.incentive_role;

  // Helper: check if user has one of the given roles
  const hasRole = (...roles) => roles.includes(user?.incentive_role);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, fetchUser, getRole, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
