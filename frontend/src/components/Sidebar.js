// นำเข้า React และ NavLink
import React from 'react';
import { NavLink } from 'react-router-dom';

// กำหนดรายการเมนู
const menuItems = [
  { label: 'Dashboard', to: '/dashboard', icon: '🏠', exact: true },
  { label: 'เพิ่มลูกค้า', to: '/dashboard/add', icon: '👤' },
  { label: 'รายชื่อลูกค้า', to: '/dashboard/list', icon: '👥' },
  { label: 'การแจ้งเตือน', to: '/dashboard/notifications', icon: '�' },
  { label: 'รูปภาพ', to: '/dashboard/images', icon: '�️' },
  { label: 'กิจกรรม', to: '/dashboard/activity', icon: '📝' },
  { label: 'โปรไฟล์', to: '/dashboard/profile', icon: '👨‍�' },
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
          end={item.exact}
          className={({ isActive }) =>
            'sidebar-link' + (isActive ? ' active' : '')
          }
        >
          <span className="sidebar-icon">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
      {/* สไตล์เพิ่มเติมสำหรับ Sidebar */}
      <style>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          color: #555;
          text-decoration: none;
          font-weight: 500;
          fontSize: 1rem;
          transition: all 0.2s ease;
          margin-bottom: 4px;
        }
        .sidebar-icon {
          font-size: 1.3em;
        }
        .sidebar-link:hover,
        .sidebar-link.active {
          background: #e8f4fd;
          color: #1976d2;
          font-weight: 600;
        }
        .sidebar-link.active .sidebar-icon,
        .sidebar-link:hover .sidebar-icon {
          transform: scale(1.1);
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;