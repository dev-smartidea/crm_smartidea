import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Google, Facebook, Wallet, CashCoin, Eye, Upload } from 'react-bootstrap-icons';
import '../shared/DashboardPage.css';
import '../user/AllTransactionPage.css';
import '../shared/ImageGalleryPage.css';
import '../user/TransactionHistoryPage.css';

export default function AccountTransactionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  
  // Pagination
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchSubmitted = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${api}/api/transactions?submissionStatus=submitted&limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = (res.data.transactions || []).map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        customer: tx.serviceId?.customerId || {}
      }));
      setItems(formatted);
    } catch (e) {
      console.error('Load submitted queue failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (txId) => {
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('อนุมัติรายการสำเร็จ');
      fetchSubmitted(); // รีโหลดรายการ
    } catch (e) {
      alert('อนุมัติไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (txId) => {
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('ปฏิเสธรายการสำเร็จ');
      fetchSubmitted(); // รีโหลดรายการ
    } catch (e) {
      alert('ปฏิเสธไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const triggerUploadFor = (txId) => {
    const el = document.getElementById(`slip-input-${txId}`);
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
      fetchSubmitted(); // รีโหลดรายการ
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'อัปโหลดสลิปไม่สำเร็จ';
      alert(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const handleModalUploadChange = async (e) => {
    const file = e.target.files?.[0];
    if (file && viewSlip?.id) {
      const updatedTx = await handleInlineSlipChange(viewSlip.id, file);
      if (updatedTx && updatedTx.slipImage) setViewSlip({ id: viewSlip.id, url: updatedTx.slipImage });
      else setViewSlip(null);
    }
  };

  const handleDeleteSlip = async () => {
    if (!viewSlip?.id) return;
    try {
      await axios.delete(`${api}/api/transactions/${viewSlip.id}/slip`, { headers: { Authorization: `Bearer ${token}` } });
      fetchSubmitted(); // รีโหลดรายการ
      setViewSlip(null);
    } catch (err) {
      alert('ลบสลิปไม่สำเร็จ');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
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

  const totalAmount = items.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Pagination
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = items.slice(startIndex, endIndex);

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
        {/* Header - reuse gallery header styles */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <Wallet className="gallery-icon" />
            <div>
              <h2>รายการที่ส่งมาบัญชี</h2>
              <p className="gallery-subtitle">รายการเติมเงินที่รอการพิจารณาอนุมัติ</p>
            </div>
          </div>
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                <CashCoin size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวมรอพิจารณา</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                    {formatCurrency(totalAmount)}
                  </div>
                </div>
              </div>
              <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
                <Wallet size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>จำนวนรายการ</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>{items.length} รายการ</div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Transactions Table */}
        <div className="transactions-section">
          {items.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>ยังไม่มีรายการที่ส่งมา</p>
            </div>
          ) : (
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
                    <th>ผู้ส่ง</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(tx => (
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
                        ) : (
                          <span className="text-muted">-</span>
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
                        ) : (
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
                              id={`slip-input-${tx._id}`}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleInlineSlipChange(tx._id, e.target.files?.[0])}
                            />
                          </>
                        )}
                      </td>
                      <td>
                        <div className="notes-cell">
                          {tx.notes && <div className="note-text">{tx.notes}</div>}
                          {tx.breakdowns && tx.breakdowns.length > 0 && (
                            <div className="breakdowns">
                              {tx.breakdowns.map((bd, idx) => (
                                <div key={idx} className="breakdown-item">
                                  <span className="bd-code">{bd.code}</span>
                                  <span className="bd-sep"> :</span>{' '}
                                  <span className="bd-amount">{bd.amount?.toLocaleString('th-TH')} บาท</span>
                                  {bd.statusNote && <span className="bd-status"> — {bd.statusNote}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {!tx.notes && (!tx.breakdowns || tx.breakdowns.length === 0) && '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>
                            {tx.submittedBy?.name || '-'}
                          </div>
                          {tx.submittedAt && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              {new Date(tx.submittedAt).toLocaleDateString('th-TH', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleApprove(tx._id)}
                            disabled={processingId === tx._id || !tx.slipImage}
                            className="btn-submit-small"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #22c55e',
                              background: !tx.slipImage ? '#e5e7eb' : '#f0fdf4',
                              color: !tx.slipImage ? '#9ca3af' : '#16a34a',
                              cursor: (processingId === tx._id || !tx.slipImage) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.875rem',
                              opacity: !tx.slipImage ? 0.5 : 1
                            }}
                            title={!tx.slipImage ? 'ต้องมีสลิปก่อนอนุมัติ' : 'อนุมัติรายการ'}
                          >
                            <CheckCircle /> อนุมัติ
                          </button>
                          <button
                            onClick={() => handleReject(tx._id)}
                            disabled={processingId === tx._id}
                            className="btn-delete-small"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #ef4444',
                              background: '#fef2f2',
                              color: '#dc2626',
                              cursor: processingId === tx._id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.875rem'
                            }}
                          >
                            <XCircle /> ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← ก่อนหน้า
                </button>
                <div className="pagination-info">
                  หน้า {currentPage} จาก {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  ถัดไป →
                </button>
              </div>
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
                <XCircle />
              </button>
            </div>
            <div className="modal-body slip-modal-body">
              <img src={`${api}${viewSlip?.url}`} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
            <div className="modal-footer slip-modal-footer">
              <input id="modal-slip-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleModalUploadChange} />
              <button className="btn-action-upload" onClick={() => document.getElementById('modal-slip-input').click()}>
                <Upload /> อัปโหลดภาพใหม่
              </button>
              <button className="btn-action-delete" onClick={handleDeleteSlip}>
                ลบสลิป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
