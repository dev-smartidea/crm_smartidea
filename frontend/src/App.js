import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AddCustomerPage from './pages/user/AddCustomerPage';
import CustomerListPage from './pages/user/CustomerListPage';
import CustomerServicesPage from './pages/user/CustomerServicesPage';
import CustomerActivitiesPage from './pages/user/CustomerActivitiesPage';
import AllActivitiesPage from './pages/user/AllActivitiesPage';
import TransactionHistoryPage from './pages/user/TransactionHistoryPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/shared/DashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AccountDashboardPage from './pages/shared/AccountDashboardPage';
import AccountTransactionsPage from './pages/account/AccountTransactionsPage';
import ApprovedTransactionsPage from './pages/account/ApprovedTransactionsPage';
import AccountDashboardLayout from './components/AccountDashboardLayout';
import UserDetailPage from './pages/user/UserDetailPage';
import ProfilePage from './pages/user/ProfilePage';
import NotificationPage from './pages/shared/NotificationPage';
import ImageGalleryPage from './pages/shared/ImageGalleryPage';
import AllTransactionPage from './pages/user/AllTransactionPage';
import SubmittedTransactionsPage from './pages/user/SubmittedTransactionsPage';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

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
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="images" element={<ImageGalleryPage />} />
          <Route path="alltransactions" element={
            token && getRoleFromToken() === 'account'
              ? <AccountTransactionsPage />
              : <AllTransactionPage />
          } />
          <Route path="customer/:id/services" element={<CustomerServicesPage />} />
          <Route path="customers/:customerId/services" element={<CustomerServicesPage />} />
          <Route path="customers/:customerId/activities" element={<CustomerActivitiesPage />} />
          <Route path="activities" element={<AllActivitiesPage />} />
          <Route path="services/:serviceId/transactions" element={<TransactionHistoryPage />} />
          <Route path="submitted-transactions" element={<SubmittedTransactionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>


        <Route
          path="/dashboard/admin"
          element={
            token && getRoleFromToken() === 'admin' ? <AdminDashboardPage /> : <Navigate to="/dashboard" />
          }
        />

        <Route
          path="/dashboard/account"
          element={
            token && getRoleFromToken() === 'account' ? <AccountDashboardLayout /> : <Navigate to="/dashboard" />
          }
        >
          <Route index element={<AccountDashboardPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="alltransactions" element={<AccountTransactionsPage />} />
          <Route path="approved" element={<ApprovedTransactionsPage />} />
          <Route path="images" element={<ImageGalleryPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

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
