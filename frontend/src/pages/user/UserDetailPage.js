import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../utils/imageHelper';
import './UserDetailPage.css';
import { XCircle } from 'react-bootstrap-icons';

const ROLE_LABELS = {
  user: 'User',
  account: 'Account',
  admin: 'Admin (Super)',
  admin_google: 'Admin Google',
  admin_facebook: 'Admin Facebook',
};

const ROLE_COLORS = {
  user: '#6c757d',
  account: '#f0ad4e',
  admin: '#dc3545',
  admin_google: '#28a745',
  admin_facebook: '#0d6efd',
};

const UserDetailPage = ({ user, onBack }) => {
  const api = process.env.REACT_APP_API_URL;
  const navigate = useNavigate();

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

  const [customers, setCustomers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [txCount, setTxCount] = React.useState(null);
  const [userRole, setUserRole] = React.useState(user?.role || '');
  const [roleLoading, setRoleLoading] = React.useState(false);
  const [pendingRole, setPendingRole] = React.useState(null);

  const fetchCustomers = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers?userId=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
    } catch {}
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    if (user && user._id) fetchCustomers();
  }, [user, fetchCustomers]);

  // ดึงจำนวน transaction ของ user
  React.useEffect(() => {
    if (!user?._id) return;
    const fetchTx = async () => {
      try {
        const token = localStorage.getItem('token');
        // ใช้ userId query param ให้ backend filter ให้ — ไม่ดึงข้อมูลทั้งหมด 9999 รายการ
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/transactions?userId=${user._id}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTxCount(res.data.pagination?.total ?? 0);
      } catch { setTxCount(0); }
    };
    fetchTx();
  }, [user]);

  const handleRoleChange = async () => {
    if (!pendingRole) return;
    setRoleLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${process.env.REACT_APP_API_URL}/api/auth/users/${user._id}/role`, { role: pendingRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserRole(pendingRole);
    } catch { alert('เปลี่ยน role ไม่สำเร็จ'); }
    setRoleLoading(false);
    setPendingRole(null);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [customerToDelete, setCustomerToDelete] = React.useState(null);
  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (!customerToDelete) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/customers/${customerToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(customers.filter(c => c._id !== customerToDelete));
      setCustomerToDelete(null);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า');
    }
  };

  if (!user) return <div>ไม่พบข้อมูลผู้ใช้</div>;

  return (
    <div className="user-detail-container" style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการลบข้อมูลลูกค้า</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการลบข้อมูลลูกค้าคนนี้ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowDeleteConfirm(false)}><XCircle /> ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 500, cursor: 'pointer' }} onClick={handleConfirmDelete}>ยืนยัน</button>
          </div>
        </div>
      )}

      {/* Role Confirm Modal */}
      {pendingRole && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการเปลี่ยน Role</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>
              เปลี่ยน role ของ <strong>{user.name}</strong> เป็น <strong style={{ color: '#2563eb' }}>{pendingRole}</strong>?
            </div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, cursor: 'pointer' }} onClick={() => setPendingRole(null)}>ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 500, cursor: 'pointer' }} onClick={handleRoleChange} disabled={roleLoading}>
              {roleLoading ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 32px', maxWidth: 560, width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#007bff', fontWeight: 700 }}>รายละเอียดผู้ใช้</h2>

        {/* Avatar + ชื่อ */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <img
            src={user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '' ? getImageUrl(user.avatar, api) : require('../../img/blank-profile.png')}
            alt="avatar"
            style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', background: '#eee', marginRight: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
            onError={e => { e.target.onerror = null; e.target.src = require('../../img/blank-profile.png'); }}
          />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: '#222' }}>{user.name}</p>
            <p style={{ margin: '2px 0 0', color: '#888', fontSize: 14 }}>@{user.username}</p>
            <p style={{ margin: '2px 0 0', color: '#aaa', fontSize: 13 }}>{user.phone || '-'}</p>
          </div>
        </div>

        {/* ข้อมูลพื้นฐาน */}
        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'grid', gap: 8 }}>
          <div><strong>Email:</strong> <span style={{ color: '#555' }}>{user.email}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>Role:</strong>
            <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: ROLE_COLORS[userRole] || '#6c757d', color: '#fff' }}>
              {ROLE_LABELS[userRole] || userRole}
            </span>
            {isSuperAdmin && userRole !== 'admin' && (
              <select
                value={userRole}
                onChange={e => setPendingRole(e.target.value)}
                style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #dee2e6', fontSize: 13, cursor: 'pointer' }}
              >
                <option value="user">user</option>
                <option value="account">account</option>
                <option value="admin_google">admin_google</option>
                <option value="admin_facebook">admin_facebook</option>
              </select>
            )}
          </div>
          <div><strong>สมัครเมื่อ:</strong> <span style={{ color: '#555' }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</span></div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#e8f4fd', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0d6efd' }}>{loading ? '...' : customers.length}</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>ลูกค้าที่ดูแล</div>
          </div>
          <div style={{ background: '#e8fdf0', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#28a745' }}>{txCount === null ? '...' : txCount}</div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>รายการโอน</div>
          </div>
        </div>

        {/* รายชื่อลูกค้า */}
        <h3 style={{ marginBottom: 12, color: '#007bff', fontWeight: 600, fontSize: '1rem' }}>ลูกค้าที่ดูแลอยู่</h3>
        {loading ? (
          <div style={{ color: '#888' }}>กำลังโหลดรายชื่อลูกค้า...</div>
        ) : customers.length === 0 ? (
          <div style={{ color: '#888' }}>ไม่มีลูกค้าที่ดูแลอยู่</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 8, border: '1px solid #e9ecef' }}>
            {customers.map((c, idx) => (
              <div
                key={c._id}
                onClick={() => navigate(`/dashboard/admin/customer/${c._id}/services`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: idx < customers.length - 1 ? '1px solid #f0f0f0' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontWeight: 600, color: '#0d6efd' }}>{c.name}</span>
                <span style={{ color: '#888', fontSize: 13 }}>{c.phone}</span>
              </div>
            ))}
          </div>
        )}
        {!loading && customers.length > 0 && (
          <div style={{ marginTop: 6, textAlign: 'right', fontSize: 13, color: '#888' }}>ทั้งหมด {customers.length} ราย</div>
        )}

        <button onClick={onBack} className="user-detail-back-btn" style={{ marginTop: 28, width: '100%', height: 44, fontSize: 17, fontWeight: 600, borderRadius: 8 }}>ย้อนกลับ</button>
      </div>
    </div>
  );
};

export default UserDetailPage;

