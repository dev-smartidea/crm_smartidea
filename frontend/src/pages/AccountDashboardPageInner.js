import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { PeopleFill, BriefcaseFill, CashCoin, Google, Facebook } from 'react-bootstrap-icons';
import './DashboardPage.css';

const CustomerIcon = () => <PeopleFill className="stat-card-icon customers" />;
const ServiceIcon = () => <BriefcaseFill className="stat-card-icon services" />;
const RevenueIcon = () => <CashCoin className="stat-card-icon revenue" />;

export default function AccountDashboardPageInner() {
  const [loading, setLoading] = useState(true);
  const [customerCount, setCustomerCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [serviceTypeData, setServiceTypeData] = useState({
    labels: ['Google Ads', 'Facebook Ads', 'อื่นๆ'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#43a047', '#1877f2', '#ff9800'],
      borderWidth: 0
    }]
  });
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'จำนวนการเติมเงิน',
        data: [],
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  });
  const [chartMaxY, setChartMaxY] = useState(0);

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
        setTotalRevenue(res.data.totalRevenue || 0);
        setRecentCustomers(res.data.recentCustomers || []);
        setRecentTransactions(res.data.recentTransactions || []);
        setUpcomingServices(res.data.upcomingServices || []);
        if (res.data.serviceTypeCount) {
          setServiceTypeData({
            labels: ['Google Ads', 'Facebook Ads', 'อื่นๆ'],
            datasets: [{
              data: [
                res.data.serviceTypeCount['Google Ads'] || 0,
                res.data.serviceTypeCount['Facebook Ads'] || 0,
                res.data.serviceTypeCount['other'] || 0
              ],
              backgroundColor: ['#43a047', '#1877f2', '#ff9800'],
              borderWidth: 0
            }]
          });
        }
        setChartData({
          labels: res.data.transactionChart.labels,
          datasets: [
            {
              label: 'จำนวนการเติมเงิน',
              data: res.data.transactionChart.data,
              borderColor: '#1976d2',
              backgroundColor: 'rgba(25, 118, 210, 0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        });
        const maxY = Math.max(0, ...(res.data.transactionChart.data || [0]));
        setChartMaxY(maxY);
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
    <div className="dashboard-page-container fade-up">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">ภาพรวมข้อมูลธุรกิจของคุณ</p>
      </div>
      {/* Stats Cards (ไม่มีสถานะบริการ) */}
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <CustomerIcon />
          <div className="stat-card-info">
            <h5>จำนวนลูกค้า</h5>
            <div className="stat-number">{customerCount}</div>
            <p className="stat-label">ลูกค้าทั้งหมด</p>
          </div>
        </div>
        <div className="stat-card">
          <ServiceIcon />
          <div className="stat-card-info">
            <h5>จำนวนบริการ</h5>
            <div className="stat-number">{serviceCount}</div>
            <p className="stat-label">บริการที่กำลังดำเนินการ</p>
          </div>
        </div>
        <div className="stat-card">
          <RevenueIcon />
          <div className="stat-card-info">
            <h5>จำนวนเงินทั้งหมด</h5>
            <div className="stat-number">{totalRevenue.toLocaleString()}</div>
            <p className="stat-label">บาท</p>
          </div>
        </div>
      </div>
      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h5 className="chart-title">จำนวนการเติมเงิน (รายวัน)</h5>
          <Line data={chartData} options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: '#f0f0f0' } },
              y: {
                grid: { color: '#f0f0f0' },
                beginAtZero: true,
                suggestedMax: Math.max(5, chartMaxY + 1),
                ticks: {
                  stepSize: 1,
                  callback: (value) => (Number.isInteger(value) ? value : '')
                }
              }
            }
          }} />
        </div>
        <div className="chart-card doughnut-card">
          <h5 className="chart-title">สัดส่วนประเภทบริการ</h5>
          <Doughnut data={serviceTypeData} options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'bottom', labels: { padding: 15, font: { size: 13 } } }
            }
          }} />
        </div>
      </div>
      {/* Tables Row */}
      <div className="tables-row">
        {/* Recent Customers */}
        <div className="table-card">
          <h5 className="table-title">ลูกค้าที่เพิ่มล่าสุด</h5>
          {recentCustomers.length > 0 ? (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ID</th>
                  <th>เบอร์โทร</th>
                  <th>วันที่เพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((cust) => (
                  <tr key={cust._id}>
                    <td>{cust.name}</td>
                    <td>{cust.customerCode || '-'}</td>
                    <td>{cust.phone}</td>
                    <td>{new Date(cust.createdAt).toLocaleDateString('th-TH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">ยังไม่มีข้อมูล</p>
          )}
        </div>
        {/* Recent Transactions */}
        <div className="table-card">
          <h5 className="table-title">รายการโอนเงินล่าสุด</h5>
          {recentTransactions.length > 0 ? (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>ชื่อลูกค้า</th>
                  <th>บริการ (ID)</th>
                  <th>จำนวน</th>
                  <th>วันที่</th>
                  <th>ธนาคาร</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td>{tx.customerId?.name || '-'}</td>
                    <td>
                      {tx.serviceId?.customerIdField && tx.serviceId?.name ? (
                        <span className={`service-badge ${
                          tx.serviceId.name === 'Facebook Ads' ? 'facebook' : 
                          tx.serviceId.name === 'Google Ads' ? 'google' : 
                          'other'
                        }`}>
                          {tx.serviceId.name === 'Facebook Ads' && <Facebook className="service-icon" />}
                          {tx.serviceId.name === 'Google Ads' && <Google className="service-icon" />}
                          <span className="service-id-text">{tx.serviceId.customerIdField}</span>
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td><strong>{tx.amount.toLocaleString()}</strong> บาท</td>
                    <td>{new Date(tx.transactionDate).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</td>
                    <td>
                      {tx.bank ? (
                        <span className={`badge-bank ${
                          tx.bank === 'KBANK' || tx.bank === 'กสิกรไทย' ? 'kbank' :
                          tx.bank === 'SCB' || tx.bank === 'ไทยพาณิชย์' ? 'scb' :
                          tx.bank === 'BBL' || tx.bank === 'กรุงเทพ' ? 'bbl' :
                          tx.bank === 'KTB' || tx.bank === 'กรุงไทย' ? 'ktb' :
                          tx.bank === 'TMB' || tx.bank === 'ทหารไทยธนชาต' ? 'tmb' :
                          tx.bank === 'BAY' || tx.bank === 'กรุงศรี' ? 'bay' :
                          'default'
                        }`}>
                          {tx.bank}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>
      {/* Upcoming Services */}
      {upcomingServices.length > 0 && (
        <div className="table-card full-width">
          <h5 className="table-title">บริการที่ใกล้ครบกำหนด</h5>
          <table className="mini-table">
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>บริการ</th>
                <th>Customer ID</th>
                <th>Website/Facebook Page</th>
                <th>วันครบกำหนด</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {upcomingServices.map((svc) => (
                <tr key={svc._id}>
                  <td>{svc.customerName || '-'}</td>
                  <td>{svc.name}</td>
                  <td>{svc.customerIdField || '-'}</td>
                  <td>
                    {svc.pageUrl
                      ? (/^(http|https):\/\//.test(svc.pageUrl)
                          ? <a href={svc.pageUrl} target="_blank" rel="noopener noreferrer">{svc.pageUrl}</a>
                          : svc.pageUrl)
                      : '-'}
                  </td>
                  <td>{new Date(svc.dueDate).toLocaleDateString('th-TH')}</td>
                  <td>
                    <span className={
                      `badge-status ` + (
                        svc.status === 'อยู่ระหว่างบริการ' ? 'inprogress' :
                        svc.status === 'ครบกำหนด' ? 'due' :
                        svc.status === 'เกินกำหนดมากกว่า 30 วัน' ? 'overdue30' :
                        ''
                      )
                    }>
                      {svc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
