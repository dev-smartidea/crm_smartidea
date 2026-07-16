import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar3, ArrowLeft, CreditCard2BackFill, Google, Facebook, Clock, ArrowUpCircleFill, ArrowDownCircleFill } from 'react-bootstrap-icons';
import { formatCurrency } from '../../utils/transactionHelpers';
import './AccountCardsPage.css';

export default function AccountCardDailySummaryPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRange, setSelectedRange] = useState(null); // { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  const [charges, setCharges] = useState([]);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all | charge | topup
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const api = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem('token');

  // helper: get array of YYYY-MM-DD between two dates inclusive
  const getDatesBetween = (startDate, endDate) => {
    const res = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (cur <= end) {
      res.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return res;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (selectedRange && selectedRange.start && selectedRange.end) {
          const dates = getDatesBetween(selectedRange.start, selectedRange.end);
          const requests = dates.map(d => axios.get(`${api}/api/cards/daily-summary`, {
            params: { date: d }, headers: { Authorization: `Bearer ${token}` }
          }));
          const results = await Promise.all(requests);
          let allCharges = [];
          let allTopups = [];
          results.forEach(r => {
            allCharges = allCharges.concat(r.data.charges || []);
            allTopups = allTopups.concat(r.data.topups || []);
          });
          setCharges(allCharges);
          setTopups(allTopups);
        } else {
          const res = await axios.get(`${api}/api/cards/daily-summary`, {
            params: { date: selectedDate },
            headers: { Authorization: `Bearer ${token}` }
          });
          setCharges(res.data.charges || []);
          setTopups(res.data.topups || []);
        }
      } catch (err) {
        // error handled by empty state UI
        setCharges([]);
        setTopups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [api, token, selectedDate, selectedRange]);

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
    : [...charges, ...topups].sort((a, b) => new Date(b.chargedAt || b.createdAt) - new Date(a.chargedAt || a.createdAt));

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedDate, selectedRange]);

  // If filteredItems length changes such that currentPage is out of range, clamp it
  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
    } else if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  // quick filters: single date or range ({start,end})
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  // week: start = Monday
  const getWeekStart = (d) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0 ? -6 : 1 - day); // adjust so Monday is start
    date.setDate(date.getDate() + diff);
    return date.toISOString().split('T')[0];
  };
  const getWeekEnd = (d) => {
    const start = new Date(getWeekStart(d));
    start.setDate(start.getDate() + 6);
    return start.toISOString().split('T')[0];
  };
  const getMonthStart = (d) => {
    const date = new Date(d);
    date.setDate(1);
    return date.toISOString().split('T')[0];
  };
  const getMonthEnd = (d) => {
    const date = new Date(d);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    return date.toISOString().split('T')[0];
  };

  const quickDates = [
    { label: 'วันนี้', value: todayStr },
    { label: 'เมื่อวาน', value: yesterdayStr },
    { label: 'สัปดาห์นี้', range: { start: getWeekStart(todayStr), end: getWeekEnd(todayStr) } },
    { label: 'สัปดาห์ที่แล้ว', range: (() => { const d = new Date(); d.setDate(d.getDate() - 7); const s = getWeekStart(d.toISOString().split('T')[0]); return { start: s, end: getWeekEnd(s) }; })() },
    { label: 'เดือนนี้', range: { start: getMonthStart(todayStr), end: getMonthEnd(todayStr) } },
    { label: 'เดือนที่แล้ว', range: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); const s = getMonthStart(d.toISOString().split('T')[0]); return { start: s, end: getMonthEnd(s) }; })() }
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
          {quickDates.map((d, idx) => {
            const isRange = !!d.range;
            const isActive = isRange
              ? (selectedRange && selectedRange.start === d.range.start && selectedRange.end === d.range.end)
              : selectedDate === d.value && !selectedRange;
            return (
              <button
                key={d.label + idx}
                onClick={() => {
                  if (isRange) {
                    setSelectedRange(d.range);
                    setSelectedDate(d.range.start);
                  } else {
                    setSelectedRange(null);
                    setSelectedDate(d.value);
                  }
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: isActive ? '1px solid #171717' : '1px solid #e5e5e5',
                  background: isActive ? '#171717' : '#fff',
                  color: isActive ? '#fff' : '#525252',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {d.label}
              </button>
            );
          })}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedRange(null); setSelectedDate(e.target.value); }}
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
                {paginatedItems.map((item, i) => (
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
                    รวม {filteredItems.length} รายการ (หน้า {currentPage}/{totalPages})
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d4d4d4', background: currentPage === 1 ? '#f5f5f5' : '#fff', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 13 }}
            >«</button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d4d4d4', background: currentPage === 1 ? '#f5f5f5' : '#fff', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 13 }}
            >‹ ก่อนหน้า</button>
            <span style={{ fontSize: 13, color: '#525252', padding: '0 8px' }}>หน้า {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d4d4d4', background: currentPage === totalPages ? '#f5f5f5' : '#fff', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 13 }}
            >ถัดไป ›</button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d4d4d4', background: currentPage === totalPages ? '#f5f5f5' : '#fff', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 13 }}
            >»</button>
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
  whiteSpace: 'normal',
  wordBreak: 'break-word'
};

const tdStyle = {
  padding: '8px 10px',
  whiteSpace: 'normal',
  wordBreak: 'break-word'
};
