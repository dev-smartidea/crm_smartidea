import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfilePage.css';
// ...existing code...

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = React.useRef();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
      if (user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '') {
        setAvatarPreview(user.avatar);
      } else {
        setAvatarPreview(require('../img/blank-profile.png'));
      }
    }
  }, [user]);

  if (loading) return <div className="profile-loading">กำลังโหลด...</div>;
  if (error) return <div className="profile-error">{error}</div>;
  if (!user) return <div className="profile-error">ไม่พบข้อมูลผู้ใช้</div>;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      let avatarUrl = user.avatar;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/upload-avatar`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        avatarUrl = res.data.url;
      }
      await axios.patch(`${process.env.REACT_APP_API_URL}/api/auth/profile`, { phone, avatar: avatarUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // รีเฟรชข้อมูล user จาก backend
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
      if (res.data.avatar && typeof res.data.avatar === 'string' && res.data.avatar.trim() !== '') {
        setAvatarPreview(res.data.avatar);
      } else {
        setAvatarPreview(require('../img/blank-profile.png'));
      }
      setError('');
    } catch (err) {
      setError('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Popup Confirm Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการบันทึกข้อมูล</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการบันทึกข้อมูลโปรไฟล์ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={() => setShowConfirm(false)}>ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#007bff', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={handleConfirmSave}>ยืนยัน</button>
          </div>
        </div>
      )}
      <div className="profile-container" style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
        <h2 style={{ marginTop: 48, marginBottom: 24, fontWeight: 600, fontSize: '2rem', textAlign: 'center' }}>โปรไฟล์พนักงาน</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img
            src={avatarPreview}
            alt="avatar"
            style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', background: '#eee', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="เปลี่ยนรูปโปรไฟล์"
            onError={e => { e.target.onerror = null; e.target.src = require('../img/blank-profile.png'); }}
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 13, color: '#888', marginTop: 10 }}>(คลิกที่รูปเพื่อเปลี่ยนรูปโปรไฟล์)</div>
        </div>
        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.08rem' }}>
            <span style={{ color: '#888', minWidth: 90 }}>ชื่อ:</span>
            <span style={{ fontWeight: 500 }}>{user.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.08rem' }}>
            <span style={{ color: '#888', minWidth: 90 }}>Username:</span>
            <span style={{ fontWeight: 500 }}>{user.username}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.08rem' }}>
            <span style={{ color: '#888', minWidth: 90 }}>Email:</span>
            <span style={{ fontWeight: 500 }}>{user.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.08rem' }}>
            <span style={{ color: '#888', minWidth: 90 }}>Role:</span>
            <span style={{ fontWeight: 500 }}>{user.role}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.08rem' }}>
            <label htmlFor="phone" style={{ color: '#888', minWidth: 90, marginRight: 8 }}>เบอร์โทร:</label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ccc', width: 160, fontSize: '1rem' }}
            />
          </div>
        </div>
        <button className="profile-save-btn" onClick={handleSave} disabled={saving} style={{ width: 220, margin: '32px auto 0', fontSize: '1.08rem' }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </button>
      </div>
    </>
  );
};

export default ProfilePage;
