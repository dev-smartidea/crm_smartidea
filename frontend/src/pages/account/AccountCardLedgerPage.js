import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Wallet, ArrowLeft, CheckCircle, DashCircle, Google, Facebook } from 'react-bootstrap-icons';
import toast from '../../utils/toast';
import '../shared/DashboardPage.css';
import '../user/AllTransactionPage.css';
import '../shared/ImageGalleryPage.css';
import '../user/TransactionHistoryPage.css';

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
    return new Date(date).toLocaleString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatAmount = (entry) => {
    const amt = entry.amount || 0;
    const sign = entry.direction === 'credit' ? '+' : '-';
    return `${sign}${amt.toLocaleString('th-TH')} บาท`;
  };

  const typeBadge = (entry) => {
    if (entry.type === 'topup') return <span className="badge badge-success">เติมเงิน</span>;
    return <span className="badge badge-danger">ตัดยอด</span>;
  };

  if (loading) {
    return (
      <div className="all-transaction-page fade-up">
        <div className="transaction-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="all-transaction-page fade-up">
      <div className="transaction-container">
        <div className="gallery-header" style={{ marginBottom: '10px' }}>
          <div className="gallery-header-title">
            <Wallet className="gallery-icon" />
            <div>
              <h2>ประวัติการตัดยอด / เติมเงิน</h2>
              <p className="gallery-subtitle">บัตร: {card?.displayName || `บัตรลงท้าย ${card?.last4 || ''}`}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
              <CheckCircle size={18} />
              <div>
                <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดเติมรวม</div>
                <div className="summary-value" style={{ fontSize: '0.95rem', color: '#16a34a' }}>
                  +{summary.credit.toLocaleString('th-TH')} ฿
                </div>
              </div>
            </div>
            <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
              <DashCircle size={18} />
              <div>
                <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดตัดรวม</div>
                <div className="summary-value" style={{ fontSize: '0.95rem', color: '#dc2626' }}>
                  -{summary.debit.toLocaleString('th-TH')} ฿
                </div>
              </div>
            </div>
            <button
              className="btn-slip-upload"
              style={{ padding: '10px 14px', minWidth: '110px' }}
              onClick={() => navigate('/dashboard/account/cards')}
              aria-label="กลับหน้าบัตร"
            >
              <ArrowLeft /> กลับหน้าบัตร
            </button>
            <button
              className="btn-slip-upload"
              style={{ padding: '10px 14px', minWidth: '140px' }}
              onClick={downloadCsv}
              aria-label="ดาวน์โหลด CSV"
            >
              📥 ดาวน์โหลด CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '0.85rem', background: '#fff' }}
            aria-label="กรองประเภท"
          >
            <option value="">ทุกประเภท</option>
            <option value="topup">เติมเงิน</option>
            <option value="charge">ตัดยอด</option>
          </select>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '0.85rem', background: '#fff' }}
            aria-label="กรองช่องทาง"
          >
            <option value="">ทุกช่องทาง</option>
            {channelOptions.map(ch => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '0.85rem' }}
            aria-label="วันที่เริ่มต้น"
          />
          <span style={{ color: '#737373', fontSize: '0.85rem' }}>ถึง</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #e5e5e5', fontSize: '0.85rem' }}
            aria-label="วันที่สิ้นสุด"
          />
          {(filterType || filterChannel || dateFrom || dateTo) && (
            <button
              onClick={() => { setFilterType(''); setFilterChannel(''); setDateFrom(''); setDateTo(''); }}
              style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#737373' }}
            >
              ล้างตัวกรอง
            </button>
          )}
          <span style={{ color: '#737373', fontSize: '0.8rem', marginLeft: 'auto' }}>
            แสดง {filteredLedger.length} / {ledger.length} รายการ
          </span>
        </div>

        {error && (
          <div className="alert" style={{ background: '#fef2f2', color: '#dc2626', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div className="transactions-section">
          {filteredLedger.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>{ledger.length === 0 ? 'ยังไม่มีประวัติรายการ' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th scope="col">วันที่</th>
                    <th scope="col">ประเภท</th>
                    <th scope="col">CID</th>
                    <th scope="col">ช่องทาง</th>
                    <th scope="col">อ้างอิง</th>
                    <th scope="col">จำนวนเงิน</th>
                    <th scope="col">รายละเอียด</th>
                    <th scope="col">ยอดหลังรายการ</th>
                    <th scope="col">ผู้ทำรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{typeBadge(entry)}</td>
                      <td>{entry.serviceId?.cid || '-'}</td>
                      <td>
                        <span className={`service-badge ${
                          entry.channel === 'Facebook Ads' ? 'facebook' :
                          entry.channel === 'Google Ads' ? 'google' : 'other'
                        }`}>
                          {entry.channel === 'Facebook Ads' && <Facebook className="service-icon" />}
                          {entry.channel === 'Google Ads' && <Google className="service-icon" />}
                          <span className="service-id-text">{entry.channel || '-'}</span>
                        </span>
                      </td>
                      <td>{entry.reference || '-'}</td>
                      <td>
                        <span style={{ color: entry.direction === 'credit' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {formatAmount(entry)}
                        </span>
                      </td>
                      <td>
                        {entry.breakdowns && entry.breakdowns.length > 0 ? (
                          <div style={{ fontSize: '0.78rem', lineHeight: '1.6' }}>
                            {entry.breakdowns.map((bd, idx) => (
                              <div key={idx}>
                                {bd.label || bd.code}: <strong>{bd.amount?.toLocaleString('th-TH')}</strong> ฿
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td>{entry.balanceAfter?.toLocaleString('th-TH')} ฿</td>
                      <td>{entry.createdBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
