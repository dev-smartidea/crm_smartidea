import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar3, ArrowLeft, CreditCard2BackFill, Google, Facebook, CashCoin, Clock, ArrowUpCircleFill, ArrowDownCircleFill } from 'react-bootstrap-icons';
import './AccountCardsPage.css';

export default function AccountCardDailySummaryPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [charges, setCharges] = useState([]);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | charge | topup
  const api = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/cards/daily-summary`, {
          params: { date: selectedDate },
          headers: { Authorization: `Bearer ${token}` }
        });
        setCharges(res.data.charges || []);
        setTopups(res.data.topups || []);
      } catch (err) {
        console.error('Failed to fetch daily summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [api, token, selectedDate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const totalCharge = charges.reduce((sum, c) => sum + c.amount, 0);
  const totalTopup = topups.reduce((sum, t) => sum + t.amount, 0);

  // Group charges by card
  const chargeByCard = {};
  charges.forEach(c => {
    const key = c.cardName || 'ไม่ระบุ';
    if (!chargeByCard[key]) chargeByCard[key] = { charge: 0, count: 0 };
    chargeByCard[key].charge += c.amount;
    chargeByCard[key].count += 1;
  });
  topups.forEach(t => {
    const key = t.cardName || 'ไม่ระบุ';
    if (!chargeByCard[key]) chargeByCard[key] = { charge: 0, count: 0 };
    chargeByCard[key].topup = (chargeByCard[key].topup || 0) + t.amount;
  });

  const filteredItems = activeTab === 'charge' ? charges
    : activeTab === 'topup' ? topups
    : [...charges, ...topups].sort((a, b) => new Date(b.chargedAt) - new Date(a.chargedAt));

  const quickDates = [
    { label: 'วันนี้', value: new Date().toISOString().split('T')[0] },
    { label: 'เมื่อวาน', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  ];

  return (
    <div className="cards-shell">
      {/* Header */}
      <div className="cards-hero">
        <button 
          className="cards-hero-icon" 
          onClick={() => navigate('/dashboard/account/cards')}
          title="กลับไปบัตร"
          aria-label="กลับไปหน้าบัตร"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="cards-title">สรุปรายการประจำวัน</h1>
          <p className="cards-subtitle">ข้อมูลตัดเงินจาก Transaction + เติมเงินจาก CardLedger</p>
        </div>
      </div>

      <div className="cards-surface">
        {/* Date Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '20px',
          padding: '12px 16px',
          background: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e5e5e5'
        }}>
          <Calendar3 size={16} style={{ color: '#737373' }} />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>วันที่:</span>
          {quickDates.map(d => (
            <button
              key={d.value}
              onClick={() => setSelectedDate(d.value)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: selectedDate === d.value ? '1px solid #171717' : '1px solid #e5e5e5',
                background: selectedDate === d.value ? '#171717' : '#fff',
                color: selectedDate === d.value ? '#fff' : '#525252',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {d.label}
            </button>
          ))}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '5px 10px',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              background: '#fff'
            }}
          />
        </div>

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            background: '#fef2f2'
          }}>
            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}>ยอดตัดรวม</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(totalCharge)}</div>
            <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>{charges.length} รายการ</div>
          </div>
          <div style={{
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #bbf7d0',
            background: '#f0fdf4'
          }}>
            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}>ยอดเติมรวม</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#22c55e' }}>{formatCurrency(totalTopup)}</div>
            <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>{topups.length} รายการ</div>
          </div>
          <div style={{
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff'
          }}>
            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}>ยอดสุทธิ</div>
            <div style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              color: totalTopup - totalCharge >= 0 ? '#3b82f6' : '#ef4444'
            }}>
              {totalTopup - totalCharge >= 0 ? '+' : ''}{formatCurrency(totalTopup - totalCharge)}
            </div>
            <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>เติม - ตัด</div>
          </div>
        </div>

        {/* Summary by Card */}
        {Object.keys(chargeByCard).length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#525252', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              สรุปตามบัตร
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {Object.entries(chargeByCard).map(([cardName, data]) => (
                <div key={cardName} style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e5e5',
                  background: '#fff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f5f5f5' }}>
                    <CreditCard2BackFill size={14} style={{ color: '#737373' }} />
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{cardName}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#737373' }}>ตัด:</span>
                      <span style={{ color: '#ef4444', fontWeight: '600' }}>-{formatCurrency(data.charge)}</span>
                    </div>
                    {data.topup > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#737373' }}>เติม:</span>
                        <span style={{ color: '#22c55e', fontWeight: '600' }}>+{formatCurrency(data.topup)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0',
          marginBottom: '16px',
          borderBottom: '1px solid #e5e5e5'
        }}>
          {[
            { key: 'all', label: `ทั้งหมด (${charges.length + topups.length})` },
            { key: 'charge', label: `ตัดเงิน (${charges.length})` },
            { key: 'topup', label: `เติมเงิน (${topups.length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: activeTab === tab.key ? '600' : '400',
                color: activeTab === tab.key ? '#171717' : '#737373',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #171717' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="cards-loading">
            <div className="cards-loading-spinner"></div>
            <div>กำลังโหลด...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{
            background: '#fafafa',
            border: '1px dashed #d4d4d4',
            borderRadius: '6px',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#737373'
          }}>
            <Calendar3 size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px' }}>ไม่มีรายการ</p>
            <p style={{ fontSize: '13px', margin: 0 }}>ลองเลือกวันอื่นดู</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e5e5e5' }}>
                  <th style={thStyle}>ประเภท</th>
                  <th style={thStyle}>บัตร</th>
                  <th style={thStyle}>บัญชี</th>
                  <th style={thStyle}>บริการ</th>
                  <th style={thStyle}>CID</th>
                  <th style={thStyle}>ธนาคาร</th>
                  <th style={thStyle}>เวลาตัด</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>จำนวนเงิน</th>
                  <th style={thStyle}>โดย</th>
                  <th style={thStyle}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, i) => (
                  <tr key={item._id + item.type} style={{
                    borderBottom: '1px solid #f0f0f0',
                    background: i % 2 === 1 ? '#fafafa' : '#fff'
                  }}>
                    <td style={tdStyle}>
                      {item.type === 'charge' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: '600', fontSize: '12px' }}>
                          <ArrowDownCircleFill size={14} /> ตัด
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontWeight: '600', fontSize: '12px' }}>
                          <ArrowUpCircleFill size={14} /> เติม
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: '500' }}>{item.cardName}</span>
                    </td>
                    <td style={tdStyle}>{item.accountName !== '-' ? item.accountName : ''}</td>
                    <td style={tdStyle}>
                      {item.channel !== '-' && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: item.channel === 'Google Ads' ? '#fef9c3' : item.channel === 'Facebook Ads' ? '#dbeafe' : '#f5f5f5',
                          color: item.channel === 'Google Ads' ? '#a16207' : item.channel === 'Facebook Ads' ? '#1d4ed8' : '#525252'
                        }}>
                          {item.channel === 'Google Ads' && <Google size={10} />}
                          {item.channel === 'Facebook Ads' && <Facebook size={10} />}
                          {item.channel === 'Google Ads' ? 'Google' : item.channel === 'Facebook Ads' ? 'Facebook' : item.channel}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{item.cid !== '-' ? item.cid : ''}</td>
                    <td style={tdStyle}>{item.bank !== '-' ? item.bank : ''}</td>
                    <td style={tdStyle}>
                      {item.cardTime && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#525252' }}>
                          <Clock size={11} /> {item.cardTime}
                        </span>
                      )}
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: '700',
                      fontFamily: 'monospace',
                      color: item.type === 'charge' ? '#ef4444' : '#22c55e'
                    }}>
                      {item.type === 'charge' ? '-' : '+'}{formatCurrency(item.amount)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: '#737373' }}>{item.chargedBy}</td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: '#737373', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e5e5e5', background: '#f5f5f5' }}>
                  <td colSpan="7" style={{ ...tdStyle, fontWeight: '600' }}>
                    รวม {filteredItems.length} รายการ
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                    {formatCurrency(filteredItems.reduce((sum, item) => sum + (item.type === 'charge' ? -item.amount : item.amount), 0))}
                  </td>
                  <td colSpan="2" style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '600',
  color: '#525252',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '8px 10px',
  whiteSpace: 'nowrap'
};
