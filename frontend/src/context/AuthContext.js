import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(
    !!sessionStorage.getItem('admin_token')
  );

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (error) {
        console.error('Failed to fetch user', error);
        localStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updateUser = (newUser) => {
    setUser(newUser);
  };

  const logout = () => {
    // ถ้ากำลัง impersonate อยู่ ให้ล้างออกทั้งหมดด้วย
    sessionStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    setIsImpersonating(false);
    setUser(null);
  };

  // Admin กด "View" → เซฟ admin token → สลับเป็น user token
  const startImpersonation = async (targetUserId) => {
    const adminToken = localStorage.getItem('token');
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/impersonate/${targetUserId}`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      sessionStorage.setItem('admin_token', adminToken);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setIsImpersonating(true);
      return { success: true, role: res.data.user.role };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'เกิดข้อผิดพลาด' };
    }
  };

  // กด "กลับสู่ Admin" → restore admin token
  const stopImpersonation = async () => {
    const adminToken = sessionStorage.getItem('admin_token');
    if (!adminToken) return;
    localStorage.setItem('token', adminToken);
    sessionStorage.removeItem('admin_token');
    setIsImpersonating(false);
    await fetchUser();
  };

  const value = { user, loading, fetchUser, updateUser, logout, isImpersonating, startImpersonation, stopImpersonation };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
