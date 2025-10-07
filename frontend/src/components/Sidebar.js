// นำเข้า React และ NavLink
import React from 'react';
import { NavLink } from 'react-router-dom';

// กำหนดรายการเมนู
const menuItems = [
  { label: 'Dashboard', to: '/dashboard', icon: '🏠' },
  { label: 'Customers', to: '/dashboard/customers', icon: '👥' },
  { label: 'Sales', to: '/dashboard/sales', icon: '💰' },
  { label: 'Reports', to: '/dashboard/reports', icon: '📊' },
  { label: 'การแจ้งเตือน', to: '/dashboard/notifications', icon: '🔔' },
  // ...เพิ่มรายการเมนูตามต้องการ...
];

// สร้างคอมโพเนนต์ Sidebar
function Sidebar() {
  return (
    <aside
      className="sidebar"
      style={{
        background: '#fff',
        minHeight: '100vh',
        boxShadow: '0 0 16px rgba(0,0,0,0.07)',
        borderRadius: '16px',
        padding: '32px 16px',
        width: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* ส่วนชื่อระบบ */}
      <div style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '24px', letterSpacing: '1px', color: '#1976d2' }}>
        My CRM
      </div>
      {/* ส่วนเมนู */}
      {menuItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            'sidebar-link' + (isActive ? ' active' : '')
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: '8px',
            color: '#333',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '1rem',
            transition: 'background 0.2s, color 0.2s',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '1.2em' }}>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
      {/* สไตล์เพิ่มเติมสำหรับ Sidebar */}
      <style>{`
        .sidebar-link:hover {
          background: #f0f4fa;
          color: #1976d2;
        }
        .sidebar-link.active {
          background: #1976d2;
          color: #fff;
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;