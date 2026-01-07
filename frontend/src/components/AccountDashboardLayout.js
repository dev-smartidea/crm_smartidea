import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './DashboardLayout.css';
import ProfileNavbar from './ProfileNavbar';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { HouseDoor, PersonCircle, BoxArrowRight, Bell, Wallet, CheckCircleFill, CreditCard } from 'react-bootstrap-icons';

export default function AccountDashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch {}
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const unread = res.data.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      } catch {}
    };
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <>
      <ProfileNavbar user={user} />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <ul className="nav-menu"> 
            <li><NavLink to="/dashboard/account" end><HouseDoor /> Dashboard</NavLink></li>
            <li><NavLink to="alltransactions"><Wallet /> รายการรอพิจารณา</NavLink></li>
            <li><NavLink to="approved"><CheckCircleFill /> รายการที่อนุมัติแล้ว</NavLink></li>
            <li><NavLink to="cards"><CreditCard /> บัตร</NavLink></li>
            <li>
              <NavLink to="notifications" className="notification-link">
                <Bell /> การแจ้งเตือน
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </NavLink>
            </li>
            <li><NavLink to="profile"><PersonCircle /> โปรไฟล์</NavLink></li>
          </ul>
          <div className="logout-section">
            <button className="btn btn-danger" onClick={logout}><BoxArrowRight /> ออกจากระบบ</button>
          </div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
