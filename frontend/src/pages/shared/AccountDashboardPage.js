import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { CashCoin, ClockFill, CheckCircleFill } from 'react-bootstrap-icons';
import './AccountDashboardPage.css';

// Icon components
const PendingIcon = () => <ClockFill className="stat-card-icon pending" />;
const ApprovedIcon = () => <CheckCircleFill className="stat-card-icon approved" />;
const RevenueIcon = () => <CashCoin className="stat-card-icon revenue" />;

export default function AccountDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [pendingByService, setPendingByService] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#ff9800', '#f44336', '#2196f3'],
      borderWidth: 0
    }]
  });
  const [approvedByService, setApprovedByService] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#4caf50', '#2196f3', '#ff9800'],
      borderWidth: 0
    }]
  });
  const [transactionTrendData, setTransactionTrendData] = useState({
    labels: [],
    datasets: [
      {
        label: 'รอพิจารณา',
        data: [],
        borderColor: '#ff9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'อนุมัติแล้ว',
        data: [],
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  });

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchAccountDashboardData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/transactions`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const transactions = res.data || [];
        
        // คำนวณข้อมูลสำหรับ pending (submitted)
        const pendingTxs = transactions.filter(tx => tx.submissionStatus === 'submitted');
        const pendingTotalAmount = pendingTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
        setPendingCount(pendingTxs.length);
        setPendingAmount(pendingTotalAmount);

        // คำนวณข้อมูลสำหรับ approved
        const approvedTxs = transactions.filter(tx => tx.submissionStatus === 'approved');
        const approvedTotalAmount = approvedTxs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
        setApprovedCount(approvedTxs.length);
        setApprovedAmount(approvedTotalAmount);

        // สร้าง doughnut chart สำหรับ pending by service
        const pendingServiceMap = {};
        pendingTxs.forEach(tx => {
          const serviceName = tx.serviceName || 'อื่นๆ';
          const amount = tx.totalAmount || 0;
          pendingServiceMap[serviceName] = (pendingServiceMap[serviceName] || 0) + amount;
        });
        setPendingByService({
          labels: Object.keys(pendingServiceMap),
          datasets: [{
            data: Object.values(pendingServiceMap),
            backgroundColor: ['#ff9800', '#f44336', '#2196f3', '#4caf50'],
            borderWidth: 0
          }]
        });

        // สร้าง doughnut chart สำหรับ approved by service
        const approvedServiceMap = {};
        approvedTxs.forEach(tx => {
          const serviceName = tx.serviceName || 'อื่นๆ';
          const amount = tx.totalAmount || 0;
          approvedServiceMap[serviceName] = (approvedServiceMap[serviceName] || 0) + amount;
        });
        setApprovedByService({
          labels: Object.keys(approvedServiceMap),
          datasets: [{
            data: Object.values(approvedServiceMap),
            backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#f44336'],
            borderWidth: 0
          }]
        });

        // สร้าง line chart สำหรับ transaction trend (last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7Days.push(d.toISOString().split('T')[0]);
        }

        const pendingTrend = last7Days.map(date => {
          return pendingTxs.filter(tx => {
            const txDate = new Date(tx.transactionDate || tx.createdAt).toISOString().split('T')[0];
            return txDate === date;
          }).length;
        });

        const approvedTrend = last7Days.map(date => {
          return approvedTxs.filter(tx => {
            const txDate = new Date(tx.transactionDate || tx.createdAt).toISOString().split('T')[0];
            return txDate === date;
          }).length;
        });

        setTransactionTrendData({
          labels: last7Days.map(d => {
            const date = new Date(d);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }),
          datasets: [
            {
              label: 'รอพิจารณา',
              data: pendingTrend,
              borderColor: '#ff9800',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'อนุมัติแล้ว',
              data: approvedTrend,
              borderColor: '#4caf50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        });
      } catch (err) {
        console.error('Failed to fetch account dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccountDashboardData();
  }, [api, token]);

  if (loading) {
    return (
      <div className="account-dashboard-container">
        <div className="dashboard-loading">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <div className="account-dashboard-container fade-up">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">ภาพรวมการอนุมัติรายการโอนเงิน</p>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards-grid">
        <div className="summary-card pending-card">
          <PendingIcon />
          <div className="summary-info">
            <h5>รอพิจารณา</h5>
            <div className="summary-amount">{pendingAmount.toLocaleString()}</div>
            <p className="summary-label">{pendingCount} รายการ</p>
          </div>
        </div>
        <div className="summary-card approved-card">
          <ApprovedIcon />
          <div className="summary-info">
            <h5>อนุมัติแล้ว</h5>
            <div className="summary-amount">{approvedAmount.toLocaleString()}</div>
            <p className="summary-label">{approvedCount} รายการ</p>
          </div>
        </div>
        <div className="summary-card total-card">
          <RevenueIcon />
          <div className="summary-info">
            <h5>ยอดรวมทั้งหมด</h5>
            <div className="summary-amount">{(pendingAmount + approvedAmount).toLocaleString()}</div>
            <p className="summary-label">บาท</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h5 className="chart-title">สัดส่วนรายการรอพิจารณา (ตามบริการ)</h5>
          {pendingByService.labels.length > 0 ? (
            <Doughnut data={pendingByService} options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { position: 'bottom', labels: { padding: 15, font: { size: 13 } } }
              }
            }} />
          ) : (
            <p className="no-data-chart">ยังไม่มีรายการรอพิจารณา</p>
          )}
        </div>

        <div className="chart-card">
          <h5 className="chart-title">สัดส่วนรายการอนุมัติแล้ว (ตามบริการ)</h5>
          {approvedByService.labels.length > 0 ? (
            <Doughnut data={approvedByService} options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { position: 'bottom', labels: { padding: 15, font: { size: 13 } } }
              }
            }} />
          ) : (
            <p className="no-data-chart">ยังไม่มีรายการอนุมัติแล้ว</p>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="trend-chart-card">
        <h5 className="chart-title">แนวโน้มรายการ (7 วันล่าสุด)</h5>
        <Line data={transactionTrendData} options={{
          responsive: true,
          maintainAspectRatio: true,
          plugins: { 
            legend: { display: true, position: 'top' }
          },
          scales: {
            x: { grid: { color: '#f0f0f0' } },
            y: {
              grid: { color: '#f0f0f0' },
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                callback: (value) => (Number.isInteger(value) ? value : '')
              }
            }
          }
        }} />
      </div>
    </div>
  );
}
