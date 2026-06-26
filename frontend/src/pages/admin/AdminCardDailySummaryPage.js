import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Calendar3, CreditCard2BackFill, Google, Facebook, Clock } from 'react-bootstrap-icons';
import { formatCurrency } from '../../utils/transactionHelpers';
import './AdminDashboardPage.css';

export default function AdminCardDailySummaryPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterCard, setFilterCard] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const itemsPerPage = 50;
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
      } catch (err) {
        // error handled by empty state UI
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [api, token, selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, filterCard, filterChannel]);

  // Filtered charges
  const filteredCharges = useMemo(() => {
    return charges.filter(c => {
      if (filterCard !== 'all' && c.cardName !== filterCard) return false;
      if (filterChannel !== 'all' && c.channel !== filterChannel) return false;
      return true;
    });
  }, [charges, filterCard, filterChannel]);

  const totalCharge = filteredCharges.reduce((sum, c) => sum + c.amount, 0);

  // Group by card (from filtered data)
  const chargeByCard = {};
  filteredCharges.forEach(c => {
    const key = c.cardName || 'ไม่ระบุ';
    if (!chargeByCard[key]) chargeByCard[key] = { charge: 0, count: 0 };
    chargeByCard[key].charge += c.amount;
    chargeByCard[key].count += 1;
  });

  // Unique card names from charges for filter
  const cardOptions = useMemo(() => {
    const names = [...new Set(charges.map(c => c.cardName).filter(Boolean))];
    return names.sort();
  }, [charges]);

  const totalPages = Math.ceil(filteredCharges.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCharges.slice(start, start + itemsPerPage);
  }, [filteredCharges, currentPage]);

  const quickDates = [
    { label: 'วันนี้', value: new Date().toISOString().split('T')[0] },
    { label: 'เมื่อวาน', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  ];

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="ledger-header">
        <div className="ledger-header-title">
          <CreditCard2BackFill className="ledger-icon" />
          <div>
            <h2>สรุปรายการตัดบัตรประจำวัน</h2>
            <p className="ledger-subtitle">ข้อมูลการตัดเงินจากบัตร (เฉพาะ Charge/Cut)</p>
          </div>
        </div>
      </div>

      <div className="ledger-table-container" style={{ padding: '16px' }}>
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
            border: '1px solid #bfdbfe',
            background: '#eff6ff'
          }}>
            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}>จำนวนบัตรที่ถูกตัด</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#3b82f6' }}>{Object.keys(chargeByCard).length}</div>
            <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>บัตร</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#737373' }}>จำนวนครั้ง:</span>
                      <span style={{ fontWeight: '600' }}>{data.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {charges.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            padding: '10px 16px',
            background: '#fafafa',
            borderRadius: '6px',
            border: '1px solid #e5e5e5'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#525252' }}>กรอง:</span>
            <select
              value={filterCard}
              onChange={(e) => setFilterCard(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #d4d4d4',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              <option value="all">ทุกบัตร</option>
              {cardOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #d4d4d4',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              <option value="all">ทุกบริการ</option>
              <option value="Google Ads">Google Ads</option>
              <option value="Facebook Ads">Facebook Ads</option>
              <option value="Other">อื่นๆ</option>
            </select>
            {(filterCard !== 'all' || filterChannel !== 'all') && (
              <span style={{ fontSize: '12px', color: '#737373' }}>
                (พบ {filteredCharges.length} รายการ)
              </span>
            )}
            {(filterCard !== 'all' || filterChannel !== 'all') && (
              <button
                onClick={() => { setFilterCard('all'); setFilterChannel('all'); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #d4d4d4',
                  background: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#ef4444'
                }}
              >
                ล้างกรอง
              </button>
            )}
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <div className="ledger-loading">กำลังโหลด...</div>
        ) : charges.length === 0 ? (
          <div className="ledger-empty">
            <Calendar3 size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontWeight: '600', marginBottom: '4px' }}>ไม่มีรายการตัดบัตรในวันนี้</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-placeholder)' }}>ลองเลือกวันอื่นดู</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>บัตร</th>
                    <th>ยอดในบัตรก่อนตัด</th>
                    <th>บริการ</th>
                    <th>CID</th>
                    <th>เวลาตัด</th>
                    <th>จำนวนเงิน</th>
                    <th>ยอดคงเหลือหลังตัด</th>
                    <th>โดย</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, i) => (
                    <tr key={item._id} style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: i % 2 === 1 ? '#fafafa' : '#fff'
                    }}>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: '#9ca3af' }}>
                        {(currentPage - 1) * itemsPerPage + i + 1}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {item.cardName}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {item.balanceBefore !== null ? formatCurrency(item.balanceBefore) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
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
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {item.cid !== '-' ? item.cid : ''}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {item.cardTime && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#525252' }}>
                            <Clock size={11} /> {item.cardTime}
                          </span>
                        )}
                      </td>
                      <td style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        color: '#ef4444',
                        whiteSpace: 'nowrap'
                      }}>
                        -{formatCurrency(item.amount)}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {item.balanceAfter !== undefined ? formatCurrency(item.balanceAfter) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: '#737373', whiteSpace: 'nowrap' }}>
                        {item.chargedBy}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: '12px', color: '#737373', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0f4ff', fontWeight: 700, borderTop: '2px solid #c7d2fe', fontSize: 12 }}>
                    <td colSpan="6" style={{ padding: '8px 10px', color: '#3730a3' }}>
                      รวม {filteredCharges.length} รายการ (หน้า {currentPage}/{totalPages})
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444', fontFamily: 'monospace', fontWeight: '700' }}>
                      {formatCurrency(paginatedItems.reduce((sum, item) => sum + item.amount, 0))}
                    </td>
                    <td colSpan="3" style={{ padding: '8px 10px' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="ledger-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >«</button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >‹ ก่อนหน้า</button>
                <span className="pagination-info">
                  หน้า {currentPage} / {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >ถัดไป ›</button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >»</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}