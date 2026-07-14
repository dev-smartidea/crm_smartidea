import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Google, Facebook, Wallet, CashCoin, Eye, Upload } from 'react-bootstrap-icons';
import toast from '../../utils/toast';
import { formatCurrency, formatDate, getBankBadgeClass, getBankName, getBreakdownLabel, TRANSACTION_PAGE_SIZE, TRANSACTION_API_LIMIT, MAX_SLIP_FILE_SIZE } from '../../utils/transactionHelpers';
import '../shared/DashboardPage.css';
import { getImageUrl } from '../../utils/imageHelper';
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
  const pageSize = TRANSACTION_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchSubmitted = async (signal) => {
    try {
      setLoading(true);
      const res = await axios.get(`${api}/api/transactions?submissionStatus=submitted&limit=${TRANSACTION_API_LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {})
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
      if (axios.isCancel(e)) return;
      // fetch error handled by loading state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSubmitted(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const handleApprove = async (txId) => {
    if (!window.confirm('ยืนยันอนุมัติรายการนี้?')) return;
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('อนุมัติรายการสำเร็จ');
      fetchSubmitted();
    } catch (e) {
      toast.error('อนุมัติไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const approvableItems = items.filter(tx => tx.slipImage);
    if (approvableItems.length === 0) {
      toast.warning('ไม่มีรายการที่มีสลิปที่สามารถอนุมัติได้');
      return;
    }

    if (!window.confirm(`ยืนยันอนุมัติรายการทั้งหมดที่พร้อม ${approvableItems.length} รายการ?`)) return;

    try {
      setLoading(true);
      const ids = approvableItems.map(tx => tx._id);
      await axios.put(`${api}/api/transactions/bulk-approve`, { ids }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('อนุมัติรายการทั้งหมดสำเร็จ');
      fetchSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'อนุมัติทั้งหมดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (txId) => {
    if (!window.confirm('ยืนยันปฏิเสธรายการนี้?')) return;
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ปฏิเสธรายการสำเร็จ');
      fetchSubmitted();
    } catch (e) {
      toast.error('ปฏิเสธไม่สำเร็จ');
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
    if (file.size > MAX_SLIP_FILE_SIZE) {
      toast.warning('ขนาดไฟล์ต้องไม่เกิน 5MB');
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
      toast.error(msg);
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
      toast.error('ลบสลิปไม่สำเร็จ');
    }
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

  const readyCount = items.filter(tx => tx.slipImage).length;

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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                className="btn-bulk-approve"
                onClick={handleBulkApprove}
                disabled={readyCount === 0}
                title={readyCount === 0 ? 'ไม่มีรายการที่มีภาพสลิปที่รออนุมัติ' : `อนุมัติทั้งหมดที่พร้อม (${readyCount} รายการ)`}
              >
                <CheckCircle size={18} /> อนุมัติทั้งหมด ({readyCount})
              </button>
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
        {/* Transactions Cards */}
        <div className="transactions-section">
          {items.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>ยังไม่มีรายการที่ส่งมา</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>รายการที่ส่งมาจาก User จะแสดงที่นี่</p>
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

                    {/* Transaction ID */}
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                      TX: {tx._id}
                    </div>

                    {/* Customer Name */}
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
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
                      color: '#10b981',
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
                                      {tx.slipImage || tx.slipImage2 ? (
                                        <button
                                          className="btn-slip-view"
                                          onClick={() => setViewSlip({ id: tx._id, urls: [tx.slipImage, tx.slipImage2].filter(Boolean) })}
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

                    <div className="card-actions">
                      <button
                        onClick={() => handleApprove(tx._id)}
                        disabled={processingId === tx._id || !tx.slipImage}
                        className="btn-approve"
                        title={!tx.slipImage ? 'ต้องมีสลิปก่อนอนุมัติ' : 'อนุมัติรายการ'}
                        aria-label={`อนุมัติรายการ ${tx.customer?.name || ''}`}
                      >
                        <CheckCircle size={20} /> อนุมัติ
                      </button>
                      <button
                        onClick={() => handleReject(tx._id)}
                        disabled={processingId === tx._id}
                        className="btn-reject"
                        aria-label={`ปฏิเสธรายการ ${tx.customer?.name || ''}`}
                      >
                        <XCircle size={20} /> ปฏิเสธ
                      </button>
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
                    aria-label="หน้าก่อนหน้า"
                  >
                    ← ก่อนหน้า
                  </button>
                  <div className="pagination-info">
                    หน้า {currentPage} จาก {totalPages} (ทั้งหมด {items.length} รายการ)
                  </div>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="หน้าถัดไป"
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
        <div className="modal-backdrop" onClick={() => setViewSlip(null)} style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="ดูสลิปโอนเงิน" onKeyDown={(e) => e.key === 'Escape' && setViewSlip(null)}>
          <div className="modal-content slip-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>สลิปโอนเงิน</h3>
              <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }} aria-label="ปิดหน้าต่างสลิป">
                <XCircle />
              </button>
            </div>
            <div className="modal-body slip-modal-body">
              {viewSlip?.urls?.map((u, idx) => (
                <img key={idx} src={getImageUrl(u, api)} alt={`สลิปโอนเงิน ${idx + 1}`} style={{ width: '100%', height: 'auto', display: 'block', marginBottom: '8px' }} />
              ))}
            </div>
            <div className="modal-footer slip-modal-footer">
              <input id="modal-slip-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleModalUploadChange} aria-label="เลือกไฟล์สลิปใหม่" />
              <input id="modal-slip2-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && viewSlip?.id) {
                  // upload as second slip (PUT supports two files)
                  const formData = new FormData();
                  formData.append('slipImage2', file);
                  axios.put(`${api}/api/transactions/${viewSlip.id}`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                    .then(() => fetchSubmitted())
                    .catch(() => toast.error('อัปโหลดสลิปไม่สำเร็จ'));
                }
              }} />
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
