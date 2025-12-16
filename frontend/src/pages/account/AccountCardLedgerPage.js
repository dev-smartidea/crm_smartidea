import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Wallet, ArrowLeft, CheckCircle, DashCircle, Google, Facebook } from 'react-bootstrap-icons';
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
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const downloadCsv = async () => {
    try {
      const url = `${api}/api/cards/${cardId}/ledger/export`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) {
        throw new Error('ดาวน์โหลดไฟล์ไม่สำเร็จ');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      const filename = `card_ledger_${card?.last4 || cardId}.csv`;
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert(e.message || 'ดาวน์โหลดไฟล์ไม่สำเร็จ');
    }
  };

  const summary = useMemo(() => {
    const credit = ledger.filter(l => l.direction === 'credit').reduce((s, l) => s + (l.amount || 0), 0);
    const debit = ledger.filter(l => l.direction === 'debit').reduce((s, l) => s + (l.amount || 0), 0);
    return { credit, debit };
  }, [ledger]);

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
            >
              <ArrowLeft /> กลับหน้าบัตร
            </button>
            <button
              className="btn-slip-upload"
              style={{ padding: '10px 14px', minWidth: '140px' }}
              onClick={downloadCsv}
            >
              📥 ดาวน์โหลด CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="alert" style={{ background: '#fef2f2', color: '#dc2626', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div className="transactions-section">
          {ledger.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>ยังไม่มีประวัติรายการ</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>ประเภท</th>
                    <th>ช่องทาง</th>
                    <th>อ้างอิง</th>
                    <th>จำนวนเงิน</th>
                    <th>ยอดหลังรายการ</th>
                    <th>ผู้ทำรายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{typeBadge(entry)}</td>
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
