import React from 'react';
import axios from 'axios';
import './UserDetailPage.css';
import { XCircle } from 'react-bootstrap-icons';

const UserDetailPage = ({ user, onBack }) => {
  const [customers, setCustomers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const fetchCustomers = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers?userId=${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data.filter(c => c.userId === user._id || c.userId === user.id));
    } catch {}
    setLoading(false);
  }, [user]);
  React.useEffect(() => {
    if (user && user._id) fetchCustomers();
  }, [user, fetchCustomers]);

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [customerToDelete, setCustomerToDelete] = React.useState(null);
  // handleDeleteCustomer removed (no longer used)
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
    <div className="user-detail-container" style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Popup Confirm Modal for Delete */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการลบข้อมูลลูกค้า</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการลบข้อมูลลูกค้าคนนี้ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowDeleteConfirm(false)}><XCircle /> ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={handleConfirmDelete}>ยืนยัน</button>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 32px', maxWidth: 520, width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#007bff', fontWeight: 700 }}>รายละเอียดผู้ใช้</h2>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <img
            src={user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '' ? user.avatar : require('../img/blank-profile.png')}
            alt="avatar"
            style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', background: '#eee', marginRight: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
            onError={e => { e.target.onerror = null; e.target.src = require('../img/blank-profile.png'); }}
          />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: '#222' }}>{user.name}</p>
            <p style={{ margin: 0, color: '#888', fontSize: 15 }}>{user.phone || '-'}</p>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}><strong>Email:</strong> <span style={{ color: '#555' }}>{user.email}</span></div>
        <div style={{ marginBottom: 10 }}><strong>Role:</strong> <span style={{ color: '#555' }}>{user.role}</span></div>
        <h3 style={{ marginTop: 32, marginBottom: 12, color: '#007bff', fontWeight: 600 }}>ลูกค้าที่ดูแลอยู่</h3>
        {loading ? (
          <div>กำลังโหลดรายชื่อลูกค้า...</div>
        ) : customers.length === 0 ? (
          <div style={{ color: '#888' }}>ไม่มีลูกค้าที่ดูแลอยู่</div>
        ) : (
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            {customers.map(c => (
              <li key={c._id} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', background: '#f7f8fa', borderRadius: 8, padding: '10px 16px' }}>
                <span style={{ fontWeight: 600, color: '#222' }}>{c.name}</span>
                <span style={{ color: '#007bff', fontSize: 14, marginLeft: 8, marginRight: 8 }}>- {c.service}</span>
                <span style={{ color: '#888', fontSize: 14 }}>({c.phone})</span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onBack} className="user-detail-back-btn" style={{ marginTop: 32, width: '100%', height: 44, fontSize: 17, fontWeight: 600, borderRadius: 8 }}>ย้อนกลับ</button>
      </div>
    </div>
  );
};

export default UserDetailPage;
