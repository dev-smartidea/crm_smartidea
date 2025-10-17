import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AddCustomerPage from './pages/AddCustomerPage';
import CustomerListPage from './pages/CustomerListPage';
import CustomerDetailPage from './pages/CustomerDetailPage'; // ยังเก็บไว้เผื่อใช้ภายหลัง
import CustomerServicesPage from './pages/CustomerServicesPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import UserDetailPage from './pages/UserDetailPage';
import ProfilePage from './pages/ProfilePage';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  useEffect(() => {
    console.log('App loaded, token:', token);
  }, [token]);

  // ฟังก์ชันสำหรับ login สำเร็จ
  const handleLoginSuccess = () => {
    setToken(localStorage.getItem('token'));
  };

  // ตรวจสอบ role จาก token (decode JWT)
  const getRoleFromToken = () => {
    try {
      const t = localStorage.getItem('token');
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.role || null;
    } catch {
      return null;
    }
  };

  return (
    <Router>
      <Routes>
        {/* Redirect ไปหน้า login เมื่อเข้าเว็บครั้งแรก ถ้ายังไม่ได้ login */}
        <Route path="/" element={<Navigate to="/login" />} />

        <Route
          path="/login"
          element={<LoginPage onLoginSuccess={handleLoginSuccess} />}
        />

        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/dashboard"
          element={
            token ? <DashboardLayout /> : <Navigate to="/login" />
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="add" element={<AddCustomerPage />} />
          <Route path="list" element={<CustomerListPage />} />
          <Route path="customer/:id" element={<CustomerDetailPage />} />
          <Route path="customer/:id/services" element={<CustomerServicesPage />} />
          <Route path="customers/:customerId/services" element={<CustomerServicesPage />} />
          <Route path="services/:serviceId/transactions" element={<TransactionHistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route
          path="/dashboard/admin"
          element={
            token && getRoleFromToken() === 'admin' ? <AdminDashboardPage /> : <Navigate to="/dashboard" />
          }
        />

        <Route
          path="/user/:id"
          element={<UserDetailPageWrapper token={token} />}
        />

        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
// Wrapper สำหรับ UserDetailPage เพื่อดึงข้อมูล user จาก API
// ...existing imports...
// ...imports moved to top...

function UserDetailPageWrapper({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const found = res.data.find(u => u._id === id);
        setUser(found || null);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, token]);

  if (loading) return <div>กำลังโหลด...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  return <UserDetailPage user={user} onBack={() => navigate(-1)} />;
}
