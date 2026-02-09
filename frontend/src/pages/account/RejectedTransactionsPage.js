import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XCircle, Google, Facebook, Wallet, CashCoin, Eye, Upload } from 'react-bootstrap-icons';
import '../shared/DashboardPage.css';
import '../user/AllTransactionPage.css';
import '../shared/ImageGalleryPage.css';
import '../user/TransactionHistoryPage.css';

export default function RejectedTransactionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  
  // Pagination
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchRejected = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${api}/api/transactions?submissionStatus=rejected&limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = (res.data.transactions || []).map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        customer: tx.customerId || tx.serviceId?.customerId || {},
        serviceType: tx.serviceId?.serviceType || tx.serviceId?.name || '',
        serviceCid: tx.serviceId?.cid || tx.serviceId?.customerIdField || ''
      }));
      setItems(formatted);
    } catch (e) {
      console.error('Load rejected transactions failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRejected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      fetchRejected(); // รีโหลดรายการ
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
      fetchRejected(); // รีโหลดรายการ
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
      'BAY-4396': 'badge-bank-bay',
      'BAY-7146': 'badge-bank-bay',
      'Cr.-8508': 'badge-bank',
      'BBL-ส่วนตัว': 'badge-bank-bbl'
    };
    return bankMap[bank] || 'badge-bank';
  };

  const getBankName = (bank) => {
    return bank || '-';
  };

  const getBreakdownLabel = (code) => {
    const labels = {
      '11': 'ค่าคลิก',
      '12': 'Vat ค่าคลิก',
      '13': 'Vat ค่าบริการ Google',
      '14': 'ค่าบริการ Google',
      '15': 'ค่าบริการบางส่วน',
      '16': 'คูปอง Google',
      '17': 'Vat ค่าบริการ Facebook',
      '18': 'ค่าบริการ Facebook'
    };
    return labels[code] || code;
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
        {/* Header */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <XCircle className="gallery-icon" style={{ color: '#ffffff' }} />
            <div>
              <h2>รายการที่ปฏิเสธ</h2>
              <p className="gallery-subtitle">รายการที่ถูกปฏิเสธและรอการดำเนินการจาก User</p>
            </div>
          </div>
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                <CashCoin size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวมที่ปฏิเสธ</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem', color: '#ef4444' }}>
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
        {/* Transactions Cards */}
        <div className="transactions-section">
          {items.length === 0 ? (
            <div className="no-data">
              <XCircle size={48} style={{ color: '#10b981' }} />
              <p>ไม่มีรายการที่ปฏิเสธ</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>รายการที่ถูกปฏิเสธจะแสดงที่นี่</p>
            </div>
          ) : (
            <>
              <div className="cards-grid">
                {pageItems.map(tx => (
                  <div key={tx._id} className="transaction-card">
                    {/* Header: Date & Bank */}
                    <div className="card-header-simple">
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                          <span style={{ fontWeight: '400' }}>วันที่โอน </span>
                          <span style={{ fontWeight: '600' }}>{formatDate(tx.transactionDate)}</span>
                          {tx.transactionTime && (
                            <>
                              <span style={{ fontWeight: '400', marginLeft: '12px' }}>เวลาที่โอน </span>
                              <span style={{ fontWeight: '600' }}>{tx.transactionTime}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${getBankBadgeClass(tx.bank)}`} style={{ fontSize: '0.75rem' }}>
                        {getBankName(tx.bank)}
                      </span>
                    </div>

                    {/* Rejected Badge */}
                    <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        <XCircle size={12} style={{ marginRight: '4px' }} />
                        ปฏิเสธแล้ว
                      </span>
                    </div>

                    {/* Customer Name */}
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginTop: '8px' }}>
                      {tx.customer?.name || tx.service?.customerId?.name || '-'}
                    </div>

                    {/* Service Badge */}
                    {tx.serviceType && (
                      <div style={{ marginTop: '6px' }}>
                        <span className={`service-badge ${
                          tx.serviceType === 'Facebook Ads' ? 'facebook' :
                          tx.serviceType === 'Google Ads' ? 'google' : 'other'
                        }`}>
                          {tx.serviceType === 'Facebook Ads' && <Facebook className="service-icon" />}
                          {tx.serviceType === 'Google Ads' && <Google className="service-icon" />}
                          <span style={{ marginRight: '6px' }}>{tx.serviceType}</span>
                          {tx.serviceCid && <span className="service-id-text">({tx.serviceCid})</span>}
                        </span>
                      </div>
                    )}

                    {/* Amount - Large & Centered */}
                    <div style={{ 
                      fontSize: '1.75rem', 
                      fontWeight: '700', 
                      color: '#ef4444',
                      textAlign: 'center',
                      padding: '16px 0',
                      margin: '12px 0',
                      borderTop: '1px solid #f1f5f9',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      {formatCurrency(tx.amount)}
                    </div>

                    {/* Breakdowns */}
                    {tx.breakdowns && tx.breakdowns.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                          📋 รายละเอียดการโอน:
                        </div>
                        <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                          {tx.breakdowns.map((bd, idx) => (
                            <div key={idx} style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '600' }}>{bd.code} : {getBreakdownLabel(bd.code)}</span> - {bd.amount?.toLocaleString('th-TH')} บาท
                              {bd.statusNote && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}> — {bd.statusNote}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {tx.notes && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                          📝 หมายเหตุ:
                        </div>
                        <div style={{ background: '#fffbeb', padding: '8px 10px', borderRadius: '6px', fontSize: '0.85rem', color: '#475569' }}>
                          {tx.notes}
                        </div>
                      </div>
                    )}

                    {/* Slip & Submitter */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f5f9',
                      marginBottom: '12px'
                    }}>
                      <div>
                        ส่งโดย: <strong style={{ color: '#64748b' }}>{tx.submittedBy?.name || '-'}</strong>
                      </div>
                      {tx.slipImage ? (
                        <button
                          className="btn-slip-view"
                          onClick={() => setViewSlip({ id: tx._id, url: tx.slipImage })}
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          <Eye size={12} /> ดูสลิป
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn-slip-upload"
                            onClick={() => triggerUploadFor(tx._id)}
                            disabled={uploadingId === tx._id}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            {uploadingId === tx._id ? <span className="spinner" style={{ width: '10px', height: '10px' }} /> : <Upload size={12} />}
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
                    </div>

                    {/* Info Notice */}
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#92400e',
                      borderLeft: '3px solid #f59e0b'
                    }}>
                      ⚠️ รายการนี้รอ User ดำเนินการ (แก้ไขส่งใหม่หรือลบ)
                    </div>
                  </div>
                ))}
              </div>

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
