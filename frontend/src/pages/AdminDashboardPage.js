import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaUserShield, FaTrashAlt } from 'react-icons/fa';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  // ลบ handleShowDetail (ใช้ Link แทน)
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token] = useState(localStorage.getItem('token'));


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

  return (
    <div className="admin-dashboard-container">
      {/* Popup Confirm Modal for Delete */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการลบผู้ใช้</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={handleConfirmDelete} disabled={deleteLoading}>{deleteLoading ? 'กำลังลบ...' : 'ยืนยัน'}</button>
          </div>
        </div>
      )}
      <div className="admin-dashboard-card">
        <h2 className="admin-dashboard-title"><FaUserShield style={{ marginRight: 8 }}/> Admin Dashboard</h2>
        <table className="admin-dashboard-table">
          <thead>
            <tr>
              <th>ชื่อผู้ใช้</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td>{user.name}</td>
                <td>
                  <select
                    className="admin-dashboard-select"
                    value={user.role}
                    onChange={e => handleRoleChange(user._id, e.target.value)}
                    disabled={user.role === 'admin' && user.email === 'admin@mail.com'}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    to={`/user/${user._id}`}
                    className="admin-dashboard-detail-btn"
                    style={{ background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                  >
                    รายละเอียด
                  </Link>
                  <button
                    className="admin-dashboard-delete-btn"
                    onClick={() => handleDeleteClick(user._id)}
                    disabled={user.role === 'admin' && user.email === 'admin@mail.com'}
                  >
                    <FaTrashAlt style={{ marginRight: 4 }}/> ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleLogout}
        style={{
          position: 'fixed',
          right: '32px',
          bottom: '32px',
          padding: '16px 32px',
          background: '#e74c3c',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: '1.1rem',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default AdminDashboardPage;
