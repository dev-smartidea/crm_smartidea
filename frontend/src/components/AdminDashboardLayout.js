import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate, Outlet } from 'react-router-dom';
import { FaUserShield, FaDownload, FaUpload, FaUserPlus, FaClipboardList, FaCalendarAlt, FaHome, FaSignOutAlt, FaBars, FaBook, FaTools } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext';
import ImpersonationBanner from './ImpersonationBanner';
import '../pages/admin/AdminDashboardPage.css';

export default function AdminDashboardLayout() {
  const navigate = useNavigate();
  const { isImpersonating } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

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

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so it triggers even if uploading the same file
    e.target.value = '';

    const firstConfirm = window.confirm(
      '⚠️ คำเตือนสำคัญ:\n\nการกู้คืนข้อมูล (Restore Backup) จะทำการลบและเขียนทับฐานข้อมูลปัจจุบันในระบบทั้งหมด!\n\nต้องการดำเนินการต่อหรือไม่?'
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      '⚠️ ยืนยันขั้นตอนสุดท้าย:\n\nระบบจะกู้คืนทุกคอลเลกชันและข้อมูลเก่าทั้งหมดจะถูกแทนที่ทันที! การกู้คืนไม่สามารถเรียกกลับคืนได้ คุณต้องการเริ่มกระบวนการเขียนทับใช่หรือไม่?'
    );
    if (!secondConfirm) return;

    try {
      setRestoreLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target.result);
          await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/restore`, backupData, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          alert('🎉 กู้คืนข้อมูลจากไฟล์สำรองสำเร็จเรียบร้อยแล้ว! หน้าเว็บจะทำการรีโหลด');
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert('การกู้คืนข้อมูลล้มเหลว: ' + (err.response?.data?.error || 'ไฟล์ไม่ถูกต้องหรือระบบเกิดข้อผิดพลาด'));
        } finally {
          setRestoreLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      setRestoreLoading(false);
    }
  };

  const handleBackup = async () => {
    const confirmed = window.confirm('ยืนยันที่จะดาวน์โหลด Export Backup');
    if (!confirmed) return;
    try {
      setBackupLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/admin/backup`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
    <div className="admin-page">
      <ImpersonationBanner />

      {/* ── Sidebar Overlay (mobile) ── */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={closeSidebar} />

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar" style={{ top: isImpersonating ? 40 : 0 }}>
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-brand-icon"><FaUserShield /></div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-title">Admin Dashboard</span>
            <span className="admin-sidebar-brand-subtitle">CRM SmartIdea</span>
          </div>
        </div>
        <ul className="admin-sidebar-menu">
          <li>
            <button className={`admin-sidebar-item ${window.location.pathname === '/dashboard/admin' ? 'active' : ''}`} onClick={() => { closeSidebar(); navigate('/dashboard/admin'); }}>
              <FaHome /> <span>แดชบอร์ด</span>
            </button>
          </li>
          <li>
            <button className="admin-sidebar-item" onClick={() => { closeSidebar(); navigate('/dashboard/admin/add-customer'); }}>
              <FaUserPlus /> <span>เพิ่มลูกค้า</span>
            </button>
          </li>
          <li>
            <button className="admin-sidebar-item" onClick={() => { closeSidebar(); navigate('/dashboard/admin/due-customers'); }}>
              <FaCalendarAlt /> <span>ลูกค้าครบกำหนด</span>
            </button>
          </li>
          {isSuperAdmin && (
            <li>
              <button className="admin-sidebar-item" onClick={() => { closeSidebar(); navigate('/dashboard/admin/audit-log'); }}>
                <FaClipboardList /> <span>Audit Log</span>
              </button>
            </li>
          )}
          <li>
            <button className="admin-sidebar-item" onClick={() => { closeSidebar(); handleBackup(); }} disabled={backupLoading}>
              <FaDownload /> <span>{backupLoading ? 'กำลัง Export...' : 'Export Backup'}</span>
            </button>
          </li>
          {isSuperAdmin && (
            <li>
              <label className="admin-sidebar-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', margin: 0, gap: '10px' }}>
                <FaUpload /> <span>{restoreLoading ? 'กำลัง Import...' : 'Import Backup'}</span>
                <input type="file" accept=".json" onChange={handleRestore} disabled={restoreLoading} style={{ display: 'none' }} />
              </label>
            </li>
          )}
          <li>
            <button className={`admin-sidebar-item ${window.location.pathname === '/dashboard/admin/ledger' ? 'active' : ''}`} onClick={() => { closeSidebar(); navigate('/dashboard/admin/ledger'); }}>
              <FaBook /> <span>ยอดเดินบัญชี</span>
            </button>
          </li>
          <li>
            <button className={`admin-sidebar-item ${window.location.pathname === '/dashboard/admin/cards/daily-summary' ? 'active' : ''}`} onClick={() => { closeSidebar(); navigate('/dashboard/admin/cards/daily-summary'); }}>
              <FaCalendarAlt /> <span>สรุปตัดบัตรรายวัน</span>
            </button>
          </li>
          <li>
            <button className={`admin-sidebar-item ${window.location.pathname === '/dashboard/admin/services' ? 'active' : ''}`} onClick={() => { closeSidebar(); navigate('/dashboard/admin/services'); }}>
              <FaTools /> <span>บริการทั้งหมด</span>
            </button>
          </li>
        </ul>
        <div className="admin-sidebar-footer">
          {!isImpersonating && (
            <button className="admin-sidebar-logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> ออกจากระบบ
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile Sidebar Toggle ── */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
        <FaBars />
      </button>

      {/* ── Main Content ── */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}