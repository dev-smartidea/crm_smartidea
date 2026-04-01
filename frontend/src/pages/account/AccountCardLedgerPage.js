import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Wallet, ArrowLeft, Download, Funnel } from 'react-bootstrap-icons';
import toast from '../../utils/toast';
import './AccountCardsPage.css';
import './AccountCardLedgerPage.css';
import './AccountLedgerPage.css';

export default function AccountCardLedgerPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const channelOptions = useMemo(() => {
    const set = new Set(ledger.map(e => e.channel).filter(Boolean));
    return [...set].sort();
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      if (filterType && entry.type !== filterType) return false;
      if (filterChannel && entry.channel !== filterChannel) return false;
      if (dateFrom) {
        const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];
        if (entryDate > dateTo) return false;
      }
      return true;
    });
  }, [ledger, filterType, filterChannel, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
  const paginatedLedger = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLedger.slice(start, start + itemsPerPage);
  }, [filteredLedger, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterChannel, dateFrom, dateTo]);

  const downloadCsv = () => {
    if (filteredLedger.length === 0) {
      toast.error('ไม่มีข้อมูลให้ดาวน์โหลด');
      return;
    }
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const header = ['Date','Type','Direction','Amount','Channel','CID','Reference','Note','BalanceAfter','CreatedBy'];
    const rows = filteredLedger.map(l => [
      new Date(l.createdAt).toISOString(),
      l.type || '',
      l.direction || '',
      l.amount || 0,
      l.channel || '',
      l.serviceId?.cid || '',
      l.reference || '',
      l.note || '',
      l.balanceAfter || 0,
      l.createdBy?.name || ''
    ]);
    const csv = [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `card_ledger_${card?.last4 || cardId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = useMemo(() => {
    const credit = filteredLedger.filter(l => l.direction === 'credit').reduce((s, l) => s + (l.amount || 0), 0);
    const debit = filteredLedger.filter(l => l.direction === 'debit').reduce((s, l) => s + (l.amount || 0), 0);
    return { credit, debit };
  }, [filteredLedger]);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/cards/${cardId}/ledger`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCard(res.data.card || null);
        setLedger(res.data.ledger || []);
        setError('');
      } catch (e) {
        setError(e?.response?.data?.error || 'โหลดประวัติไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [api, cardId, token]);

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const hasActiveFilters = filterType || filterChannel || dateFrom || dateTo;

  const setQuickDateFilter = (type) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (type) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        startDate = last7.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);
        startDate = last30.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      default:
        break;
    }

    setDateFrom(startDate);
    setDateTo(endDate);
  };

  return (
    <div className="cards-shell">
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
          <h1 className="cards-title">สรุปรายการบัตร — ประวัติการตัดยอด / เติมเงิน</h1>
          <p className="cards-subtitle">บัตร: {card?.displayName || `ลงท้าย ${card?.last4 || ''}`} {card ? `— ยอดคงเหลือ ${(card.balance || 0).toLocaleString()} บาท` : ''}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-export" onClick={downloadCsv}><Download /> ดาวน์โหลด CSV</button>
          <button className="btn-filter" onClick={() => setShowFilters(!showFilters)}><Funnel /> ตัวกรอง</button>
        </div>
      </div>

      <div className="cards-surface">
        {error && (
          <div style={{ margin: '8px 0', color: 'red', fontSize: 13 }}>{error}</div>
        )}
        {showFilters && (
          <div className="ledger-filters">
            <div className="quick-date-filters">
              <label className="quick-filter-label">ช่วงเวลา:</label>
              <div className="quick-filter-buttons">
                <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('today')}>วันนี้</button>
                <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('yesterday')}>เมื่อวาน</button>
                <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('last7days')}>7 วันล่าสุด</button>
                <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('last30days')}>30 วันล่าสุด</button>
                <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('thisMonth')}>เดือนนี้</button>
              </div>
            </div>

            <div className="filters-form">
              <div className="filter-row">
                <div className="filter-group">
                  <label>ประเภท</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">ทุกประเภท</option>
                    <option value="topup">เติมเงิน</option>
                    <option value="charge">ตัดยอด</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>ช่องทาง</label>
                  <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
                    <option value="">ทุกช่องทาง</option>
                    {channelOptions.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>จาก</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                  <label>ถึง</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="filter-actions">
                <button className="btn-clear" onClick={() => { setFilterType(''); setFilterChannel(''); setDateFrom(''); setDateTo(''); }} disabled={!hasActiveFilters}>ล้าง</button>
                <button className="btn-search" onClick={() => { /* already filtered by state */ }}>ค้นหา</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ padding: 12, borderRadius: 6, border: '1px solid #eaeaea', background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>ยอดเติมรวม</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#16a34a' }}>+{summary.credit.toLocaleString()} ฿</div>
          </div>
          <div style={{ padding: 12, borderRadius: 6, border: '1px solid #eaeaea', background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>ยอดตัดรวม</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#dc2626' }}>-{summary.debit.toLocaleString()} ฿</div>
          </div>
          <div style={{ padding: 12, borderRadius: 6, border: '1px solid #eaeaea', background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#737373', marginBottom: 6 }}>สุทธิ</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{(summary.credit - summary.debit).toLocaleString()} ฿</div>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="cards-loading">
              <div className="cards-loading-spinner"></div>
              <div>กำลังโหลด...</div>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div style={{ background: '#fafafa', border: '1px dashed #d4d4d4', borderRadius: 6, padding: '48px 24px', textAlign: 'center', color: '#737373' }}>
              <Wallet size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{ledger.length === 0 ? 'ยังไม่มีประวัติรายการ' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}</p>
              <p style={{ fontSize: 13, margin: 0 }}>ลองปรับตัวกรองหรือเลือกช่วงวันที่อื่น</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e5e5e5' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>วันที่โอน</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>ประเภท</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>CID</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>ช่องทาง</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>อ้างอิง</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>จำนวนเงิน</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>รายละเอียด</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>ยอดหลังรายการ</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>โดย</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedger.map((entry, i) => (
                    <tr key={entry._id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatDate(entry.createdAt)} {formatTime(entry.createdAt)}</td>
                      <td style={{ padding: '8px 10px' }}>{entry.type === 'topup' ? <span style={{ color: '#16a34a', fontWeight: 600 }}>เติมเงิน</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>ตัดยอด</span>}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{entry.serviceId?.cid || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{entry.channel || '-'}</td>
                      <td style={{ padding: '8px 10px' }}>{entry.reference || '-'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: entry.direction === 'debit' ? '#dc2626' : '#16a34a' }}>{entry.direction === 'debit' ? '-' : '+'}{(entry.amount || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.note}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{(entry.balanceAfter || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px' }}>{entry.createdBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e5e5', background: '#f5f5f5' }}>
                    <td colSpan="5" style={{ padding: '8px 10px', fontWeight: 600 }}>รวม {filteredLedger.length} รายการ (หน้า {currentPage}/{totalPages})</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{(summary.credit - summary.debit).toLocaleString()}</td>
                    <td colSpan="3" style={{ padding: '8px 10px' }}></td>
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
    </div>
  );
}
