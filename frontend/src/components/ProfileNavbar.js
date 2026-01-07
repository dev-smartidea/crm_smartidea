
import React from 'react';

const API_HOST = process.env.REACT_APP_API_URL || '';
function getAvatarUrl(avatar) {
  if (!avatar) return require('../img/blank-profile.png');
  if (typeof avatar === 'string' && avatar.startsWith('/uploads/avatars/')) {
    return `${API_HOST}${avatar}`;
  }
  return avatar;
}

const ProfileNavbar = ({ user }) => {
  return (
    <nav style={{
      width: '100%',
      background: '#f8f9fa',
      display: 'flex',
      alignItems: 'center',
      padding: '12px 32px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 200
    }}>
      <img
        src={getAvatarUrl(user?.avatar)}
        alt="avatar"
        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#eee', marginRight: 16 }}
        onError={e => { e.target.onerror = null; e.target.src = require('../img/blank-profile.png'); }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, fontSize: '1.08rem' }}>{user?.name || '-'}</span>
        <span style={{ color: '#888', fontSize: 13 }}>{user?.phone || '-'}</span>
      </div>
    </nav>
  );
};

export default ProfileNavbar;
