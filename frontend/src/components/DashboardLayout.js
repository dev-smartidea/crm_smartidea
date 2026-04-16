import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './DashboardLayout.css';
import ProfileNavbar from './ProfileNavbar';
import ImpersonationBanner from './ImpersonationBanner';
import axios from 'axios';
import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { HouseDoor, PersonPlus, People, PersonCircle, BoxArrowRight, Bell, Image, ClockHistory, Wallet, Send } from 'react-bootstrap-icons';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isImpersonating } = useContext(AuthContext);
  const BANNER_H = isImpersonating ? 40 : 0;
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activitiesCount, setActivitiesCount] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (err) {
        console.warn('Failed to fetch profile:', err.message);
      }
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
      } catch (err) {
        console.warn('Failed to fetch notifications:', err.message);
      }
    };
    fetchNotificationCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchActivitiesCount = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/activities`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // นับเฉพาะกิจกรรมที่ยังไม่เสร็จสิ้น
        const pendingActivities = res.data.filter(activity => activity.projectStatus !== 'เสร็จสิ้น');
        setActivitiesCount(pendingActivities.length);
      } catch (err) {
        console.warn('Failed to fetch activities:', err.message);
      }
    };
    fetchActivitiesCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivitiesCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <>
      <ImpersonationBanner />
      <ProfileNavbar user={user} topOffset={BANNER_H} />
      <div className="dashboard-layout">
        <aside className="sidebar" role="navigation" aria-label="เมนูหลัก" style={{ top: 64 + BANNER_H, height: `calc(100vh - ${64 + BANNER_H}px)` }}>
          <ul className="nav-menu"> 
            <li><NavLink to="/dashboard" end><HouseDoor /> แดชบอร์ด</NavLink></li>
            <li><NavLink to="add"><PersonPlus /> เพิ่มลูกค้า</NavLink></li>
            <li><NavLink to="list"><People /> รายชื่อลูกค้า</NavLink></li>
            <li>
              <NavLink to="activities" className="notification-link">
                <ClockHistory /> กิจกรรม
                {activitiesCount > 0 && <span className="notification-badge">{activitiesCount}</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="notifications" className="notification-link">
                <Bell /> การแจ้งเตือน
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </NavLink>
            </li>
            <li><NavLink to="alltransactions"><Wallet /> การเติมเงิน</NavLink></li>
            <li><NavLink to="submitted-transactions"><Send /> รายการที่ส่งบัญชี</NavLink></li>
            <li><NavLink to="images"><Image /> รูปภาพ</NavLink></li>
            <li><NavLink to="profile"><PersonCircle /> โปรไฟล์</NavLink></li>
          </ul>
          <div className="logout-section">
            {!isImpersonating && (
              <button className="btn btn-danger" onClick={logout}><BoxArrowRight /> ออกจากระบบ</button>
            )}
          </div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
