
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ProfilePage.css';
import { PersonVcard, Envelope, Telephone, ShieldLock, PencilSquare } from 'react-bootstrap-icons';

const API_HOST = process.env.REACT_APP_API_URL || '';

function getAvatarUrl(avatar) {
  if (!avatar) return require('../img/blank-profile.png');
  if (typeof avatar === 'string' && avatar.startsWith('/uploads/avatars/')) {
    return `${API_HOST}${avatar}`;
  }
  return avatar;
}

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef();

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
      setAvatarPreview(getAvatarUrl(user.avatar));
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
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
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        avatarUrl = res.data.url;
        setAvatarPreview(getAvatarUrl(avatarUrl));
      }

      await axios.patch(`${process.env.REACT_APP_API_URL}/api/auth/profile`, { phone, avatar: avatarUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
      setError('');
    } catch (err) {
      console.error("Error saving profile:", err.response ? err.response.data : err.message);
      setError('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
      setAvatarFile(null);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
  };

  if (loading) return <div className="profile-loading">กำลังโหลด...</div>;
  if (error) return <div className="profile-error">{error}</div>;
  if (!user) return <div className="profile-error">ไม่พบข้อมูลผู้ใช้</div>;

  return (
    <>
      {showConfirm && (
        <div className="confirm-modal-backdrop">
          <div className="confirm-modal-content">
            <h3>ยืนยันการบันทึก</h3>
            <p>คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลโปรไฟล์ใช่หรือไม่?</p>
            <div className="confirm-modal-actions">
              <button onClick={handleCancelConfirm} className="btn-cancel">ยกเลิก</button>
              <button onClick={handleConfirmSave} className="btn-confirm">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      <div className="profile-page-container">
        <div className="profile-card">
          <div className="profile-header">
            <h2>โปรไฟล์ของฉัน</h2>
          </div>

          <div className="profile-avatar-section">
            <div className="profile-avatar-container">
              <img
                src={avatarPreview}
                alt="Avatar"
                className="profile-avatar"
                onError={e => { e.target.onerror = null; e.target.src = require('../img/blank-profile.png'); }}
              />
              <button className="edit-avatar-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                <PencilSquare size={16} />
              </button>
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            <p className="avatar-note">(คลิกที่ปุ่มดินสอเพื่อเปลี่ยนรูป)</p>
          </div>

          <div className="profile-details">
            <div className="profile-detail-item">
              <PersonVcard className="icon" />
              <span className="label">ชื่อ:</span>
              <span className="value">{user.name}</span>
            </div>
            <div className="profile-detail-item">
              <PersonVcard className="icon" />
              <span className="label">Username:</span>
              <span className="value">{user.username}</span>
            </div>
            <div className="profile-detail-item">
              <Envelope className="icon" />
              <span className="label">Email:</span>
              <span className="value">{user.email}</span>
            </div>
            <div className="profile-detail-item">
              <ShieldLock className="icon" />
              <span className="label">Role:</span>
              <span className="value">{user.role}</span>
            </div>
            <div className="profile-detail-item editable">
              <Telephone className="icon" />
              <label htmlFor="phone" className="label">เบอร์โทร:</label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="profile-input"
                placeholder="xxx-xxx-xxxx"
              />
            </div>
          </div>

          {error && <p className="profile-error-message">{error}</p>}

          <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;