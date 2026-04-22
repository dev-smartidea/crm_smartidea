import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { 
  CashCoin, 
  CreditCard2Back, 
  CreditCard2BackFill,
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
  const [submittedTransactions, setSubmittedTransactions] = useState([]);
  const [recentCharges, setRecentCharges] = useState([]);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const controller = new AbortController();
    const fetchAccountDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ดึงข้อมูลจาก dashboard summary API + บัตร พร้อมกัน
        const authHeaders = { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal };
        const [dashboardRes, cardsRes] = await Promise.all([
          axios.get(`${api}/api/dashboard/summary`, authHeaders),
          axios.get(`${api}/api/cards`, authHeaders)
        ]);
        
        const dashboardData = dashboardRes.data;
        
        const cards = cardsRes.data || [];
        const totalCardBalance = cards.reduce((sum, c) => sum + (c.balance || 0), 0);
        const activeCardCount = cards.filter(c => c.status === 'active').length;
        
        setTotalCards(cards.length);
        setTotalBalance(totalCardBalance);
        setActiveCards(activeCardCount);

        // ดึง CardLedger + Transaction พร้อมกัน
        let ledgerEntries = [];
        let transactionData = [];
        
        const [ledgerResult, transactionResult] = await Promise.allSettled([
          axios.get(`${api}/api/cards/ledger/all`, authHeaders),
          axios.get(`${api}/api/transactions`, authHeaders)
        ]);

        if (ledgerResult.status === 'fulfilled') {
          ledgerEntries = ledgerResult.value.data || [];
          const charges = ledgerEntries
            .filter(e => e.type === 'charge')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
          setRecentCharges(charges);
        } else {
          console.error('Failed to load card ledger:', ledgerResult.reason);
        }

        if (transactionResult.status === 'fulfilled') {
          transactionData = transactionResult.value.data.transactions || [];
        } else {
          console.error('Failed to load transactions:', transactionResult.reason);
        }

        // ใช้ ledgerEntries เป็น allTransactions สำหรับคำนวณ growth
        const allTransactions = ledgerEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // คำนวณสถิติธุรกรรมตาม submissionStatus (จากข้อมูลที่ดึงพร้อมกันแล้ว)
        const submitted = transactionData.filter(tx => tx.submissionStatus === 'submitted').length;
        const approved = transactionData.filter(tx => tx.submissionStatus === 'approved').length;
        const rejected = transactionData.filter(tx => tx.submissionStatus === 'rejected').length;
        
        setPendingTransactions(submitted);
        setApprovedTransactions(approved);
        setRejectedTransactions(rejected);

        // เก็บรายการธุรกรรมที่ส่งเข้ามาล่าสุด 5 รายการ
        const recentSubmitted = transactionData
          .filter(tx => tx.submissionStatus === 'submitted' || tx.submissionStatus === 'approved')
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 5);
        setSubmittedTransactions(recentSubmitted);

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
        if (axios.isCancel(err)) return;
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
    return () => controller.abort();
  }, [api, token]);

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
          <p className="dashboard-subtitle">ภาพรวมบัตร และธุรกรรม</p>
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

      {/* Charts Section */}
      <div className="charts-section">
        <h5 className="section-title">ภาพรวม</h5>
        <div className="charts-grid-3">
          {/* 1. รายการโอนเงินตามรายการ */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-icon sales">
                <CashCoin size={18} />
              </div>
              <h5 className="chart-title">สัดส่วนยอดโอนแยกตามบริการ</h5>
            </div>
            {salesByProduct.labels.length > 0 ? (
              <div className="donut-chart-wrapper">
                <Doughnut data={salesByProduct} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      display: true,
                      position: 'bottom',
                      labels: {
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 12, weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(23, 23, 23, 0.9)',
                      titleFont: { size: 13, weight: '600' },
                      bodyFont: { size: 12 },
                      padding: 12,
                      cornerRadius: 8,
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
                  cutout: '68%'
                }} />
                <div className="chart-center-text">
                  <div className="chart-total">รวม</div>
                  <div className="chart-total-amount">
                    ฿{(salesByProduct.datasets?.[0]?.data || []).reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-data-chart">
                <CashCoin size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p>ยังไม่มีข้อมูลยอดขาย</p>
              </div>
            )}
          </div>

          {/* 2. สรุปยอดเก็บเงิน */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-icon collection">
                <GraphUp size={18} />
              </div>
              <h5 className="chart-title">ยอดเก็บเงินรายเดือน</h5>
            </div>
            {monthlyCollection.labels.length > 0 ? (
              <div className="bar-chart-info">
                <div className="chart-summary-stats">
                  <div className="chart-stat-item">
                    <span className="stat-label">เก็บเงินสำเร็จ</span>
                    <span className="stat-value success">
                      ฿{(monthlyCollection.datasets?.[0]?.data || []).reduce((a, b) => a + b, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Bar data={monthlyCollection} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(23, 23, 23, 0.9)',
                      titleFont: { size: 13, weight: '600' },
                      bodyFont: { size: 12 },
                      padding: 12,
                      cornerRadius: 8,
                      callbacks: {
                        label: (context) => `฿${context.parsed.y.toLocaleString()}`
                      }
                    }
                  },
                  scales: {
                    x: { 
                      grid: { display: false },
                      ticks: { font: { size: 11 }, color: '#737373' },
                      border: { display: false }
                    },
                    y: {
                      grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                      beginAtZero: true,
                      border: { display: false },
                      ticks: {
                        font: { size: 11 },
                        color: '#737373',
                        callback: (value) => `${(value / 1000).toFixed(0)}K`
                      }
                    }
                  }
                }} />
              </div>
            ) : (
              <div className="no-data-chart">
                <GraphUp size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>

          {/* 3. แนวโน้มรายการ */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-icon trend">
                <GraphUpArrow size={18} />
              </div>
              <h5 className="chart-title">แนวโน้มบัตร โอนเข้า-ออก 7 วันล่าสุด</h5>
            </div>
            {dailyTrendData.labels.length > 0 ? (
              <div className="bar-chart-info">
                <Bar data={dailyTrendData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      display: true, 
                      position: 'top',
                      labels: {
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 12, weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(23, 23, 23, 0.9)',
                      titleFont: { size: 13, weight: '600' },
                      bodyFont: { size: 12 },
                      padding: 12,
                      cornerRadius: 8,
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ฿${context.parsed.y.toLocaleString()}`
                      }
                    }
                  },
                  scales: {
                    x: { 
                      grid: { display: false },
                      ticks: { font: { size: 11 }, color: '#737373' },
                      border: { display: false }
                    },
                    y: {
                      grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                      beginAtZero: true,
                      border: { display: false },
                      ticks: {
                        font: { size: 11 },
                        color: '#737373',
                        callback: (value) => `฿${value.toLocaleString()}`
                      }
                    }
                  }
                }} />
              </div>
            ) : (
              <div className="no-data-chart">
                <GraphUpArrow size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sections - Side by Side */}
      <div className="recent-sections-row">
        {/* Recent Card Charges */}
        <div className="recent-transactions-card">
        <div className="section-header">
          <h5 className="chart-title">รายการตัดเงินจากบัตรล่าสุด</h5>
        </div>
        
        {recentCharges.length > 0 ? (
          <div className="transactions-list">
            {recentCharges.map((entry, idx) => (
              <div key={idx} className="transaction-item">
                <div className="transaction-icon">
                  <CreditCard2BackFill className="charge-icon" />
                </div>
                <div className="transaction-content">
                  <div className="transaction-label">
                    <span className="tx-type">{entry.cardId?.displayName || 'บัตร'}</span>
                    {entry.serviceId?.cid && <span className="tx-cid">({entry.serviceId.cid})</span>}
                    {entry.channel && (
                      <span className="tx-channel-badge" style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        marginLeft: '6px',
                        fontWeight: '600',
                        backgroundColor: 
                          entry.channel.toLowerCase().includes('google') ? '#dcfce7' :
                          entry.channel.toLowerCase().includes('facebook') ? '#dbeafe' :
                          '#f5f5f5',
                        color: 
                          entry.channel.toLowerCase().includes('google') ? '#166534' :
                          entry.channel.toLowerCase().includes('facebook') ? '#1d4ed8' :
                          '#525252'
                      }}>
                        {entry.channel}
                      </span>
                    )}
                  </div>
                  <span className="tx-card">{entry.note || entry.reference || '-'}</span>
                </div>
                <div className="transaction-amount">
                  <span className="amount-charge">
                    -฿{(entry.amount || 0).toLocaleString()}
                  </span>
                  <span className="tx-date">
                    {new Date(entry.createdAt).toLocaleDateString('th-TH', {
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
          <p className="no-data-message">ยังไม่มีรายการตัดเงิน</p>
        )}
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
    </div>
  );
}
