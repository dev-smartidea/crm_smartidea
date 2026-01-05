import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { 
  CashCoin, 
  CreditCard2Back, 
  GraphUp, 
  ArrowUpRight, 
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
  Clock,
  GraphUpArrow,
  GraphDownArrow
} from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import './AccountDashboardPage.css';

// Icon components
const BalanceIcon = () => <CashCoin className="stat-card-icon balance" />;
const CardIcon = () => <CreditCard2Back className="stat-card-icon cards" />;
const TrendIcon = () => <GraphUp className="stat-card-icon trend" />;
const TopupIcon = () => <ArrowDown className="stat-card-icon topup" />;
const ChargeIcon = () => <ArrowUp className="stat-card-icon charge" />;

export default function AccountDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [activeCards, setActiveCards] = useState(0);
  const [topupAmount, setTopupAmount] = useState(0);
  const [chargeAmount, setChargeAmount] = useState(0);
  const [pendingTransactions, setPendingTransactions] = useState(0);
  const [approvedTransactions, setApprovedTransactions] = useState(0);
  const [rejectedTransactions, setRejectedTransactions] = useState(0);
  const [monthlyGrowth, setMonthlyGrowth] = useState(0);
  const [topupCount, setTopupCount] = useState(0);
  const [chargeCount, setChargeCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [channelBreakdown, setChannelBreakdown] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#1976d2', '#43a047', '#fb8500'],
      borderWidth: 0
    }]
  });
  const [dailyTrendData, setDailyTrendData] = useState({
    labels: [],
    datasets: [
      {
        label: 'โอนเข้า',
        data: [],
        backgroundColor: '#43a047',
        borderColor: '#43a047',
        borderWidth: 1
      },
      {
        label: 'โอนออก',
        data: [],
        backgroundColor: '#f44336',
        borderColor: '#f44336',
        borderWidth: 1
      }
    ]
  });

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchAccountDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching cards from:', `${api}/api/cards`);
        
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

        // เรียงลำดับและเลือกรายการล่าสุด 10 รายการ
        allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentTransactions(allTransactions.slice(0, 10));

        // คำนวณสถิติธุรกรรม
        const pending = allTransactions.filter(tx => tx.status === 'pending').length;
        const approved = allTransactions.filter(tx => tx.status === 'approved').length;
        const rejected = allTransactions.filter(tx => tx.status === 'rejected').length;
        
        setPendingTransactions(pending);
        setApprovedTransactions(approved);
        setRejectedTransactions(rejected);

        // คำนวณยอด topup และ charge
        const topupTotal = allTransactions.filter(tx => tx.type === 'topup').reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const chargeTotal = allTransactions.filter(tx => tx.type === 'charge').reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const topupTxCount = allTransactions.filter(tx => tx.type === 'topup').length;
        const chargeTxCount = allTransactions.filter(tx => tx.type === 'charge').length;
        
        setTopupAmount(topupTotal);
        setChargeAmount(chargeTotal);
        setTopupCount(topupTxCount);
        setChargeCount(chargeTxCount);

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

        console.log('Topup:', topupTotal, 'Charge:', chargeTotal);

        // สร้าง breakdown by channel
        const channelMap = {};
        allTransactions.forEach(tx => {
          const channel = tx.channel || 'Other';
          const amount = tx.amount || 0;
          channelMap[channel] = (channelMap[channel] || 0) + amount;
        });
        setChannelBreakdown({
          labels: Object.keys(channelMap),
          datasets: [{
            data: Object.values(channelMap),
            backgroundColor: ['#1976d2', '#43a047', '#fb8500', '#ff9800'],
            borderWidth: 0
          }]
        });

        // สร้าง daily trend (7 วันล่าสุด)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7Days.push(d.toISOString().split('T')[0]);
        }

        const topupTrend = last7Days.map(date => {
          return allTransactions.filter(tx => {
            const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
            return txDate === date && tx.type === 'topup';
          }).reduce((sum, tx) => sum + (tx.amount || 0), 0);
        });

        const chargeTrend = last7Days.map(date => {
          return allTransactions.filter(tx => {
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
              backgroundColor: '#43a047',
              borderColor: '#43a047',
              borderWidth: 1
            },
            {
              label: 'โอนออก',
              data: chargeTrend,
              backgroundColor: '#f44336',
              borderColor: '#f44336',
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

  if (loading) {
    return (
      <div className="account-dashboard-container">
        <div className="dashboard-loading">กำลังโหลดข้อมูล...</div>
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
          <h2>Dashboard</h2>
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
            <h5>ยอดคงเหลือรวม</h5>
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
        
        <div className="summary-card charge-card">
          <ChargeIcon />
          <div className="summary-info">
            <h5>โอนออกทั้งหมด</h5>
            <div className="summary-amount danger">฿{chargeAmount.toLocaleString()}</div>
            <p className="summary-label">{chargeCount} รายการ</p>
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

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h5 className="chart-title">การใช้งานตามช่องทาง</h5>
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
                x: { grid: { color: '#f0f0f0' } },
                y: {
                  grid: { color: '#f0f0f0' },
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
          <button 
            className="view-all-btn"
            onClick={() => navigate('/dashboard/account/alltransactions')}
          >
            ดูทั้งหมด →
          </button>
        </div>
        
        {recentTransactions.length > 0 ? (
          <div className="transactions-list">
            {recentTransactions.map((tx, idx) => (
              <div key={idx} className="transaction-item">
                <div className="transaction-icon">
                  {tx.type === 'topup' 
                    ? <ArrowDownLeft className="topup-icon" /> 
                    : <ArrowUpRight className="charge-icon" />
                  }
                </div>
                <div className="transaction-content">
                  <div className="transaction-label">
                    <span className="tx-type">{tx.type === 'topup' ? 'โอนเข้า' : 'โอนออก'}</span>
                    <span className="tx-channel">({tx.channel || 'Other'})</span>
                  </div>
                  <span className="tx-card">{tx.cardName || 'บัตร'}</span>
                </div>
                <div className="transaction-amount">
                  <span className={tx.type === 'topup' ? 'amount-topup' : 'amount-charge'}>
                    {tx.type === 'topup' ? '+' : '-'}{tx.amount.toLocaleString()}
                  </span>
                  <span className="tx-date">
                    {new Date(tx.createdAt).toLocaleDateString('th-TH', {
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
