import { Link, Outlet, useNavigate } from 'react-router-dom';
import './DashboardLayout.css';
import ProfileNavbar from './ProfileNavbar';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
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

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <>
      <ProfileNavbar user={user} />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <h4>Menu</h4>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="add">เพิ่มลูกค้า</Link></li>
            <li><Link to="list">รายชื่อลูกค้า</Link></li>
            <li><Link to="profile">โปรไฟล์</Link></li>
          </ul>
          <button className="btn btn-sm btn-danger mt-3" onClick={logout}>ออกจากระบบ</button>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
