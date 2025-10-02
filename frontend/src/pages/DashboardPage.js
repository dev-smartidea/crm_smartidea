import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PeopleFill } from 'react-bootstrap-icons';
import './DashboardPage.css';

export default function DashboardPage() {
  const [customerCount, setCustomerCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'admin') {
          navigate('/dashboard/admin');
          return;
        }
      } catch (e) {
        console.error("Token parsing error:", e);
      }
    }

    const fetchCustomerCount = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerCount(res.data.length);
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        setCustomerCount(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerCount();
  }, [navigate]);

  if (loading) {
    return <div className="dashboard-loading">กำลังโหลดข้อมูล...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header">
        <h2>แดชบอร์ดผู้ใช้</h2>
      </div>
      
      <div className="dashboard-stats-grid">
        <div
          className="stat-card"
          onClick={() => navigate('/dashboard/list')}
          title="ดูรายชื่อลูกค้า"
        >
          <div className="stat-card-icon customers">
            <PeopleFill />
          </div>
          <div className="stat-card-info">
            <h5>จำนวนลูกค้าทั้งหมด</h5>
            <p className="stat-number">
              {customerCount !== null ? customerCount : '-'}
            </p>
          </div>
        </div>
        {/* You can add more stat cards here in the future */}
      </div>
    </div>
  );
}