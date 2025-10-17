
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import './DashboardPage.css';

// Simple icon components (can replace with SVG or icon library)
const CustomerIcon = () => (
  <span className="stat-card-icon customers" role="img" aria-label="ลูกค้า">👤</span>
);
const ServiceIcon = () => (
  <span className="stat-card-icon services" role="img" aria-label="บริการ">🛠️</span>
);
const StatusIcon = () => (
  <span className="stat-card-icon status" role="img" aria-label="สถานะ">📊</span>
);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [customerCount, setCustomerCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [serviceStatus, setServiceStatus] = useState({
    'รอคิวทำเว็บ': 0,
    'รอคิวสร้างบัญชี': 0,
    'รอลูกค้าส่งข้อมูล': 0
  });
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'จำนวนการเติมเงิน',
        data: [],
        borderColor: '#007bff',
        backgroundColor: 'rgba(0,123,255,0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  });

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerCount(res.data.customerCount);
        setServiceCount(res.data.serviceCount);
        setServiceStatus(res.data.serviceStatus);
        setChartData({
          labels: res.data.transactionChart.labels,
          datasets: [
            {
              label: 'จำนวนการเติมเงิน',
              data: res.data.transactionChart.data,
              borderColor: '#007bff',
              backgroundColor: 'rgba(0,123,255,0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [api, token]);

  if (loading) {
    return (
      <div className="dashboard-page-container">
        <div className="dashboard-loading">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <CustomerIcon />
          <div className="stat-card-info">
            <h5>จำนวนลูกค้า</h5>
            <div className="stat-number">{customerCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <ServiceIcon />
          <div className="stat-card-info">
            <h5>จำนวนบริการ</h5>
            <div className="stat-number">{serviceCount}</div>
          </div>
        </div>
        <div className="stat-card">
          <StatusIcon />
          <div className="stat-card-info">
            <h5>สถานะบริการ</h5>
            <div style={{ marginTop: 8 }}>
              {Object.entries(serviceStatus).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 4 }}>
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 40, background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: 30 }}>
        <h5 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 18 }}>จำนวนการเติมเงิน (Transaction)</h5>
        <Line data={chartData} options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'วัน' }, grid: { color: '#eee' } },
            y: { title: { display: true, text: 'จำนวน' }, grid: { color: '#eee' } }
          }
        }} />
      </div>
    </div>
  );
}
