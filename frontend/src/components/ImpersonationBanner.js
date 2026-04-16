import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const BANNER_HEIGHT = 40;

export default function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useContext(AuthContext);

  if (!isImpersonating) return null;

  const handleStop = async () => {
    await stopImpersonation();
    window.location.href = '/dashboard/admin';
  };

  return (
    <>
      {/* Spacer — ดัน content ลงมาให้ banner ไม่บัง */}
      <div style={{ height: BANNER_HEIGHT }} />
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: BANNER_HEIGHT,
        zIndex: 99999,
        background: '#e67e22',
        color: '#fff',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.9rem',
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <span>
          👁 กำลังดูในฐานะ: <strong>{user?.name || user?.username}</strong>
          &nbsp;({user?.role})
        </span>
        <button
          onClick={handleStop}
          style={{
            background: '#fff',
            color: '#e67e22',
            border: 'none',
            borderRadius: 6,
            padding: '4px 16px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          ← กลับสู่ Admin
        </button>
      </div>
    </>
  );
}
