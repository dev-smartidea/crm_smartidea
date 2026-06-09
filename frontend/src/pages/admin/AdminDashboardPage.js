import React, { useEffect, useState, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaUserShield, FaTrashAlt, FaSignInAlt, FaDownload, FaPlus, FaKey, FaUsers, FaChartBar, FaUserPlus, FaListAlt, FaTools, FaClipboardList, FaCalendarAlt } from 'react-icons/fa';
import { XCircle } from 'react-bootstrap-icons';
import { AuthContext } from '../../context/AuthContext';
import ImpersonationBanner from '../../components/ImpersonationBanner';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  // ลบ handleShowDetail (ใช้ Link แทน)
  const navigate = useNavigate();
  const { startImpersonation, isImpersonating } = useContext(AuthContext);
  // decode role ของ admin ที่ login อยู่
  const currentRole = (() => {
    try {
      const t = localStorage.getItem('token') || '';
      const b64 = t.split('.')[1];
      const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(norm).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))).role || null;
    } catch { return null; }
  })();
  const isSuperAdmin = currentRole === 'admin';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token] = useState(localStorage.getItem('token'));
  const [impersonateLoading, setImpersonateLoading] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [stats, setStats] = useState(null);
  // Create user
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ username: '', name: '', email: '', password: '', role: 'user' });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  // Reset password
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetPwUser, setResetPwUser] = useState(null);
  const [resetPwVal, setResetPwVal] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);
  // Customers
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  // Search & pagination
  const [custSearch, setCustSearch] = useState('');
  const [custPage, setCustPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [pendingRoleChange, setPendingRoleChange] = useState(null); // { userId, userName, newRole }
  const CUST_PAGE_SIZE = 10;
  const USER_PAGE_SIZE = 20;
  const api = process.env.REACT_APP_API_URL;


  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      setError('ไม่สามารถโหลดรายชื่อผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
    else setLoading(false);
  }, [isSuperAdmin, fetchUsers]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${api}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
        setStats(res.data);
      } catch { /* ignore */ }
    };
    fetchStats();
  }, [api, token]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setCustomersLoading(true);
        const res = await axios.get(`${api}/api/customers`, { headers: { Authorization: `Bearer ${token}` } });
        setCustomers(res.data);
      } catch { /* ignore */ } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, [api, token]);

  useEffect(() => { setCustPage(1); }, [custSearch]);
  useEffect(() => { setUserPage(1); }, [userSearch, userRoleFilter]);

  const handleImpersonate = async (userId) => {
    setImpersonateLoading(userId);
    const result = await startImpersonation(userId);
    setImpersonateLoading(null);
    if (result.success) {
      // force full reload เพื่อให้ App.js อ่าน token ใหม่จาก localStorage
      const dest =
        result.role === 'account' ? '/dashboard/account' :
        ['admin', 'google_manager', 'facebook_manager'].includes(result.role) ? '/dashboard/admin' :
        '/dashboard';
      window.location.href = dest;
    } else {
      setError(result.error);
    }
  };

  const handleRoleChange = async () => {
    if (!pendingRoleChange) return;
    const { userId, newRole } = pendingRoleChange;
    try {
      await axios.patch(`${process.env.REACT_APP_API_URL}/api/auth/users/${userId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      setError('เปลี่ยน role ไม่สำเร็จ');
    } finally {
      setPendingRoleChange(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError('');
    try {
      await axios.post(`${api}/api/auth/admin/create-user`, createUserForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowCreateUser(false);
      setCreateUserForm({ username: '', name: '', email: '', password: '', role: 'user' });
      fetchUsers();
      const statsRes = await axios.get(`${api}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(statsRes.data);
    } catch (err) {
      setCreateUserError(err.response?.data?.error || 'สร้างผู้ใช้ไม่สำเร็จ');
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwVal || resetPwVal.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setResetPwLoading(true);
    try {
      await axios.patch(`${api}/api/auth/users/${resetPwUser._id}/reset-password`, { password: resetPwVal }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowResetPw(false);
      setResetPwUser(null);
      setResetPwVal('');
      alert('Reset password สำเร็จ');
    } catch (err) {
      alert(err.response?.data?.error || 'Reset password ไม่สำเร็จ');
    } finally {
      setResetPwLoading(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDeleteClick = (userId) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/auth/users/${userToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      setError('ลบผู้ใช้ไม่สำเร็จ');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Customer delete
  const [showDeleteCust, setShowDeleteCust] = useState(false);
  const [custToDelete, setCustToDelete] = useState(null);
  const [deleteCustLoading, setDeleteCustLoading] = useState(false);

  // Reassign customer
  const [showReassign, setShowReassign] = useState(false);
  const [reassignCust, setReassignCust] = useState(null);
  const [reassignToUserId, setReassignToUserId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const handleDeleteCustClick = (cust) => {
    setCustToDelete(cust);
    setShowDeleteCust(true);
  };
  const handleConfirmDeleteCust = async () => {
    if (!custToDelete) return;
    setDeleteCustLoading(true);
    try {
      await axios.delete(`${api}/api/customers/${custToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowDeleteCust(false);
      setCustToDelete(null);
      setCustomers(prev => prev.filter(c => c._id !== custToDelete._id));
    } catch (err) {
      alert(err.response?.data?.error || 'ลบลูกค้าไม่สำเร็จ');
    } finally {
      setDeleteCustLoading(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassignCust || !reassignToUserId) return;
    setReassignLoading(true);
    try {
      await axios.put(`${api}/api/customers/${reassignCust._id}`, { userId: reassignToUserId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(prev => prev.map(c => {
        if (c._id !== reassignCust._id) return c;
        const newUser = users.find(u => u._id === reassignToUserId);
        return { ...c, userId: newUser ? { _id: newUser._id, name: newUser.name, username: newUser.username } : c.userId };
      }));
      setShowReassign(false);
      setReassignCust(null);
      setReassignToUserId('');
    } catch (err) {
      alert(err.response?.data?.error || 'ย้ายลูกค้าไม่สำเร็จ');
    } finally {
      setReassignLoading(false);
    }
  };

  if (loading) return <div className="admin-loading">กำลังโหลด...</div>;

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const res = await axios.get(`${api}/api/admin/backup`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `crm-backup-${today}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Backup ล้มเหลว กรุณาลองใหม่');
    } finally {
      setBackupLoading(false);
    }
  };

  // Filtered + paged customers
  const filteredCustomers = customers.filter(c =>
    [c.name, c.customerCode, c.phone, c.userId?.name, c.userId?.username]
      .some(v => v?.toLowerCase().includes(custSearch.toLowerCase()))
  );
  const custTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUST_PAGE_SIZE));
  const pagedCustomers = filteredCustomers.slice((custPage - 1) * CUST_PAGE_SIZE, custPage * CUST_PAGE_SIZE);

  // Filtered + paged users
  const filteredUsers = users.filter(u => {
    const matchSearch = [u.name, u.username, u.email].some(v => v?.toLowerCase().includes(userSearch.toLowerCase()));
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE);

  return (
    <div className="admin-page">
      <ImpersonationBanner />
      {/* ── Confirm Role Change Modal ── */}
      {pendingRoleChange && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon blue"><FaUserShield /></div>
              <h3 className="admin-modal-title">ยืนยันการเปลี่ยน Role</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: '#374151' }}>
                ต้องการเปลี่ยน role ของ <strong>{pendingRoleChange.userName}</strong> เป็น{' '}
                <strong style={{ color: '#2563eb' }}>{pendingRoleChange.newRole}</strong> ใช่หรือไม่?
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel" onClick={() => setPendingRoleChange(null)}>
                <XCircle /> ยกเลิก
              </button>
              <button className="modal-btn modal-btn-amber" onClick={handleRoleChange}>
                <FaUserShield /> ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reassign Customer Modal ── */}
      {showReassign && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon blue"><FaUserPlus /></div>
              <h3 className="admin-modal-title">ย้ายลูกค้าไปให้ผู้ดูแลคนใหม่</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: '0 0 12px', color: '#374151', fontWeight: 600 }}>{reassignCust?.name}</p>
              <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: '0.875rem' }}>
                ผู้ดูแลปัจจุบัน: <strong>{reassignCust?.userId?.name || '-'}</strong>
              </p>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                เลือกผู้ดูแลคนใหม่
              </label>
              <select
                value={reassignToUserId}
                onChange={e => setReassignToUserId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
              >
                <option value="">-- เลือกผู้ดูแล --</option>
                {users.filter(u => ['user', 'google_manager', 'facebook_manager'].includes(u.role)).map(u => (
                  <option key={u._id} value={u._id}>{u.name} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel" onClick={() => { setShowReassign(false); setReassignCust(null); setReassignToUserId(''); }} disabled={reassignLoading}>
                <XCircle /> ยกเลิก
              </button>
              <button className="modal-btn modal-btn-primary" onClick={handleConfirmReassign} disabled={reassignLoading || !reassignToUserId}>
                <FaUserPlus /> {reassignLoading ? 'กำลังบันทึก...' : 'ยืนยันย้าย'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Customer Confirm Modal ── */}
      {showDeleteCust && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon red"><FaTrashAlt /></div>
              <h3 className="admin-modal-title">ยืนยันการลบลูกค้า</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: '#374151', fontWeight: 600 }}>{custToDelete?.name}</p>
              <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                ลบลูกค้าพร้อมบริการ, รายการโอน, และข้อมูลทั้งหมด<br />การกระทำนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowDeleteCust(false)} disabled={deleteCustLoading}>
                <XCircle /> ยกเลิก
              </button>
              <button className="modal-btn modal-btn-danger" onClick={handleConfirmDeleteCust} disabled={deleteCustLoading}>
                <FaTrashAlt /> {deleteCustLoading ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon red"><FaTrashAlt /></div>
              <h3 className="admin-modal-title">ยืนยันการลบผู้ใช้</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?<br />การกระทำนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                <XCircle /> ยกเลิก
              </button>
              <button className="modal-btn modal-btn-danger" onClick={handleConfirmDelete} disabled={deleteLoading}>
                <FaTrashAlt /> {deleteLoading ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ── */}
      {showCreateUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon blue"><FaPlus /></div>
              <h3 className="admin-modal-title">สร้างผู้ใช้ใหม่</h3>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="admin-modal-body">
                {createUserError && <div className="admin-alert-error">{createUserError}</div>}
                {[
                  { label: 'Username', key: 'username', type: 'text', placeholder: 'username' },
                  { label: 'ชื่อ-นามสกุล', key: 'name', type: 'text', placeholder: 'ชื่อผู้ใช้' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'email@example.com' },
                  { label: 'Password', key: 'password', type: 'password', placeholder: 'อย่างน้อย 6 ตัวอักษร' },
                ].map(f => (
                  <div className="admin-form-group" key={f.key}>
                    <label className="admin-form-label">
                      {f.label} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input className="admin-form-input" type={f.type} value={createUserForm[f.key]}
                      onChange={e => setCreateUserForm(p => ({ ...p, [f.key]: e.target.value }))}
                      required placeholder={f.placeholder} />
                  </div>
                ))}
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select className="admin-form-select" value={createUserForm.role}
                    onChange={e => setCreateUserForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="user">user</option>
                    <option value="account">account</option>
                    <option value="google_manager">google_manager</option>
                    <option value="facebook_manager">facebook_manager</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="modal-btn modal-btn-cancel"
                  onClick={() => { setShowCreateUser(false); setCreateUserError(''); }}>ยกเลิก</button>
                <button type="submit" className="modal-btn modal-btn-primary" disabled={createUserLoading}>
                  <FaPlus /> {createUserLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {showResetPw && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon amber"><FaKey /></div>
              <h3 className="admin-modal-title">Reset Password</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#6b7280' }}>
                ผู้ใช้: <strong style={{ color: '#111827' }}>{resetPwUser?.name}</strong>
                <span style={{ color: '#9ca3af' }}> (@{resetPwUser?.username})</span>
              </p>
              <div className="admin-form-group">
                <label className="admin-form-label">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                <input className="admin-form-input" type="password" value={resetPwVal}
                  onChange={e => setResetPwVal(e.target.value)} autoFocus placeholder="รหัสผ่านใหม่" />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel"
                onClick={() => { setShowResetPw(false); setResetPwVal(''); }}>ยกเลิก</button>
              <button className="modal-btn modal-btn-amber" onClick={handleResetPassword}
                disabled={resetPwLoading || resetPwVal.length < 6}>
                <FaKey /> {resetPwLoading ? 'กำลัง Reset...' : 'ยืนยัน Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ── */}
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <div className="admin-topbar-brand-icon"><FaUserShield /></div>
          <div className="admin-topbar-brand-text">
            <span className="admin-topbar-brand-title">Admin Dashboard</span>
            <span className="admin-topbar-brand-subtitle">CRM SmartIdea Management</span>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <button className="topbar-btn topbar-btn-green"
            onClick={() => navigate('/dashboard/admin/add-customer')}>
            <FaUserPlus /><span> เพิ่มลูกค้า</span>
          </button>
          {isSuperAdmin && (
          <button className="topbar-btn topbar-btn-green"
            onClick={() => { setShowCreateUser(true); setCreateUserError(''); }}>
            <FaPlus /><span> สร้างผู้ใช้ใหม่</span>
          </button>
          )}
          <button className="topbar-btn topbar-btn-white" onClick={handleBackup} disabled={backupLoading}>
            <FaDownload /><span> {backupLoading ? 'กำลัง Export...' : 'Export Backup'}</span>
          </button>
          <button className="topbar-btn topbar-btn-white" onClick={() => navigate('/dashboard/admin/due-customers')}>
            <FaCalendarAlt /><span> ลูกค้าครบกำหนด</span>
          </button>
          {isSuperAdmin && (
          <button className="topbar-btn topbar-btn-white" onClick={() => navigate('/dashboard/admin/audit-log')}>
            <FaClipboardList /><span> Audit Log</span>
          </button>
          )}
          {!isImpersonating && (
          <button className="topbar-btn topbar-btn-logout" onClick={handleLogout}>
            Logout
          </button>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="admin-content">

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            {[
              { colorClass: 'blue',   icon: <FaUsers />,    value: stats.users.total,          label: 'ผู้ใช้ทั้งหมด',      sub: `user: ${stats.users.user} · account: ${stats.users.account} · admin: ${stats.users.admin}` },
              { colorClass: 'green',  icon: <FaChartBar />, value: stats.totalCustomers,        label: 'ลูกค้าทั้งหมด',      sub: null },
              { colorClass: 'purple', icon: <FaChartBar />, value: stats.totalTransactions,     label: 'รายการโอนทั้งหมด',   sub: `เดือนนี้: ${stats.thisMonthTransactions}` },
            ].map((s, i) => (
              <div key={i} className={`admin-stat-card ${s.colorClass}`}>
                <div className="admin-stat-icon-box">{s.icon}</div>
                <div className="admin-stat-body">
                  <div className="admin-stat-value">{s.value.toLocaleString()}</div>
                  <div className="admin-stat-label">{s.label}</div>
                  {s.sub && <div className="admin-stat-sub">{s.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customers Section */}
        <div className="admin-section-card">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              <FaListAlt /> รายการลูกค้าทั้งหมด
              <span className="section-count">
                {custSearch ? `${filteredCustomers.length}/${customers.length}` : customers.length}
              </span>
            </h2>
            <button className="topbar-btn topbar-btn-green" style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => navigate('/dashboard/admin/add-customer')}>
              <FaUserPlus /> เพิ่มลูกค้า
            </button>
          </div>
          {customers.length > 0 && (
            <div className="table-toolbar">
              <input
                className="table-search-input"
                type="text"
                placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร, ผู้ดูแล..."
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
              />
              {custSearch && (
                <button className="table-search-clear" onClick={() => setCustSearch('')}>✕</button>
              )}
            </div>
          )}
          <div className="admin-section-body">
            {customersLoading ? (
              <div className="admin-loading">กำลังโหลด...</div>
            ) : customers.length === 0 ? (
              <div className="table-empty">ยังไม่มีลูกค้า</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="table-empty">ไม่พบลูกค้าที่ค้นหา</div>
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>รหัส / ชื่อลูกค้า</th>
                      <th>ประเภท</th>
                      <th>สินค้า / บริการของลูกค้า</th>
                      <th style={{ textAlign: 'center' }}>บริการในระบบ</th>
                      <th>ผู้ดูแล</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCustomers.map((cust) => (
                      <tr key={cust._id}>
                        <td>
                          <div className="user-info-name">{cust.name}</div>
                          <div className="user-info-username">{cust.customerCode}</div>
                          <div className="user-info-email">{cust.phone}</div>
                        </td>
                        <td><span className={`type-badge type-badge-${cust.customerType === 'บุคคลธรรมดา' ? 'individual' : 'corporate'}`}>{cust.customerType}</span></td>
                        <td>
                          <div className="user-info-name" style={{ maxWidth: 200, whiteSpace: 'normal', lineHeight: 1.4 }}>{cust.productService || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`service-count-badge${(cust.serviceCount || 0) > 0 ? ' has-service' : ''}`}>
                            {cust.serviceCount || 0}
                          </span>
                        </td>
                        <td>
                          {cust.userId?.name
                            ? <div className="user-cell">
                                <div className="user-avatar user-avatar-user" style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                  {cust.userId.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="user-info-name">{cust.userId.name}</div>
                                  <div className="user-info-username">@{cust.userId.username}</div>
                                </div>
                              </div>
                            : <span style={{ color: '#aaa' }}>-</span>}
                        </td>
                        <td>
                          <div className="action-btn-group">
                            <button className="action-btn action-btn-blue"
                              onClick={() => navigate(`/dashboard/admin/customer/${cust._id}`)}>รายละเอียด</button>
                            <button className="action-btn action-btn-green"
                              onClick={() => navigate(`/dashboard/admin/customer/${cust._id}/services`)}>
                              <FaTools /> บริการ
                            </button>
                            <button className="action-btn action-btn-amber"
                              onClick={() => { setReassignCust(cust); setReassignToUserId(cust.userId?._id || ''); setShowReassign(true); }}>
                              <FaUserPlus /> ย้าย
                            </button>
                            <button className="action-btn action-btn-red"
                              onClick={() => handleDeleteCustClick(cust)}>
                              <FaTrashAlt /> ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {custTotalPages > 1 && (
                  <div className="admin-pagination">
                    <button className="page-btn" onClick={() => setCustPage(p => Math.max(1, p - 1))} disabled={custPage === 1}>‹</button>
                    {Array.from({ length: custTotalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`page-btn${custPage === p ? ' active' : ''}`} onClick={() => setCustPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn" onClick={() => setCustPage(p => Math.min(custTotalPages, p + 1))} disabled={custPage === custTotalPages}>›</button>
                    <span className="page-info">หน้า {custPage}/{custTotalPages}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Users Section - แสดงเฉพาะ Super Admin */}
        {isSuperAdmin && (
        <div className="admin-section-card">
          <div className="admin-section-header">
            <h2 className="admin-section-title">
              <FaUsers /> รายชื่อผู้ใช้
              <span className="section-count">
                {(userSearch || userRoleFilter !== 'all') ? `${filteredUsers.length}/${users.length}` : users.length}
              </span>
            </h2>
          </div>
          {users.length > 0 && (
            <div className="table-toolbar">
              <input
                className="table-search-input"
                type="text"
                placeholder="ค้นหาชื่อ, username, email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              {userSearch && (
                <button className="table-search-clear" onClick={() => setUserSearch('')}>✕</button>
              )}
              <div className="role-filter-tabs">
                {['ทั้งหมด', 'user', 'account', 'admin', 'google_manager', 'facebook_manager'].map(r => {
                  const val = r === 'ทั้งหมด' ? 'all' : r;
                  const count = val === 'all' ? users.length : users.filter(u => u.role === val).length;
                  return (
                    <button key={val}
                      className={`role-filter-tab${userRoleFilter === val ? ' active' : ''}${val !== 'all' ? ` tab-${val}` : ''}`}
                      onClick={() => setUserRoleFilter(val)}>
                      {r}
                      <span className="role-tab-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="admin-section-body">
            {loading ? (
              <div className="admin-loading">กำลังโหลด...</div>
            ) : error ? (
              <div className="admin-error">{error}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="table-empty">ไม่พบผู้ใช้ที่ค้นหา</div>
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ชื่อ / Username</th>
                      <th>Role</th>
                      <th>สมัครเมื่อ</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className="user-cell">
                            <div className={`user-avatar user-avatar-${user.role}`}>{user.name?.[0]?.toUpperCase() || '?'}</div>
                            <div>
                              <div className="user-info-name">{user.name}</div>
                              <div className="user-info-username">@{user.username}</div>
                              <div className="user-info-email">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select className={`admin-role-select role-select-${user.role}`} value={user.role}
                            onChange={e => setPendingRoleChange({ userId: user._id, userName: user.name || user.username, newRole: e.target.value })}
                            disabled={user.role === 'admin' && user.email === 'admin@mail.com'}>
                            <option value="user">user</option>
                            <option value="account">account</option>
                            <option value="admin">admin</option>
                            <option value="google_manager">google_manager</option>
                            <option value="facebook_manager">facebook_manager</option>
                          </select>
                        </td>
                        <td className="date-cell">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                            : '-'}
                        </td>
                        <td>
                          <div className="action-btn-group">
                            <Link to={`/user/${user._id}`} className="action-btn action-btn-blue">
                              รายละเอียด
                            </Link>
                            {user.role !== 'admin' && (
                              <button className="action-btn action-btn-green"
                                onClick={() => handleImpersonate(user._id)} disabled={!!impersonateLoading}
                                style={{ opacity: impersonateLoading === user._id ? 0.6 : 1 }}>
                                <FaSignInAlt /> {impersonateLoading === user._id ? '...' : 'View'}
                              </button>
                            )}
                            {user.role !== 'admin' && (
                              <button className="action-btn action-btn-amber"
                                onClick={() => { setResetPwUser(user); setResetPwVal(''); setShowResetPw(true); }}>
                                <FaKey /> Reset PW
                              </button>
                            )}
                            <button className="action-btn action-btn-red"
                              onClick={() => handleDeleteClick(user._id)}
                              disabled={user.role === 'admin' && user.email === 'admin@mail.com'}>
                              <FaTrashAlt /> ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {userTotalPages > 1 && (
                  <div className="admin-pagination">
                    <button className="page-btn" onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}>‹</button>
                    {Array.from({ length: userTotalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`page-btn${userPage === p ? ' active' : ''}`} onClick={() => setUserPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn" onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))} disabled={userPage === userTotalPages}>›</button>
                    <span className="page-info">หน้า {userPage}/{userTotalPages}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )} {/* end isSuperAdmin users section */}

      </main>
    </div>
  );
};

export default AdminDashboardPage;
