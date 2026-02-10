import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { CheckCircleFill, Google, Facebook, Search, CashCoin, Wallet, Eye, Upload, XCircle } from 'react-bootstrap-icons';
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
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);
  
  // ค้นหา
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

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
      fetchAllData();
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
      fetchAllData();
      setViewSlip(null);
    } catch (err) {
      alert('ลบสลิปไม่สำเร็จ');
    }
  };

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const txRes = await axios.get(`${api}/api/transactions?submissionStatus=approved&limit=500`, authHeaders);
      
      const formatted = (txRes.data.transactions || []).map(tx => ({
        ...tx,
        customerName: tx.customerId?.name || tx.serviceId?.customerId?.name || '-',
        serviceName: tx.serviceId?.serviceType || tx.serviceId?.name || '-',
        serviceCid: tx.serviceId?.cid || tx.serviceId?.customerIdField || ''
      }));
      
      setTransactions(formatted);
      setFilteredTransactions(formatted);
    } catch (e) {
      console.error('Load data failed:', e);
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ฟังก์ชันค้นหา
  const handleSearch = useCallback(() => {
    let result = [...transactions];
    
    // กรองตามลูกค้า
    if (selectedCustomerId) {
      result = result.filter(tx => tx.serviceId?.customerId?._id === selectedCustomerId);
    }
    
    // กรองตามบริการ
    if (selectedServiceId) {
      result = result.filter(tx => tx.serviceId?._id === selectedServiceId);
    }
    
    setFilteredTransactions(result);
    setCurrentPage(1);
  }, [transactions, selectedCustomerId, selectedServiceId]);

  // ฟังก์ชันล้างค่าการค้นหา
  const handleClearFilters = () => {
    setSelectedCustomerId('');
    setCustomerQuery('');
    setSelectedServiceId('');
    setServiceQuery('');
  };

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // เคลียร์บริการเมื่อเปลี่ยนลูกค้า
  useEffect(() => {
    setSelectedServiceId('');
    setServiceQuery('');
  }, [selectedCustomerId]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filteredTransactions.slice(startIndex, endIndex);

  // Filter services และ customers ที่มีใน transactions
  // ถ้าเลือกลูกค้าแล้ว จะแสดงเฉพาะบริการของลูกค้านั้น
  const uniqueServices = transactions
    .filter(tx => {
      if (!selectedCustomerId) return true; // ถ้าไม่ได้เลือกลูกค้า แสดงทั้งหมด
      return tx.serviceId?.customerId?._id === selectedCustomerId;
    })
    .filter(tx => tx.serviceId?._id && tx.serviceName)
    .reduce((acc, tx) => {
      const serviceId = tx.serviceId._id;
      if (!acc.find(s => s.id === serviceId)) {
        acc.push({
          id: serviceId,
          name: tx.serviceName,
          customerIdField: tx.serviceId.customerIdField || '',
          displayText: tx.serviceId.customerIdField 
            ? `${tx.serviceName} : ${tx.serviceId.customerIdField}`
            : tx.serviceName
        });
      }
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  
  const filteredServices = uniqueServices.filter(s =>
    s.displayText.toLowerCase().includes(serviceQuery.toLowerCase())
  );

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  };

  const formatNumber = (amount) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
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
      '18': 'ค่าบริการ Facebook',
      '19': 'Vat ค่าบริการ Hosting Domain',
      '20': 'ค่าบริการ Hosting Domain'
    };
    return labels[code] || code;
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

  if (loading) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>;

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

            {/* ค้นหาตามบริการ */}
            <div className="filter-group">
              <label className="filter-label">
                <Search size={16} />
                ค้นหาตามบริการ
              </label>
              <div className="combobox-wrapper">
                <input
                  type="text"
                  className="combobox-input"
                  placeholder="พิมพ์ชื่อบริการ..."
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  onFocus={() => setShowServiceDropdown(true)}
                  onBlur={() => setTimeout(() => setShowServiceDropdown(false), 300)}
                />
                {showServiceDropdown && filteredServices.length > 0 && (
                  <div className="combobox-dropdown">
                    <div
                      className="combobox-option"
                      onClick={() => {
                        setSelectedServiceId('');
                        setServiceQuery('');
                      }}
                    >
                      ทั้งหมด
                    </div>
                    {filteredServices.map(s => (
                      <div
                        key={s.id}
                        className="combobox-option"
                        onClick={() => {
                          setSelectedServiceId(s.id);
                          setServiceQuery(s.displayText);
                        }}
                      >
                        {s.displayText}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ปุ่มล้างค่าการค้นหา */}
            {(selectedCustomerId || selectedServiceId) && (
              <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
                <button
                  className="btn-clear-filters"
                  onClick={handleClearFilters}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#64748b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#475569'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#64748b'}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cards Grid */}
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <CheckCircleFill size={64} color="#cbd5e1" />
            <p>ไม่พบรายการที่อนุมัติ</p>
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
                      {tx.bank || '-'}
                    </span>
                  </div>

                  {/* Customer Name */}
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginTop: '8px' }}>
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
                            <span style={{ fontWeight: '600' }}>{bd.code} : {getBreakdownLabel(bd.code)}</span> - {formatNumber(bd.amount)} บาท
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

                  {/* Status Badge */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: '#dcfce7',
                      color: '#16a34a',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      border: '1px solid #86efac'
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
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0 }}>สลิปโอนเงิน</h3>
              <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                <XCircle />
              </button>
            </div>
            <div className="modal-body slip-modal-body" style={{ padding: '20px' }}>
              <img src={getImageUrl(viewSlip?.url, api)} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} />
            </div>
            <div className="modal-footer slip-modal-footer" style={{ display: 'flex', gap: '12px', padding: '16px 20px', borderTop: '1px solid #e5e7eb', justifyContent: 'center' }}>
              <input id="modal-slip-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleModalUploadChange} />
              <button className="btn-action-upload" onClick={() => document.getElementById('modal-slip-input').click()} style={{
                background: '#3b82f6',
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
                background: '#ef4444',
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
