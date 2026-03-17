import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar3, ArrowLeft, CreditCard2BackFill, Google, Facebook, CashCoin, Clock } from 'react-bootstrap-icons';
import './AccountCardsPage.css';

export default function AccountCardDailySummaryPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const api = process.env.REACT_APP_API_URL;

  // Fetch all cards
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await axios.get(`${api}/api/cards`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setCards(res.data || []);
      } catch (err) {
        console.error('Failed to fetch cards:', err);
      }
    };
    fetchCards();
  }, [api]);

  // Fetch ledger data for selected date
  useEffect(() => {
    const fetchDailyLedger = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/cards/ledger/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Filter by selected date
        const filtered = (res.data || []).filter(entry => {
          const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];
          return entryDate === selectedDate;
        });

        setLedgerData(filtered);
      } catch (err) {
        console.error('Failed to fetch ledger:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyLedger();
  }, [api, selectedDate]);

  const getCardName = (cardId) => {
    const card = cards.find(c => c._id === cardId);
    return card ? card.displayName : 'ไม่ระบุ';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  const formatTime = (datetime) => {
    return new Date(datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate summary
  const summary = {
    totalCharge: ledgerData.filter(l => l.type === 'charge').reduce((sum, l) => sum + l.amount, 0),
    totalTopup: ledgerData.filter(l => l.type === 'topup').reduce((sum, l) => sum + l.amount, 0),
    byCard: {}
  };

  ledgerData.forEach(entry => {
    const cardName = getCardName(entry.cardId);
    if (!summary.byCard[cardName]) {
      summary.byCard[cardName] = { charge: 0, topup: 0 };
    }
    if (entry.type === 'charge') {
      summary.byCard[cardName].charge += entry.amount;
    } else {
      summary.byCard[cardName].topup += entry.amount;
    }
  });

  return (
    <div className="cards-shell">
      {/* Header */}
      <div className="cards-hero">
        <button 
          className="cards-hero-icon" 
          onClick={() => navigate('/dashboard/account/cards')}
          style={{ cursor: 'pointer', border: 'none' }}
          title="กลับไปบัตร"
          aria-label="กลับไปหน้าบัตร"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="cards-title">สรุปรายการประจำวัน</h1>
          <p className="cards-subtitle">ดูประวัติการใช้งานบัตรย้อนหลังรายวัน</p>
        </div>
      </div>

      <div className="cards-surface">
        {/* Date Selector */}
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          background: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e5e5e5'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            fontSize: '14px', 
            fontWeight: '600',
            color: '#171717'
          }}>
            <Calendar3 size={18} />
            <span>เลือกวันที่:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                background: '#fff'
              }}
            />
          </label>
        </div>

        {/* Summary Cards */}
        <div className="cards-summary-grid" style={{ marginBottom: '20px' }}>
          <div className="summary-tile" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
            <div className="summary-label">ยอดตัดรวม</div>
            <div className="summary-value" style={{ color: '#ef4444' }}>{formatCurrency(summary.totalCharge)}</div>
            <div className="summary-note">{ledgerData.filter(l => l.type === 'charge').length} รายการ</div>
          </div>
          <div className="summary-tile" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div className="summary-label">ยอดเติมรวม</div>
            <div className="summary-value" style={{ color: '#22c55e' }}>{formatCurrency(summary.totalTopup)}</div>
            <div className="summary-note">{ledgerData.filter(l => l.type === 'topup').length} รายการ</div>
          </div>
          <div className="summary-tile" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div className="summary-label">ยอดสุทธิ</div>
            <div className="summary-value" style={{ color: '#3b82f6' }}>{formatCurrency(summary.totalTopup - summary.totalCharge)}</div>
            <div className="summary-note">เติม - ตัด</div>
          </div>
        </div>

        {/* Summary by Card */}
        {Object.keys(summary.byCard).length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px', 
              color: '#171717',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              สรุปตามบัตร
            </h3>
            <div className="cards-grid">
              {Object.entries(summary.byCard).map(([cardName, data]) => (
                <div key={cardName} className="card-panel" style={{ padding: '14px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    marginBottom: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e5e5e5'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'grid',
                      placeItems: 'center',
                      background: '#171717',
                      color: '#fff'
                    }}>
                      <CreditCard2BackFill size={16} />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#171717' }}>{cardName}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#737373' }}>ตัดยอด:</span>
                      <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatCurrency(data.charge)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#737373' }}>เติมเงิน:</span>
                      <span style={{ color: '#22c55e', fontWeight: '600' }}>{formatCurrency(data.topup)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger Entries */}
        <div>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            marginBottom: '12px', 
            color: '#171717',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            รายการทั้งหมด ({ledgerData.length})
          </h3>

          {loading ? (
            <div className="cards-loading">
              <div className="cards-loading-spinner"></div>
              <div>กำลังโหลด...</div>
            </div>
          ) : ledgerData.length === 0 ? (
            <div style={{
              background: '#fafafa',
              border: '1px dashed #d4d4d4',
              borderRadius: '8px',
              padding: '48px 24px',
              textAlign: 'center',
              color: '#737373'
            }}>
              <Calendar3 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>ไม่มีรายการในวันนี้</p>
              <p style={{ fontSize: '13px' }}>ลองเลือกวันอื่นดู</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ledgerData.map((entry) => (
                <div key={entry._id} className="card-panel" style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: '14px',
                  alignItems: 'center',
                  padding: '14px'
                }}>
                  {/* Icon */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '6px',
                    display: 'grid',
                    placeItems: 'center',
                    background: entry.type === 'charge' ? '#fef2f2' : '#f0fdf4',
                    color: entry.type === 'charge' ? '#ef4444' : '#22c55e',
                    border: `1px solid ${entry.type === 'charge' ? '#fecaca' : '#bbf7d0'}`
                  }}>
                    {entry.type === 'charge' ? <CreditCard2BackFill size={20} /> : <CashCoin size={20} />}
                  </div>

                  {/* Details */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: '#171717' }}>
                        {getCardName(entry.cardId)}
                      </span>
                      {entry.channel && (
                        <span className={`chip ${
                          entry.channel === 'Google Ads' ? 'google' : 
                          entry.channel === 'Facebook Ads' ? 'facebook' : 'other'
                        }`} style={{ fontSize: '12px', padding: '3px 8px' }}>
                          {entry.channel === 'Google Ads' && <Google size={12} />}
                          {entry.channel === 'Facebook Ads' && <Facebook size={12} />}
                          <span style={{ marginLeft: entry.channel === 'Google Ads' || entry.channel === 'Facebook Ads' ? '4px' : '0' }}>
                            {entry.channel}
                          </span>
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#737373', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {entry.chargeTime && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          <span>{entry.chargeTime}</span>
                        </div>
                      )}
                      {entry.serviceId && (
                        <div>บริการ: <span style={{ fontWeight: '500', color: '#525252' }}>{entry.serviceId}</span></div>
                      )}
                      {entry.reference && (
                        <div>อ้างอิง: <span style={{ fontWeight: '500', color: '#525252' }}>{entry.reference}</span></div>
                      )}
                    </div>

                    {entry.note && (
                      <div style={{
                        marginTop: '8px',
                        padding: '6px 10px',
                        background: '#fafafa',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#525252',
                        border: '1px solid #e5e5e5'
                      }}>
                        📝 {entry.note}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div style={{
                    textAlign: 'right',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    letterSpacing: '-0.02em',
                    color: entry.type === 'charge' ? '#ef4444' : '#22c55e'
                  }}>
                    {entry.type === 'charge' ? '-' : '+'}{formatCurrency(entry.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
