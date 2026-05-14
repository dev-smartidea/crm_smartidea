import React, { useEffect, useState, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaUserShield, FaTrashAlt, FaSignInAlt, FaDownload, FaPlus, FaKey, FaUsers, FaChartBar } from 'react-icons/fa';
import { XCircle } from 'react-bootstrap-icons';
import { AuthContext } from '../../context/AuthContext';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  // ลบ handleShowDetail (ใช้ Link แทน)
  const navigate = useNavigate();
  const { startImpersonation } = useContext(AuthContext);
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
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${api}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
        setStats(res.data);
      } catch { /* ignore */ }
    };
    fetchStats();
  }, [api, token]);


  const handleImpersonate = async (userId) => {
    setImpersonateLoading(userId);
    const result = await startImpersonation(userId);
    setImpersonateLoading(null);
    if (result.success) {
      // force full reload เพื่อให้ App.js อ่าน token ใหม่จาก localStorage
      const dest = result.role === 'account' ? '/dashboard/account' : '/dashboard';
      window.location.href = dest;
    } else {
      setError(result.error);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(`${process.env.REACT_APP_API_URL}/api/auth/users/${userId}/role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      setError('เปลี่ยน role ไม่สำเร็จ');
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

  if (loading) return <div>กำลังโหลด...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

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

  return (
    <div className="admin-dashboard-container">
      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการลบผู้ใช้</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}><XCircle /> ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 500, cursor: 'pointer' }} onClick={handleConfirmDelete} disabled={deleteLoading}>{deleteLoading ? 'กำลังลบ...' : 'ยืนยันลบ'}</button>
          </div>
        </div>
      )}

      {/* ── Create User Modal ── */}
      {showCreateUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 24px rgba(0,0,0,0.15)', width: 420, maxWidth: '95vw' }}>
            <h3 style={{ marginTop: 0, marginBottom: 20, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 8 }}><FaPlus /> สร้างผู้ใช้ใหม่</h3>
            {createUserError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.9rem' }}>{createUserError}</div>}
            <form onSubmit={handleCreateUser}>
              {[
                { label: 'Username *', key: 'username', type: 'text', placeholder: 'username' },
                { label: 'ชื่อ-นามสกุล *', key: 'name', type: 'text', placeholder: 'ชื่อผู้ใช้' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'email@example.com' },
                { label: 'Password *', key: 'password', type: 'password', placeholder: 'อย่างน้อย 6 ตัวอักษร' },
              ].map(f => (
                <label key={f.key} style={{ display: 'block', marginBottom: 12, fontSize: '0.9rem', fontWeight: 600 }}>
                  {f.label}
                  <input type={f.type} value={createUserForm[f.key]} onChange={e => setCreateUserForm(p => ({ ...p, [f.key]: e.target.value }))}
                    required placeholder={f.placeholder}
                    style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '1rem' }} />
                </label>
              ))}
              <label style={{ display: 'block', marginBottom: 20, fontSize: '0.9rem', fontWeight: 600 }}>
                Role
                <select value={createUserForm.role} onChange={e => setCreateUserForm(p => ({ ...p, role: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '1rem' }}>
                  <option value="user">user</option>
                  <option value="account">account</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowCreateUser(false); setCreateUserError(''); }}
                  style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 500 }}>ยกเลิก</button>
                <button type="submit" disabled={createUserLoading}
                  style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: createUserLoading ? 0.7 : 1 }}>
                  {createUserLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {showResetPw && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 24px rgba(0,0,0,0.15)', width: 380, maxWidth: '95vw' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8, color: '#1d4ed8' }}><FaKey style={{ marginRight: 8 }} />Reset Password</h3>
            <p style={{ color: '#6b7280', marginBottom: 20 }}>ผู้ใช้: <strong>{resetPwUser?.name}</strong> (@{resetPwUser?.username})</p>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 16 }}>
              รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
              <input type="password" value={resetPwVal} onChange={e => setResetPwVal(e.target.value)} autoFocus
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '1rem' }} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowResetPw(false); setResetPwVal(''); }}
                style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 500 }}>ยกเลิก</button>
              <button onClick={handleResetPassword} disabled={resetPwLoading || resetPwVal.length < 6}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: resetPwVal.length < 6 ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (resetPwLoading || resetPwVal.length < 6) ? 0.6 : 1 }}>
                {resetPwLoading ? 'กำลัง Reset...' : 'ยืนยัน Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-dashboard-card">
        {/* ── Stats Cards ── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { icon: <FaUsers />, label: 'ผู้ใช้ทั้งหมด', value: stats.users.total, color: '#2563eb', sub: `user: ${stats.users.user} · account: ${stats.users.account} · admin: ${stats.users.admin}` },
              { icon: <FaChartBar />, label: 'ลูกค้าทั้งหมด', value: stats.totalCustomers, color: '#059669', sub: null },
              { icon: <FaChartBar />, label: 'รายการโอนทั้งหมด', value: stats.totalTransactions, color: '#7c3aed', sub: `เดือนนี้: ${stats.thisMonthTransactions}` },
              { icon: <FaChartBar />, label: 'รออนุมัติ', value: stats.pendingTransactions, color: stats.pendingTransactions > 0 ? '#dc2626' : '#6b7280', sub: null },
            ].map((s, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: s.color, fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                {s.sub && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="admin-dashboard-title" style={{ margin: 0 }}><FaUserShield style={{ marginRight: 8 }}/> Admin Dashboard</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowCreateUser(true); setCreateUserError(''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              <FaPlus /> สร้างผู้ใช้ใหม่
            </button>
            <button onClick={handleBackup} disabled={backupLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.9rem', cursor: backupLoading ? 'not-allowed' : 'pointer', opacity: backupLoading ? 0.7 : 1 }}>
              <FaDownload /> {backupLoading ? 'กำลัง Export...' : 'Export Backup'}
            </button>
          </div>
        </div>

        {/* ── User Table ── */}
        <div className="admin-dashboard-table-wrapper">
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>ชื่อ / Username</th>
                <th>Role</th>
                <th>สมัครเมื่อ</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>@{user.username}</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{user.email}</div>
                  </td>
                  <td>
                    <select className="admin-dashboard-select" value={user.role}
                      onChange={e => handleRoleChange(user._id, e.target.value)}
                      disabled={user.role === 'admin' && user.email === 'admin@mail.com'}>
                      <option value="user">user</option>
                      <option value="account">account</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`/user/${user._id}`}
                        style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', textDecoration: 'none', fontSize: '0.85rem' }}>
                        รายละเอียด
                      </Link>
                      {user.role !== 'admin' && (
                        <button onClick={() => handleImpersonate(user._id)} disabled={!!impersonateLoading}
                          style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: impersonateLoading === user._id ? 0.7 : 1 }}>
                          <FaSignInAlt /> {impersonateLoading === user._id ? '...' : 'View'}
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button onClick={() => { setResetPwUser(user); setResetPwVal(''); setShowResetPw(true); }}
                          style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FaKey /> Reset PW
                        </button>
                      )}
                      <button className="admin-dashboard-delete-btn" onClick={() => handleDeleteClick(user._id)}
                        disabled={user.role === 'admin' && user.email === 'admin@mail.com'}
                        style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                        <FaTrashAlt style={{ marginRight: 3 }}/> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={handleLogout}
        style={{ position: 'fixed', right: 32, bottom: 32, padding: '14px 28px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '1rem', cursor: 'pointer', zIndex: 1000 }}>
        Logout
      </button>
    </div>
  );
};

export default AdminDashboardPage;
