import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { 
  CashCoin, 
  CreditCard2Back, 
  GraphUp, 
  ArrowDown,
  CheckCircle,
  XCircle,
  Clock,
  GraphUpArrow,
  GraphDownArrow
} from 'react-bootstrap-icons';
import './AccountDashboardPage.css';

// Icon components
const BalanceIcon = () => <CashCoin className="stat-card-icon balance" />;
const CardIcon = () => <CreditCard2Back className="stat-card-icon cards" />;
const TrendIcon = () => <GraphUp className="stat-card-icon trend" />;
const TopupIcon = () => <ArrowDown className="stat-card-icon topup" />;

export default function AccountDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [activeCards, setActiveCards] = useState(0);
  const [topupAmount, setTopupAmount] = useState(0);
  const [pendingTransactions, setPendingTransactions] = useState(0);
  const [approvedTransactions, setApprovedTransactions] = useState(0);
  const [rejectedTransactions, setRejectedTransactions] = useState(0);
  const [monthlyGrowth, setMonthlyGrowth] = useState(0);
  const [topupCount, setTopupCount] = useState(0);
  const [salesByProduct, setSalesByProduct] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#2563eb',
        '#22c55e', 
        '#f59e0b',
        '#ef4444',
        '#3b82f6',
        '#6366f1'
      ],
      borderWidth: 0
    }]
  });
  const [monthlyCollection, setMonthlyCollection] = useState({
    labels: [],
    datasets: [{
      label: 'เก็บเงินสำเร็จ',
      data: [],
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
      borderWidth: 1
    }]
  });
  const [channelBreakdown, setChannelBreakdown] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#2563eb', '#22c55e', '#f59e0b'],
      borderWidth: 0
    }]
  });
  const [dailyTrendData, setDailyTrendData] = useState({
    labels: [],
    datasets: [
      {
        label: 'โอนเข้า',
        data: [],
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
        borderWidth: 1
      },
      {
        label: 'โอนออก',
        data: [],
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
        borderWidth: 1
      }
    ]
  });
  const [allLedgerEntries, setAllLedgerEntries] = useState([]);
  const [allTransactionsList, setAllTransactionsList] = useState([]);
  const [channelFilter, setChannelFilter] = useState('all');
  const [submittedTransactions, setSubmittedTransactions] = useState([]);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchAccountDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ดึงข้อมูลจาก dashboard summary API
        const dashboardRes = await axios.get(`${api}/api/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const dashboardData = dashboardRes.data;
        console.log('Dashboard data:', dashboardData);
        
        // ดึงข้อมูลบัตร
        const cardsRes = await axios.get(`${api}/api/cards`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Cards response:', cardsRes.data);
        
        const cards = cardsRes.data || [];
        const totalCardBalance = cards.reduce((sum, c) => sum + (c.balance || 0), 0);
        const activeCardCount = cards.filter(c => c.status === 'active').length;
        
        setTotalCards(cards.length);
        setTotalBalance(totalCardBalance);
        setActiveCards(activeCardCount);

        console.log('Total cards:', cards.length, 'Balance:', totalCardBalance);

        // ดึงข้อมูลธุรกรรมล่าสุด
        let allTransactions = [];
        for (const card of cards) {
          try {
            const ledgerRes = await axios.get(`${api}/api/cards/${card._id}/ledger`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const transactions = (ledgerRes.data || []).map(tx => ({ 
              ...tx, 
              cardId: card._id, 
              cardName: card.displayName 
            }));
            allTransactions = allTransactions.concat(transactions);
          } catch (e) {
            console.warn(`Failed to fetch ledger for card ${card._id}:`, e.message);
          }
        }

        console.log('Total transactions:', allTransactions.length);

        // เรียงลำดับ
        allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // ดึงข้อมูล Transaction สำหรับนับสถานะการส่งบัญชี
        try {
          const transactionRes = await axios.get(`${api}/api/transactions`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const transactions = transactionRes.data.transactions || [];
          setAllTransactionsList(transactions);
          
          // คำนวณสถิติธุรกรรมตาม submissionStatus
          const submitted = transactions.filter(tx => tx.submissionStatus === 'submitted').length;
          const approved = transactions.filter(tx => tx.submissionStatus === 'approved').length;
          const rejected = transactions.filter(tx => tx.submissionStatus === 'rejected').length;
          
          setPendingTransactions(submitted); // รอดำเนินการ = submitted
          setApprovedTransactions(approved);
          setRejectedTransactions(rejected);

          // เก็บรายการธุรกรรมที่ส่งเข้ามาล่าสุด 5 รายการ (submitted หรือ approved)
          const recentSubmitted = transactions
            .filter(tx => tx.submissionStatus === 'submitted' || tx.submissionStatus === 'approved')
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .slice(0, 5);
          setSubmittedTransactions(recentSubmitted);
        } catch (e) {
          console.warn('Failed to fetch transactions for status count:', e.message);
          // ถ้าดึงไม่ได้ให้ใช้ค่า 0
          setAllTransactionsList([]);
          setPendingTransactions(0);
          setApprovedTransactions(0);
          setRejectedTransactions(0);
        }

        // คำนวณยอด topup
        // โอนเข้าทั้งหมด: ใช้ยอดรวมจากรายการที่อนุมัติแล้ว (backend summary)
        const approvedTotalAmount = dashboardData?.approvedSummary?.totalAmount || 0;
        // จำนวนรายการโอนเข้า: ใช้จำนวนที่อนุมัติแล้วจาก backend summary
        const topupTxCount = dashboardData?.approvedSummary?.count || 0;
        
        setTopupAmount(approvedTotalAmount);
        setTopupCount(topupTxCount);

        // คำนวณการเติบโต (เปรียบเทียบกับเดือนที่แล้ว)
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonthTx = allTransactions.filter(tx => new Date(tx.createdAt) >= new Date(now.getFullYear(), now.getMonth(), 1));
        const lastMonthTx = allTransactions.filter(tx => {
          const txDate = new Date(tx.createdAt);
          return txDate >= lastMonth && txDate < new Date(now.getFullYear(), now.getMonth(), 1);
        });
        
        const thisMonthTotal = thisMonthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const lastMonthTotal = lastMonthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const growth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0;
        setMonthlyGrowth(growth);

        console.log('Topup (approved):', approvedTotalAmount);

        // ดึงข้อมูล CardLedger ทั้งหมดสำหรับ channel breakdown และ daily trend
        let ledgerEntries = [];
        try {
          const ledgerRes = await axios.get(`${api}/api/cards/ledger/all`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          ledgerEntries = ledgerRes.data || [];
          setAllLedgerEntries(ledgerEntries);
        } catch (e) {
          console.warn('Failed to fetch all ledger entries:', e.message);
        }

        // ใช้ข้อมูล sales by service จาก backend
        if (dashboardData.salesByService && dashboardData.salesByService.labels.length > 0) {
          // กำหนดสีตามชื่อบริการ
          const colors = dashboardData.salesByService.labels.map((label, idx) => {
            if (label.toLowerCase().includes('google')) return '#22c55e'; // สีเขียว
            if (label.toLowerCase().includes('facebook')) return '#3b82f6'; // สีฟ้า
            // สีเริ่มต้นสำหรับบริการอื่นๆ
            const defaultColors = ['#2563eb', '#f59e0b', '#ef4444', '#6366f1', '#3b82f6', '#22c55e'];
            return defaultColors[idx % defaultColors.length];
          });

          setSalesByProduct({
            labels: dashboardData.salesByService.labels,
            datasets: [{
              data: dashboardData.salesByService.data,
              backgroundColor: colors,
              borderWidth: 0
            }]
          });
        }

        // ใช้ข้อมูล monthly collection จาก backend
        if (dashboardData.monthlyCollectionByService && dashboardData.monthlyCollectionByService.labels.length > 0) {
          // backend ส่งเป็น { labels, datasets } where datasets are per-service
          setMonthlyCollection(dashboardData.monthlyCollectionByService);
        } else if (dashboardData.monthlyCollection && dashboardData.monthlyCollection.labels.length > 0) {
          // fallback: single-series monthly collection
          setMonthlyCollection({
            labels: dashboardData.monthlyCollection.labels,
            datasets: [{
              label: 'เก็บเงินสำเร็จ',
              data: dashboardData.monthlyCollection.data,
              backgroundColor: '#2563eb',
              borderColor: '#2563eb',
              borderWidth: 1
            }]
          });
        }

        // สร้าง daily trend (7 วันล่าสุด) จาก CardLedger (ใช้ ledgerEntries ที่ดึงมาแล้ว)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7Days.push(d.toISOString().split('T')[0]);
        }

        const topupTrend = last7Days.map(date => {
          return ledgerEntries.filter(tx => {
            const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
            return txDate === date && tx.type === 'topup';
          }).reduce((sum, tx) => sum + (tx.amount || 0), 0);
        });

        const chargeTrend = last7Days.map(date => {
          return ledgerEntries.filter(tx => {
            const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
            return txDate === date && tx.type === 'charge';
          }).reduce((sum, tx) => sum + (tx.amount || 0), 0);
        });

        setDailyTrendData({
          labels: last7Days.map(d => {
            const date = new Date(d);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }),
          datasets: [
            {
              label: 'โอนเข้า',
              data: topupTrend,
              backgroundColor: '#22c55e',
              borderColor: '#22c55e',
              borderWidth: 1
            },
            {
              label: 'โอนออก',
              data: chargeTrend,
              backgroundColor: '#ef4444',
              borderColor: '#ef4444',
              borderWidth: 1
            }
          ]
        });
      } catch (err) {
        console.error('Failed to fetch account dashboard data:', err);
        setError(err.response?.data?.error || err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    
    if (token && api) {
      fetchAccountDashboardData();
    } else {
      setLoading(false);
      setError('ไม่พบ token หรือ API URL');
    }
  }, [api, token]);

  // คำนวณ channelBreakdown เมื่อ filter เปลี่ยน
  useEffect(() => {
    if (allLedgerEntries.length === 0) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // วันอาทิตย์ของสัปดาห์นี้
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // กรองตาม filter
    const filteredByTime = allLedgerEntries.filter(tx => {
      if (tx.type !== 'charge') return false;
      
      const txDate = new Date(tx.createdAt);
      
      switch (channelFilter) {
        case 'today':
          return txDate >= startOfDay;
        case 'week':
          return txDate >= startOfWeek;
        case 'month':
          return txDate >= startOfMonth;
        case 'year':
          return txDate >= startOfYear;
        case 'all':
        default:
          return true;
      }
    });

    // สร้าง breakdown by channel (พยายามสกัดจาก tx.channel หรือข้อมูล Transaction/service)
    const channelMap = {
      'Google Ads': 0,
      'Facebook Ads': 0,
      'Other': 0
    };
    
    filteredByTime.forEach(tx => {
      let channel = tx.channel;

      // ถ้าไม่มี channel ใน CardLedger ให้ลองค้นจาก populated serviceId หรือจาก Transaction ที่อ้างอิงใน tx.reference
      if (!channel) {
        // หาก serviceId ถูก populated จาก backend
        if (tx.serviceId && typeof tx.serviceId === 'object') {
          const svc = tx.serviceId;
          const name = (svc.serviceType || svc.name || '').toString().toLowerCase();
          if (name.includes('google')) channel = 'Google Ads';
          else if (name.includes('facebook')) channel = 'Facebook Ads';
        }

        // หากยังไม่เจอ ให้ค้นในรายการ Transaction ทั้งหมด (fetch ไว้ใน state allTransactionsList)
        if (!channel && allTransactionsList.length > 0 && tx.reference) {
          const related = allTransactionsList.find(t => String(t._id) === String(tx.reference));
          if (related && related.serviceId) {
            const svc = related.serviceId;
            const name = (svc.serviceType || svc.name || '').toString().toLowerCase();
            if (name.includes('google')) channel = 'Google Ads';
            else if (name.includes('facebook')) channel = 'Facebook Ads';
          }
        }
      }

      if (!channel) channel = 'Other';

      const amount = tx.amount || 0;
      channelMap[channel] = (channelMap[channel] || 0) + amount;
    });
    
    // กรองเฉพาะ channel ที่มียอดมากกว่า 0
    const filteredChannels = Object.entries(channelMap).filter(([, amount]) => amount > 0);
    
    // กำหนดสีตามช่องทาง
    const channelColors = filteredChannels.map(([label]) => {
      if (label === 'Google Ads') return '#22c55e'; // สีเขียว
      if (label === 'Facebook Ads') return '#3b82f6'; // สีฟ้า
      return '#f59e0b'; // สีส้มสำหรับ Other
    });
    
    setChannelBreakdown({
      labels: filteredChannels.map(([label]) => label),
      datasets: [{
        data: filteredChannels.map(([, amount]) => amount),
        backgroundColor: channelColors,
        borderWidth: 0
      }]
    });
  }, [allLedgerEntries, channelFilter, allTransactionsList]);

  if (loading) {
    return (
      <div className="account-dashboard-container">
        <div className="dashboard-loading">
          <div className="spinner" style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-dashboard-container">
        <div className="dashboard-error">
          <h3>เกิดข้อผิดพลาด</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>โหลดข้อมูลใหม่</button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-dashboard-container fade-up">
      <div className="dashboard-header">
        <div className="header-content">
          <h2>แดชบอร์ด</h2>
          <p className="dashboard-subtitle">ภาพรวมบัตรเครดิตและธุรกรรม</p>
        </div>
        <div className="header-stats">
          <div className="mini-stat">
            <Clock size={18} />
            <span>อัพเดทล่าสุด: {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards-grid">
        <div className="summary-card balance-card">
          <BalanceIcon />
          <div className="summary-info">
            <h5>ยอดเงินในบัตรคงเหลือรวม</h5>
            <div className="summary-amount">฿{totalBalance.toLocaleString()}</div>
            <p className="summary-label">จาก {totalCards} บัตร</p>
          </div>
        </div>
        
        <div className="summary-card cards-card">
          <CardIcon />
          <div className="summary-info">
            <h5>บัตรทั้งหมด</h5>
            <div className="summary-amount">{totalCards}</div>
            <p className="summary-label">
              <CheckCircle size={14} className="status-icon active" /> {activeCards} ใช้งาน
            </p>
          </div>
        </div>
        
        <div className="summary-card topup-card">
          <TopupIcon />
          <div className="summary-info">
            <h5>โอนเข้าทั้งหมด</h5>
            <div className="summary-amount success">฿{topupAmount.toLocaleString()}</div>
            <p className="summary-label">{topupCount} รายการ</p>
          </div>
        </div>
        
        <div className="summary-card trend-card">
          <TrendIcon />
          <div className="summary-info">
            <h5>การเติบโต</h5>
            <div className={`summary-amount ${monthlyGrowth >= 0 ? 'success' : 'danger'}`}>
              {monthlyGrowth >= 0 ? <GraphUpArrow size={24} /> : <GraphDownArrow size={24} />}
              {Math.abs(monthlyGrowth).toFixed(1)}%
            </div>
            <p className="summary-label">เดือนนี้เทียบกับเดือนที่แล้ว</p>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="status-overview-section">
        <h5 className="section-title">สถานะธุรกรรม</h5>
        <div className="status-cards-grid">
          <div className="status-card approved">
            <div className="status-icon-wrapper">
              <CheckCircle size={48} className="status-icon" />
            </div>
            <div className="status-info">
              <div className="status-count">{approvedTransactions}</div>
              <div className="status-label">อนุมัติแล้ว</div>
            </div>
          </div>
          <div className="status-card pending">
            <div className="status-icon-wrapper">
              <Clock size={48} className="status-icon" />
            </div>
            <div className="status-info">
              <div className="status-count">{pendingTransactions}</div>
              <div className="status-label">รอดำเนินการ</div>
            </div>
          </div>
          <div className="status-card rejected">
            <div className="status-icon-wrapper">
              <XCircle size={48} className="status-icon" />
            </div>
            <div className="status-info">
              <div className="status-count">{rejectedTransactions}</div>
              <div className="status-label">ปฏิเสธ</div>
            </div>
          </div>
        </div>
      </div>

      {/* New Charts Row - Sales & Collection */}
      <div className="charts-row">
        <div className="chart-card">
          <h5 className="chart-title">รายการโอนเงินตามรายการ</h5>
          {salesByProduct.labels.length > 0 ? (
            <div className="donut-chart-wrapper">
              <Doughnut data={salesByProduct} options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { 
                    display: true,
                    position: 'right',
                    labels: {
                      boxWidth: 15,
                      padding: 10,
                      font: { size: 11 }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ฿${value.toLocaleString()} (${percentage}%)`;
                      }
                    }
                  }
                },
                cutout: '65%'
              }} />
              <div className="chart-center-text">
                <div className="chart-total">รายได้รวม:</div>
                <div className="chart-total-amount">
                  {(salesByProduct.datasets?.[0]?.data || []).reduce((a, b) => a + b, 0).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <p className="no-data-chart">ยังไม่มีข้อมูลยอดขาย</p>
          )}
        </div>

        <div className="chart-card wide">
          <h5 className="chart-title">สรุปยอดเก็บเงิน</h5>
          {monthlyCollection.labels.length > 0 ? (
            <div className="bar-chart-info">
              <div className="chart-summary-stats">
                <div className="chart-stat-item">
                  <span className="stat-label">เก็บเงินสำเร็จ (อนุมัติแล้ว):</span>
                  <span className="stat-value success">
                    ฿{(monthlyCollection.datasets?.[0]?.data || []).reduce((a, b) => a + b, 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <Bar data={monthlyCollection} options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `฿${context.parsed.y.toLocaleString()}`
                    }
                  }
                },
                scales: {
                  x: { 
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                  },
                  y: {
                    grid: { color: '#e2e8f0' },
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `${(value / 1000).toFixed(0)}K`
                    }
                  }
                }
              }} />
            </div>
          ) : (
            <p className="no-data-chart">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <h5 className="chart-title">การใช้งานตามช่องทาง</h5>
            <select 
              className="chart-filter-select"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="today">วันนี้</option>
              <option value="week">สัปดาห์นี้</option>
              <option value="month">เดือนนี้</option>
              <option value="year">ปีนี้</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </div>
          {channelBreakdown.labels.length > 0 ? (
            <Bar data={channelBreakdown} options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `฿${context.parsed.x.toLocaleString()}`
                  }
                }
              },
              scales: {
                x: { 
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `฿${value.toLocaleString()}`
                  }
                }
              }
            }} />
          ) : (
            <p className="no-data-chart">ยังไม่มีข้อมูลธุรกรรม</p>
          )}
        </div>

        <div className="chart-card">
          <h5 className="chart-title">แนวโน้มรายการ (7 วันล่าสุด)</h5>
          {dailyTrendData.labels.length > 0 ? (
            <Bar data={dailyTrendData} options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                  callbacks: {
                    label: (context) => `${context.dataset.label}: ฿${context.parsed.y.toLocaleString()}`
                  }
                }
              },
              scales: {
                x: { grid: { color: '#e2e8f0' } },
                y: {
                  grid: { color: '#e2e8f0' },
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `฿${value.toLocaleString()}`
                  }
                }
              }
            }} />
          ) : (
            <p className="no-data-chart">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="recent-transactions-card">
        <div className="section-header">
          <h5 className="chart-title">ธุรกรรมล่าสุด</h5>
        </div>
        
        {submittedTransactions.length > 0 ? (
          <div className="transactions-list">
            {submittedTransactions.map((tx, idx) => (
              <div key={idx} className="transaction-item">
                <div className="transaction-icon">
                  <CashCoin className={tx.submissionStatus === 'approved' ? 'approved-icon' : 'pending-icon'} />
                </div>
                <div className="transaction-content">
                  <div className="transaction-label">
                    <span className="tx-type">{tx.serviceId?.serviceType || tx.serviceId?.name || 'ธุรกรรม'}</span>
                    {tx.serviceId?.cid && <span className="tx-cid">({tx.serviceId.cid})</span>}
                    {tx.bank && (
                      <span className="tx-bank" style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        marginLeft: '6px',
                        fontWeight: '600',
                        backgroundColor: 
                          tx.bank === 'KBANK' || tx.bank.includes('KBANK') ? '#138f59' :
                          tx.bank === 'SCB' || tx.bank.includes('SCB') ? '#4e2e7f' :
                          tx.bank === 'BBL' || tx.bank.includes('BBL') ? '#1e4598' :
                          tx.bank === 'BAY' || tx.bank.includes('BAY') ? '#fec43b' :
                          '#6c757d',
                        color: (tx.bank === 'BAY' || tx.bank.includes('BAY')) ? '#000' : '#fff'
                      }}>
                        {tx.bank}
                      </span>
                    )}
                    <span className={`tx-status ${tx.submissionStatus}`}>
                      {tx.submissionStatus === 'approved' ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                    </span>
                  </div>
                  <span className="tx-card">{tx.customerId?.name || tx.serviceId?.customerId?.name || '-'}</span>
                </div>
                <div className="transaction-amount">
                  <span className="amount-topup">
                    +฿{(tx.amount || 0).toLocaleString()}
                  </span>
                  <span className="tx-date">
                    {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString('th-TH', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data-message">ยังไม่มีธุรกรรม</p>
        )}
      </div>
    </div>
  );
}
