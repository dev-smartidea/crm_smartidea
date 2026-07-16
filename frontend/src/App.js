import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import LoginPage from './pages/auth/LoginPage';
import ServiceDateUpdateModal from './components/ServiceDateUpdateModal';
import RegisterPage from './pages/auth/RegisterPage';
import AddCustomerPage from './pages/user/AddCustomerPage';
import CustomerListPage from './pages/user/CustomerListPage';
import CustomerDetailPage from './pages/user/CustomerDetailPage';
import CustomerServicesPage from './pages/user/CustomerServicesPage';
import CustomerActivitiesPage from './pages/user/CustomerActivitiesPage';
import AllActivitiesPage from './pages/user/AllActivitiesPage';
import TransactionHistoryPage from './pages/user/TransactionHistoryPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/shared/DashboardPage';
import AdminDashboardLayout from './components/AdminDashboardLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminLedgerPage from './pages/admin/AdminLedgerPage';
import AdminCardDailySummaryPage from './pages/admin/AdminCardDailySummaryPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import AccountDashboardPage from './pages/shared/AccountDashboardPage';
import AccountTransactionsPage from './pages/account/AccountTransactionsPage';
import RejectedTransactionsPage from './pages/account/RejectedTransactionsPage';
import AccountCardLedgerPage from './pages/account/AccountCardLedgerPage';
import ApprovedTransactionsPage from './pages/account/ApprovedTransactionsPage';
import AccountDashboardLayout from './components/AccountDashboardLayout';
import AccountCardsPage from './pages/account/AccountCardsPage';
import AccountCardDailySummaryPage from './pages/account/AccountCardDailySummaryPage';
import AccountNotificationPage from './pages/account/AccountNotificationPage';
import AccountLedgerPage from './pages/account/AccountLedgerPage';
import AccountFacebookPage from './pages/account/AccountFacebookPage';
import AccountGooglePage from './pages/account/AccountGooglePage';
import UserDetailPage from './pages/user/UserDetailPage';
import ProfilePage from './pages/user/ProfilePage';
import NotificationPage from './pages/shared/NotificationPage';
import ImageGalleryPage from './pages/shared/ImageGalleryPage';
import AllTransactionPage from './pages/user/AllTransactionPage';
import SubmittedTransactionsPage from './pages/user/SubmittedTransactionsPage';
import DueCustomersPage from './pages/user/DueCustomersPage';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  // queue ของรายการที่รอให้ user กรอกวันบริการ (real-time + pending จาก DB)
  const [dateUpdateQueue, setDateUpdateQueue] = useState([]);

  // ฟังก์ชันสำหรับ login สำเร็จ
  const handleLoginSuccess = () => {
    setToken(localStorage.getItem('token'));
  };

  // ตรวจสอบ role จาก token (decode JWT) — memoize เพื่อไม่ให้ decode ทุก render
  const role = useMemo(() => {
    try {
      if (!token) return null;
      const base64 = token.split('.')[1];
      // Replace URL-safe chars and pad for standard base64
      const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(
        atob(normalized).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      ));
      return payload.role || null;
    } catch {
      return null;
    }
  }, [token]);

  const getRoleFromToken = () => role;

  // Decode user id จาก token
  const userId = useMemo(() => {
    try {
      if (!token) return null;
      const base64 = token.split('.')[1];
      const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(
        atob(normalized).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      ));
      return payload.id || null;
    } catch {
      return null;
    }
  }, [token]);

  // ดึง pending notifications ประเภท service_date_update จาก DB (กรณี user ไม่ได้เปิดหน้าตอนบัญชีอนุมัติ)
  const fetchPendingDateUpdates = useCallback(async () => {
    if (!token || role !== 'user') return;
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pending = (res.data || []).filter(
        n => n.type === 'service_date_update' && !n.isRead && n.relatedServiceId
      );
      if (pending.length === 0) return;

      // ดึงข้อมูล Service จาก API เพื่อให้ Modal แสดง cid, customerName, currentDueDate ได้ถูกต้อง
      const serviceIds = [...new Set(pending.map(n =>
        typeof n.relatedServiceId === 'string' ? n.relatedServiceId : n.relatedServiceId?._id?.toString()
      ).filter(Boolean))];

      const serviceMap = {};
      await Promise.all(serviceIds.map(async (sid) => {
        try {
          const svcRes = await axios.get(
            `${process.env.REACT_APP_API_URL}/api/services/${sid}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          serviceMap[sid] = svcRes.data;
        } catch { /* ignore ถ้าดึงไม่ได้ */ }
      }));

      setDateUpdateQueue(prev => {
        const existingIds = new Set(prev.map(p => p.notificationId));
        const newItems = pending
          .filter(n => !existingIds.has(n._id))
          .map(n => {
            const sid = typeof n.relatedServiceId === 'string'
              ? n.relatedServiceId
              : n.relatedServiceId?._id?.toString();
            const svc = serviceMap[sid] || {};
            return {
              notificationId: n._id,
              serviceId: sid,
              cid: svc.cid || svc.customerIdField || svc.pageUrl || sid,
              customerName: svc.customerId?.name || '',
              serviceType: svc.serviceType || svc.name || '',
              amount: null,
              transactionDate: n.createdAt,
              currentStartDate: svc.startDate || null,
              currentDueDate: svc.dueDate || null,
              fromDB: true
            };
          });
        return [...prev, ...newItems];
      });
    } catch { /* ignore */ }
  }, [token, role]);


  // Socket.io listener สำหรับ service_date_update (real-time)
  useEffect(() => {
    if (!token || role !== 'user' || !userId) return;

    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token }
    });

    socket.on('service_date_update', (data) => {
      // Guard: ตรวจสอบว่า event นี้ส่งมาหา user คนนี้จริง
      if (data.userId && data.userId !== userId) return;
      setDateUpdateQueue(prev => {
        // กัน duplicate
        if (prev.some(p => p.notificationId === data.notificationId)) return prev;
        return [...prev, data];
      });
    });

    return () => { socket.disconnect(); };
  }, [token, role, userId]);

  // โหลด pending notifications เมื่อ login หรือ role เปลี่ยน
  useEffect(() => {
    fetchPendingDateUpdates();
  }, [fetchPendingDateUpdates]);

  // Callback เมื่อ user กดบันทึกวันที่สำเร็จ
  const handleDateUpdateSaved = (notificationId) => {
    setDateUpdateQueue(prev => prev.filter(p => p.notificationId !== notificationId));
  };

  // Callback เมื่อ user กด "ข้ามก่อน"
  const handleDateUpdateDismiss = (notificationId) => {
    setDateUpdateQueue(prev => prev.filter(p => p.notificationId !== notificationId));
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
            token
              ? (['admin', 'google_manager', 'facebook_manager'].includes(getRoleFromToken())
                  ? <Navigate to="/dashboard/admin" />
                  : getRoleFromToken() === 'account'
                    ? <Navigate to="/dashboard/account" />
                    : <DashboardLayout />)
              : <Navigate to="/login" />
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="add" element={<AddCustomerPage />} />
          <Route path="list" element={<CustomerListPage />} />
          <Route path="customer/:id" element={<CustomerDetailPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="images" element={<ImageGalleryPage />} />
          <Route path="alltransactions" element={
            token && getRoleFromToken() === 'account'
              ? <AccountTransactionsPage />
              : <AllTransactionPage />
          } />
          <Route path="customer/:id/services" element={<CustomerServicesPage />} />
          <Route path="customers/:customerId/activities" element={<CustomerActivitiesPage />} />
          <Route path="activities" element={<AllActivitiesPage />} />
          <Route path="services/:serviceId/transactions" element={<TransactionHistoryPage />} />
          <Route path="submitted-transactions" element={<SubmittedTransactionsPage />} />
          <Route path="due-customers" element={<DueCustomersPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>


        {/* Admin routes (with sidebar layout) */}
        <Route
          path="/dashboard/admin"
          element={
            token && ['admin', 'google_manager', 'facebook_manager'].includes(getRoleFromToken()) ? <AdminDashboardLayout /> : <Navigate to="/dashboard" />
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="audit-log" element={token && getRoleFromToken() === 'admin' ? <AuditLogPage /> : <Navigate to="/dashboard" />} />
          <Route path="due-customers" element={<DueCustomersPage />} />
          <Route path="add-customer" element={<AddCustomerPage />} />
          <Route path="customer/:id/services" element={<CustomerServicesPage />} />
          <Route path="services/:serviceId/transactions" element={<TransactionHistoryPage />} />
          <Route path="customer/:id" element={<CustomerDetailPage />} />
          <Route path="ledger" element={<AdminLedgerPage />} />
          <Route path="cards/daily-summary" element={<AdminCardDailySummaryPage />} />
          <Route path="services" element={<AdminServicesPage />} />
        </Route>

        {/* Account routes (with sidebar layout) */}
        <Route
          path="/dashboard/account"
          element={
            token && getRoleFromToken() === 'account' ? <AccountDashboardLayout /> : <Navigate to="/dashboard" />
          }
        >
          <Route index element={<AccountDashboardPage />} />
          <Route path="notifications" element={<AccountNotificationPage />} />
          <Route path="cards" element={<AccountCardsPage />} />
          <Route path="cards/daily-summary" element={<AccountCardDailySummaryPage />} />
          <Route path="cards/:cardId/ledger" element={<AccountCardLedgerPage />} />
          <Route path="ledger" element={<AccountLedgerPage />} />
          <Route path="facebook" element={<AccountFacebookPage />} />
          <Route path="google" element={<AccountGooglePage />} />
          <Route path="alltransactions" element={<AccountTransactionsPage />} />
          <Route path="rejected" element={<RejectedTransactionsPage />} />
          <Route path="approved" element={<ApprovedTransactionsPage />} />
          <Route path="images" element={<ImageGalleryPage />} />
          <Route path="due-customers" element={<DueCustomersPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route
          path="/user/:id"
          element={<UserDetailPageWrapper token={token} />}
        />

        <Route path="*" element={<Navigate to={token ? (['admin', 'google_manager', 'facebook_manager'].includes(getRoleFromToken()) ? '/dashboard/admin' : getRoleFromToken() === 'account' ? '/dashboard/account' : '/dashboard') : '/login'} />} />
      </Routes>

      {/* Global ServiceDateUpdateModal — แสดงเฉพาะ user role */}
      {role === 'user' && dateUpdateQueue.length > 0 && (
        <ServiceDateUpdateModal
          queue={dateUpdateQueue}
          onSaved={handleDateUpdateSaved}
          onDismiss={handleDateUpdateDismiss}
        />
      )}
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
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data || null);
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
