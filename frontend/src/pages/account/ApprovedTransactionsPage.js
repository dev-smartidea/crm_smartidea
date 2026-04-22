import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { CheckCircleFill, Google, Facebook, Search, CashCoin, Wallet, Eye, Upload, XCircle } from 'react-bootstrap-icons';
import toast from '../../utils/toast';
import { formatCurrency, formatDate, formatNumber, getBankBadgeClass, getBreakdownLabel, TRANSACTION_PAGE_SIZE, TRANSACTION_API_LIMIT, MAX_SLIP_FILE_SIZE } from '../../utils/transactionHelpers';
import './ApprovedTransactionsPage.css';
import '../shared/DashboardPage.css';
import { getImageUrl } from '../../utils/imageHelper';
import '../shared/ImageGalleryPage.css';

export default function ApprovedTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  
  // Pagination
  const pageSize = TRANSACTION_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);
  
  // ค้นหา
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [transactionIdQuery, setTransactionIdQuery] = useState('');
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

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
      fetchAllData();
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
      fetchAllData();
      setViewSlip(null);
    } catch (err) {
      toast.error('ลบสลิปไม่สำเร็จ');
    }
  };

  const fetchAllData = useCallback(async (signal) => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` }, ...(signal ? { signal } : {}) };
      const txRes = await axios.get(`${api}/api/transactions?submissionStatus=approved&limit=${TRANSACTION_API_LIMIT}`, authHeaders);
      
      const formatted = (txRes.data.transactions || []).map(tx => ({
        ...tx,
        customerName: tx.customerId?.name || tx.serviceId?.customerId?.name || '-',
        serviceName: tx.serviceId?.serviceType || tx.serviceId?.name || '-',
        serviceCid: tx.serviceId?.cid || tx.serviceId?.customerIdField || ''
      }));
      
      setTransactions(formatted);
      setFilteredTransactions(formatted);
    } catch (e) {
      if (axios.isCancel(e)) return;
      // fetch error handled by loading state
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllData(controller.signal);
    return () => controller.abort();
  }, [fetchAllData]);

  // ฟังก์ชันค้นหา
  const handleSearch = useCallback(() => {
    let result = [...transactions];
    
    // กรองตามลูกค้า
    if (selectedCustomerId) {
      result = result.filter(tx => tx.serviceId?.customerId?._id === selectedCustomerId);
    }
    
    // กรองตาม Transaction ID
    if (transactionIdQuery.trim()) {
      const q = transactionIdQuery.trim().toLowerCase();
      result = result.filter(tx => tx._id?.toLowerCase().includes(q));
    }
    
    setFilteredTransactions(result);
    setCurrentPage(1);
  }, [transactions, selectedCustomerId, transactionIdQuery]);

  // ฟังก์ชันล้างค่าการค้นหา
  const handleClearFilters = () => {
    setSelectedCustomerId('');
    setCustomerQuery('');
    setTransactionIdQuery('');
  };

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filteredTransactions.slice(startIndex, endIndex);

  // ลูกค้าที่มีใน transactions เท่านั้น
  const uniqueCustomers = transactions
    .filter(tx => tx.serviceId?.customerId?._id && tx.customerName)
    .reduce((acc, tx) => {
      const customerId = tx.serviceId.customerId._id;
      if (!acc.find(c => c._id === customerId)) {
        acc.push({
          _id: customerId,
          name: tx.customerName
        });
      }
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const filteredCustomers = uniqueCustomers.filter(c =>
    c.name.toLowerCase().includes(customerQuery.toLowerCase())
  );

  if (loading) return (
    <div className="all-transaction-page fade-up">
      <div className="transaction-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="all-transaction-page">
      <div className="transaction-container">
        {/* Header - reuse gallery header styles */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <CheckCircleFill className="gallery-icon" />
            <div>
              <h2>รายการที่อนุมัติแล้ว</h2>
              <p className="gallery-subtitle">รายการเติมเงินที่ผ่านการอนุมัติทั้งหมด</p>
            </div>
          </div>
          {filteredTransactions.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                <CashCoin size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวมทั้งหมด</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                    {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0))}
                  </div>
                </div>
              </div>
              <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
                <Wallet size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>จำนวนรายการ</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>{filteredTransactions.length} รายการ</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Section */}
        <div className="search-section">
          <div className="search-filters">
            {/* ค้นหาตามลูกค้า */}
            <div className="filter-group">
              <label className="filter-label">
                <Search size={16} />
                ค้นหาตามลูกค้า
              </label>
              <div className="combobox-wrapper">
                <input
                  type="text"
                  className="combobox-input"
                  placeholder="พิมพ์ชื่อลูกค้า..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 300)}
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="combobox-dropdown">
                    <div
                      className="combobox-option"
                      onClick={() => {
                        setSelectedCustomerId('');
                        setCustomerQuery('');
                      }}
                    >
                      ทั้งหมด
                    </div>
                    {filteredCustomers.map(c => (
                      <div
                        key={c._id}
                        className="combobox-option"
                        onClick={() => {
                          setSelectedCustomerId(c._id);
                          setCustomerQuery(c.name);
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ค้นหาตาม Transaction ID */}
            <div className="filter-group">
              <label className="filter-label">
                <Search size={16} />
                ค้นหาตาม Transaction ID
              </label>
              <input
                type="text"
                className="combobox-input"
                placeholder="พิมพ์ Transaction ID..."
                value={transactionIdQuery}
                onChange={(e) => setTransactionIdQuery(e.target.value)}
              />
            </div>

            {/* ปุ่มล้างค่าการค้นหา */}
            {(selectedCustomerId || transactionIdQuery) && (
              <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
                <button
                  className="btn-clear-filters"
                  onClick={handleClearFilters}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-text-muted)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = 'var(--color-text-secondary)'}
                  onMouseOut={(e) => e.target.style.backgroundColor = 'var(--color-text-muted)'}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cards Grid */}
        {filteredTransactions.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '64px 24px' }}>
            <CheckCircleFill size={64} color="var(--color-border-hover)" />
            <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginTop: '16px' }}>ไม่พบรายการที่อนุมัติ</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-placeholder)' }}>{(selectedCustomerId || transactionIdQuery) ? 'ลองเปลี่ยนเงื่อนไขการค้นหา หรือล้างตัวกรอง' : 'รายการที่ผ่านการอนุมัติจะแสดงที่นี่'}</p>
          </div>
        ) : (
          <>
            <div className="cards-grid">
              {pageItems.map(tx => (
                <div key={tx._id} className="transaction-card">
                  {/* Header: Date & Bank */}
                  <div className="card-header-simple">
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
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
                      {tx.bank || '-'}
                    </span>
                  </div>

                  {/* Transaction ID */}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-placeholder)', marginTop: '6px', fontFamily: 'monospace' }}>
                    TX: {tx._id}
                  </div>

                  {/* Customer Name */}
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>
                    {tx.customerName || '-'}
                  </div>

                  {/* Service Badge */}
                  {tx.serviceName && (
                    <div style={{ marginTop: '6px' }}>
                      <span className={`service-badge ${
                        tx.serviceName === 'Facebook Ads' ? 'facebook' :
                        tx.serviceName === 'Google Ads' ? 'google' : 'other'
                      }`}>
                        {tx.serviceName === 'Facebook Ads' && <Facebook className="service-icon" />}
                        {tx.serviceName === 'Google Ads' && <Google className="service-icon" />}
                        <span style={{ marginRight: '6px' }}>{tx.serviceName}</span>
                        {tx.serviceCid && <span className="service-id-text">({tx.serviceCid})</span>}
                      </span>
                    </div>
                  )}

                  {/* Amount - Large & Centered */}
                  <div style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: '700', 
                    color: 'var(--color-success)',
                    textAlign: 'center',
                    padding: '16px 0',
                    margin: '12px 0',
                    borderTop: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)'
                  }}>
                    {formatCurrency(tx.amount)}
                  </div>

                  {/* Breakdowns */}
                  {tx.breakdowns && tx.breakdowns.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        📋 รายละเอียดการโอน:
                      </div>
                      <div style={{ background: 'var(--color-bg-hover)', padding: '8px 10px', borderRadius: '6px' }}>
                        {tx.breakdowns.map((bd, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '600' }}>{bd.code} : {getBreakdownLabel(bd.code)}</span> - {formatNumber(bd.amount)} บาท
                            {bd.statusNote && <span style={{ color: 'var(--color-text-placeholder)', fontSize: '0.75rem' }}> — {bd.statusNote}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {tx.notes && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        📝 หมายเหตุ:
                      </div>
                      <div style={{ background: 'var(--color-warning-light)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
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
                    color: 'var(--color-text-placeholder)',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border)',
                    marginBottom: '12px'
                  }}>
                    <div>
                      ส่งโดย: <strong style={{ color: 'var(--color-text-muted)' }}>{tx.submittedBy?.name || '-'}</strong>
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

                  {/* Status Badge */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: 'var(--color-success-light)',
                      color: 'var(--color-success-hover)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      border: '1px solid var(--color-success)'
                    }}>
                      ✓ อนุมัติแล้ว
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← ก่อนหน้า
                </button>
                <div className="pagination-numbers">
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          className={`pagination-page-num ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="pagination-dots">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  ถัดไป →
                </button>
                <span className="pagination-info">
                  หน้า {currentPage} จาก {totalPages} ({filteredTransactions.length} รายการ)
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slip Modal - อยู่นอก container เพื่อให้ z-index ทำงานถูกต้อง */}
      {viewSlip && (
        <div className="modal-backdrop" onClick={() => setViewSlip(null)} style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 10000 
        }}>
          <div className="modal-content slip-modal" onClick={e => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0 }}>สลิปโอนเงิน</h3>
              <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                <XCircle />
              </button>
            </div>
            <div className="modal-body slip-modal-body" style={{ padding: '20px' }}>
              <img src={getImageUrl(viewSlip?.url, api)} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} />
            </div>
            <div className="modal-footer slip-modal-footer" style={{ display: 'flex', gap: '12px', padding: '16px 20px', borderTop: '1px solid var(--color-border)', justifyContent: 'center' }}>
              <input id="modal-slip-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleModalUploadChange} />
              <button className="btn-action-upload" onClick={() => document.getElementById('modal-slip-input').click()} style={{
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}>
                <Upload /> อัปโหลดภาพใหม่
              </button>
              <button className="btn-action-delete" onClick={handleDeleteSlip} style={{
                background: 'var(--color-danger)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}>
                ลบสลิป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
