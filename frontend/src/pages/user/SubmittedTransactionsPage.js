import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wallet, CashCoin, Google, Facebook, Eye, CheckCircleFill, XCircleFill, ClockFill, Upload } from 'react-bootstrap-icons';
import './AllTransactionPage.css';
import '../shared/DashboardPage.css';
import '../shared/ImageGalleryPage.css';

export default function SubmittedTransactionsPage() {
  const [activeTab, setActiveTab] = useState('submitted'); // submitted, approved, rejected
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${api}/api/transactions?submissionStatus=${activeTab}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = (res.data.transactions || []).map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        customer: tx.serviceId?.customerId || {}
      }));
      setTransactions(formatted);
      setCurrentPage(1);
    } catch (err) {
      console.error('Load submitted transactions failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  // ====== Slip upload handlers (allow upload only in submitted tab) ======
  const triggerUploadFor = (txId) => {
    const el = document.getElementById(`submitted-slip-input-${txId}`);
    if (el) el.click();
  };

  const handleInlineSlipChange = async (txId, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }
    try {
      setUploadingId(txId);
      const formData = new FormData();
      formData.append('slipImage', file);
      const res = await axios.put(`${api}/api/transactions/${txId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update local list
      setTransactions(prev => prev.map(t => (t._id === txId ? {
        ...res.data,
        service: res.data.serviceId || {},
        customer: res.data.serviceId?.customerId || {}
      } : t)));
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'อัปโหลดสลิปไม่สำเร็จ';
      alert(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('th-TH');
  };

  const getBankBadgeClass = (bank) => {
    const bankMap = {
      'KBANK': 'badge-bank-kbank',
      'SCB': 'badge-bank-scb',
      'BBL': 'badge-bank-bbl',
      'KTB': 'badge-bank-ktb',
      'TTB': 'badge-bank-ttb',
      'BAY': 'badge-bank-bay'
    };
    return bankMap[bank] || 'badge-bank';
  };

  const getBankName = (bank) => {
    const bankNames = {
        'KBANK': 'KBANK',
        'SCB': 'SCB',
        'BBL': 'BBL',
        'KTB': 'KTB',
        'TTB': 'TTB',
        'BAY': 'BAY'
    };
    return bankNames[bank] || bank;
  };

  const breakdownCodeLabels = {
    '11': 'ค่าคลิก',
    '12': 'Vat ค่าคลิก',
    '13': 'Vat ค่าบริการ',
    '14': 'ค่าบริการ Google',
    '15': 'ค่าบริการบางส่วน',
    '16': 'คูปอง Google'
  };

  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const getTabLabel = (tab) => {
    const labels = {
      'submitted': 'รอการอนุมัติ',
      'approved': 'อนุมัติแล้ว',
      'rejected': 'รายการที่ถูกปฏิเสธ'
    };
    return labels[tab] || tab;
  };

  const getTabIcon = (tab) => {
    if (tab === 'submitted') return <ClockFill size={16} />;
    if (tab === 'approved') return <CheckCircleFill size={16} />;
    if (tab === 'rejected') return <XCircleFill size={16} />;
    return null;
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
        {/* Header */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <Wallet className="gallery-icon" />
            <div>
              <h2>รายการที่ส่งบัญชี</h2>
              <p className="gallery-subtitle">ติดตามสถานะรายการที่ส่งให้ทีมบัญชีพิจารณา</p>
            </div>
          </div>
          {transactions.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                <CashCoin size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวม</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                    {formatCurrency(totalAmount)}
                  </div>
                </div>
              </div>
              <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
                <Wallet size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>จำนวนรายการ</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>{transactions.length} รายการ</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs-container" style={{ 
          background: '#fff', 
          borderRadius: '12px', 
          padding: '8px', 
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '8px'
        }}>
          {['submitted', 'approved', 'rejected'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px 20px',
                border: 'none',
                background: activeTab === tab ? '#3b82f6' : 'transparent',
                color: activeTab === tab ? '#fff' : '#64748b',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? '600' : '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                fontSize: '0.95rem',
                boxShadow: activeTab === tab ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.background = '#f1f5f9';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {getTabIcon(tab)}
              <span>{getTabLabel(tab)}</span>
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        <div className="transactions-section">
          {transactions.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>ไม่มีรายการ{getTabLabel(activeTab)}</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>วันที่โอน</th>
                      <th>ลูกค้า</th>
                      <th>บริการ</th>
                      <th>จำนวนเงิน</th>
                      <th>ธนาคาร</th>
                      <th>สลิป</th>
                      <th>หมายเหตุ</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(tx => (
                      <tr key={tx._id}>
                        <td>{formatDate(tx.transactionDate)}</td>
                        <td>
                          <div className="customer-info">
                            <span className="customer-name">{tx.customer?.name || '-'}</span>
                          </div>
                        </td>
                        <td>
                          {tx.service?.customerIdField && tx.service?.name ? (
                            <span className={`service-badge ${
                              tx.service.name === 'Facebook Ads' ? 'facebook' :
                              tx.service.name === 'Google Ads' ? 'google' :
                              'other'
                            }`}>
                              {tx.service.name === 'Facebook Ads' && <Facebook className="service-icon" />}
                              {tx.service.name === 'Google Ads' && <Google className="service-icon" />}
                              <span className="service-id-text">{tx.service.customerIdField}</span>
                            </span>
                          ) : activeTab === 'submitted' ? (
                            <>
                              <button
                                className="btn-slip-upload"
                                onClick={() => triggerUploadFor(tx._id)}
                                disabled={uploadingId === tx._id}
                                title={uploadingId === tx._id ? 'กำลังอัปโหลดไฟล์สลิป...' : 'อัปโหลดสลิปโอนเงิน'}
                              >
                                {uploadingId === tx._id ? <span className="spinner" /> : <Upload />}
                                {uploadingId === tx._id ? 'กำลังอัปโหลด...' : 'เพิ่มสลิป'}
                              </button>
                              <input
                                id={`submitted-slip-input-${tx._id}`}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleInlineSlipChange(tx._id, e.target.files?.[0])}
                              />
                            </>
                          ) : (
                            <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              ไม่มีสลิป
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="amount">{formatCurrency(tx.amount)}</span>
                        </td>
                        <td>
                          <span className={`badge ${getBankBadgeClass(tx.bank)}`}>
                            {getBankName(tx.bank)}
                          </span>
                        </td>
                        <td>
                          {tx.slipImage ? (
                            <button
                              className="btn-slip-view"
                              onClick={() => setViewSlip({ id: tx._id, url: tx.slipImage })}
                              title="ดูรายละเอียดสลิปโอนเงิน"
                            >
                              <Eye /> ดูสลิป
                            </button>
                          ) : activeTab === 'submitted' ? (
                            <>
                              <button
                                className="btn-slip-upload"
                                onClick={() => triggerUploadFor(tx._id)}
                                disabled={uploadingId === tx._id}
                                title={uploadingId === tx._id ? 'กำลังอัปโหลดไฟล์สลิป...' : 'อัปโหลดสลิปโอนเงิน'}
                              >
                                {uploadingId === tx._id ? <span className="spinner" /> : <Upload />}
                                {uploadingId === tx._id ? 'กำลังอัปโหลด...' : 'เพิ่มสลิป'}
                              </button>
                              <input
                                id={`submitted-slip-input-${tx._id}`}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleInlineSlipChange(tx._id, e.target.files?.[0])}
                              />
                            </>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <div className="notes-cell">
                            {tx.notes && <div className="note-text">{tx.notes}</div>}
                            {tx.breakdowns && tx.breakdowns.length > 0 && (
                              <div className="breakdowns">
                                {tx.breakdowns.map((bd, idx) => {
                                  const label = breakdownCodeLabels[bd.code] || bd.code;
                                  return (
                                    <div key={idx} className="breakdown-item">
                                      <span className="bd-code">{bd.code}</span>
                                      <span className="bd-sep"> :</span>{' '}
                                      <span className="bd-label">{label}:</span>{' '}
                                      <span className="bd-amount">{bd.amount?.toLocaleString('th-TH')} บาท</span>
                                      {bd.statusNote && <span className="bd-status"> — {bd.statusNote}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {!tx.notes && (!tx.breakdowns || tx.breakdowns.length === 0) && '-'}
                          </div>
                        </td>
                        <td>
                          {activeTab === 'submitted' && (
                            <span className="badge" style={{ background: '#e6f4ff', color: '#0b6ef6', padding: '6px 10px', borderRadius: '6px', border: '1px solid #b9d8ff' }}>
                              <ClockFill size={14} style={{ marginRight: '4px' }} />
                              รอพิจารณา
                            </span>
                          )}
                          {activeTab === 'approved' && (
                            <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>
                              <CheckCircleFill size={14} style={{ marginRight: '4px' }} />
                              อนุมัติ
                            </span>
                          )}
                          {activeTab === 'rejected' && (
                            <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                              <XCircleFill size={14} style={{ marginRight: '4px' }} />
                              ปฏิเสธ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const filteredTotal = transactions.length;
                const filteredTotalPages = Math.ceil(filteredTotal / pageSize);
                return filteredTotal > pageSize && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                    >
                      « First
                    </button>
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      ‹ Prev
                    </button>
                    <div className="page-numbers">
                      {(() => {
                        const maxButtons = 7;
                        let start = Math.max(1, currentPage - 3);
                        let end = Math.min(filteredTotalPages, start + maxButtons - 1);
                        start = Math.max(1, end - maxButtons + 1);
                        const pages = [];
                        for (let i = start; i <= end; i++) {
                          pages.push(
                            <button
                              key={i}
                              className={`page-number ${i === currentPage ? 'active' : ''}`}
                              onClick={() => setCurrentPage(i)}
                            >
                              {i}
                            </button>
                          );
                        }
                        return pages;
                      })()}
                    </div>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= filteredTotalPages}
                    >
                      Next ›
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(filteredTotalPages)}
                      disabled={currentPage >= filteredTotalPages}
                    >
                      Last »
                    </button>
                    <div className="pagination-info">
                      {(() => {
                        const startIndex = (currentPage - 1) * pageSize + 1;
                        const endIndex = Math.min(currentPage * pageSize, filteredTotal);
                        return `แสดง ${startIndex}–${endIndex} จาก ${filteredTotal}`;
                      })()}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Slip Preview Modal */}
      {viewSlip && (
        <div className="modal-backdrop" onClick={() => setViewSlip(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content slip-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>สลิปโอนเงิน</h3>
              <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div className="modal-body slip-modal-body">
              <img src={`${api}${viewSlip?.url}`} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
