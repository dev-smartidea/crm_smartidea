import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wallet, Plus, Search, TrashFill, Eye, XCircle, ExclamationTriangleFill, CashCoin, Google, Facebook, Upload } from 'react-bootstrap-icons';
import './AllTransactionPage.css';
import './DashboardPage.css'; // reuse service-badge styles
import './TransactionHistoryPage.css'; // reuse slip upload button styles
import './ImageGalleryPage.css'; // reuse combobox and search styles to match gallery

export default function AllTransactionPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  // ค้นหาแบบ combobox เหมือนหน้า "คลังรูปภาพ"
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [serviceFilter, setServiceFilter] = useState(''); // เก็บชื่อบริการที่เลือก
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null); // อัปโหลดสลิปรายแถว
  const [form, setForm] = useState({
    serviceId: '',
    amount: '',
    transactionDate: '',
    notes: '',
    bank: 'KBANK',
    slipImage: null
  });
  const [slipPreview, setSlipPreview] = useState(null);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // ดึงข้อมูลทั้งหมด
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      
      // ดึงข้อมูลลูกค้า, บริการ และ transactions
      const [customersRes, servicesRes, transactionsRes] = await Promise.all([
        axios.get(`${api}/api/customers`, authHeaders),
        axios.get(`${api}/api/services`, authHeaders),
        axios.get(`${api}/api/transactions`, authHeaders)
      ]);
      
      setCustomers(customersRes.data);
      setServices(servicesRes.data);

      // จัดรูปแบบข้อมูล transactions พร้อม customer และ service
      const formattedTransactions = transactionsRes.data.map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        // ใช้ customerId จาก service (populate) ให้เหมือนมุมมองใน TransactionHistoryPage
        customer: tx.serviceId?.customerId || {}
      }));

      setTransactions(formattedTransactions);
      setFilteredTransactions(formattedTransactions);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เมื่อเปลี่ยนลูกค้าใน combobox ให้รีเซ็ตบริการ
  useEffect(() => {
    setServiceFilter('');
    setServiceQuery('');
  }, [selectedCustomerId]);

  const handleSearch = (e) => {
    e.preventDefault();
    // สร้างค่า customerId จากการเลือกหรือจากข้อความที่พิมพ์เหมือนหน้า คลังรูปภาพ
    let customerId = selectedCustomerId;
    if (!customerId && customerQuery) {
      const match = customers.find(c => {
        const code = (c.customerCode || (c._id || '').toString().slice(-6).toUpperCase());
        const label = `${code} : ${c.name}`;
        return label.toLowerCase() === customerQuery.toLowerCase() || c.name.toLowerCase() === customerQuery.toLowerCase();
      });
      if (match) customerId = match._id;
    }

    // สร้างค่า serviceName จากการเลือกหรือจากข้อความที่พิมพ์
    let serviceName = serviceFilter;
    if (!serviceName && serviceQuery) {
      const list = services.filter(s => (s.customerId === customerId) || (s.customerId?._id === customerId));
      const matchSvc = list.find(svc => {
        const idText = (svc.customerIdField || '-');
        const pageText = (svc.pageUrl || '-');
        const label = `${svc.name} — ${idText} — ${pageText}`;
        return label.toLowerCase() === serviceQuery.toLowerCase() || svc.name.toLowerCase() === serviceQuery.toLowerCase();
      });
      if (matchSvc) serviceName = matchSvc.name;
    }

    // กรองรายการธุรกรรมในหน้า
    let filtered = [...transactions];
    if (customerId) {
      filtered = filtered.filter(tx => (
        tx.customer?._id === customerId ||
        tx.service?.customerId?._id === customerId ||
        tx.service?.customerId === customerId
      ));
    }
    if (serviceName) {
      filtered = filtered.filter(tx => (tx.service?.name === serviceName));
    }
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  // สร้างรายการเติมเงินใหม่
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.serviceId || !form.amount || !form.transactionDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('amount', parseFloat(form.amount));
      formData.append('transactionDate', form.transactionDate);
      formData.append('notes', form.notes || '');
      formData.append('bank', form.bank);
      if (form.slipImage) {
        formData.append('slipImage', form.slipImage);
      }

      await axios.post(
        `${api}/api/services/${form.serviceId}/transactions`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      alert('เพิ่มรายการเติมเงินสำเร็จ');
      setShowCreateForm(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('ไม่สามารถเพิ่มรายการได้');
    }
  };

  // ลบรายการ
  const handleDelete = async () => {
    if (!transactionToDelete) return;
    
    try {
      await axios.delete(
        `${api}/api/transactions/${transactionToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('ลบรายการสำเร็จ');
      setShowDeleteConfirm(false);
      setTransactionToDelete(null);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('ไม่สามารถลบรายการได้');
    }
  };

  const resetForm = () => {
    setForm({
      serviceId: '',
      amount: '',
      transactionDate: '',
      notes: '',
      bank: 'KBANK',
      slipImage: null
    });
    setSlipPreview(null);
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, slipImage: file });
      const reader = new FileReader();
      reader.onloadend = () => setSlipPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

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

  // ใช้สำหรับตัวเลขใน breakdown (ไม่ต้องแสดงสัญลักษณ์สกุลเงิน)
  const formatNumber = (amount) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
  };

  // Map รหัส breakdown -> ป้ายภาษาไทย
  const breakdownCodeLabels = {
    '11': 'ค่าคลิก',
    '12': 'Vat ค่าคลิก',
    '13': 'Vat ค่าบริการ',
    '14': 'ค่าบริการ Google',
    '15': 'ค่าบริการบางส่วน',
    '16': 'คูปอง Google'
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
      'KBANK': 'กสิกรไทย',
      'SCB': 'ไทยพาณิชย์',
      'BBL': 'กรุงเทพ',
      'KTB': 'กรุงไทย',
      'TTB': 'ทหารไทยธนชาต',
      'BAY': 'กรุงศรีอยุธยา'
    };
    return bankNames[bank] || bank;
  };

  // อัปโหลดสลิปให้รายการที่ไม่มีสลิป
  const triggerUploadFor = (txId) => {
    const el = document.getElementById(`slip-input-${txId}`);
    if (el) el.click();
  };

  const handleInlineSlipChange = async (txId, file) => {
    if (!file) return;
    // ตรวจสอบขนาดไฟล์ไม่เกิน 5MB
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
      setTransactions(transactions.map(t => (t._id === txId ? res.data : t)));
      setFilteredTransactions(filteredTransactions.map(t => (t._id === txId ? res.data : t)));
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

  // Ensure current page stays within bounds when filtered list changes
  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [filteredTransactions]);

  const handleDeleteSlip = async () => {
    if (!viewSlip?.id) return;
    try {
      await axios.delete(`${api}/api/transactions/${viewSlip.id}/slip`, { headers: { Authorization: `Bearer ${token}` } });
      setTransactions(transactions.map(t => (t._id === viewSlip.id ? { ...t, slipImage: null } : t)));
      setFilteredTransactions(filteredTransactions.map(t => (t._id === viewSlip.id ? { ...t, slipImage: null } : t)));
      setViewSlip(null);
    } catch (err) {
      alert('ลบสลิปไม่สำเร็จ');
    }
  };

  const SlipViewModal = () => (
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
  );

  return (
    <div className="all-transaction-page">
      <div className="transaction-container">
        {/* Header - reuse gallery header styles */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <Wallet className="gallery-icon" />
            <div>
              <h2>การเติมเงินทั้งหมด</h2>
              <p className="gallery-subtitle">รายการเติมเงินและการโอนเงินทั้งหมดในระบบ</p>
            </div>
          </div>
          <button className="btn-header-upload" onClick={() => setShowCreateForm(true)}>
            <Plus /> เพิ่มรายการ
          </button>
        </div>

        {/* Search (Combobox style, identical to Image Gallery) */}
        <form onSubmit={handleSearch} className="gallery-filters">
          <div className="filter-group">
            <label>รายชื่อลูกค้า</label>
            <div className="combo">
              <input
                type="text"
                className="form-control combo-input"
                placeholder="พิมพ์ชื่อลูกค้า..."
                value={customerQuery}
                onFocus={() => setShowCustomerDropdown(true)}
                onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true); }}
              />
              {showCustomerDropdown && (
                <div className="combo-panel" onMouseLeave={() => setShowCustomerDropdown(false)}>
                  <div
                    className="combo-item"
                    onMouseDown={() => { setSelectedCustomerId(''); setCustomerQuery('ทั้งหมด'); setShowCustomerDropdown(false); setServiceQuery(''); setServiceFilter(''); }}
                  >ทั้งหมด</div>
                  {customers
                    .filter(c => {
                      const code = (c.customerCode || (c._id || '').toString().slice(-6).toUpperCase());
                      const label = `${code} : ${c.name}`;
                      return label.toLowerCase().includes((customerQuery||'').toLowerCase());
                    })
                    .slice(0, 50)
                    .map(c => {
                      const code = (c.customerCode || (c._id || '').toString().slice(-6).toUpperCase());
                      const label = `${code} : ${c.name}`;
                      return (
                        <div
                          key={c._id}
                          className="combo-item"
                          onMouseDown={() => { setSelectedCustomerId(c._id); setCustomerQuery(label); setShowCustomerDropdown(false); setServiceQuery(''); setServiceFilter(''); }}
                        >
                          {label}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          <div className="filter-group">
            <label>บริการ</label>
            <div className="combo">
              <input
                type="text"
                className="form-control combo-input"
                placeholder={selectedCustomerId ? 'พิมพ์ชื่อบริการ...' : 'เลือกชื่อลูกค้าก่อน'}
                value={serviceQuery}
                disabled={!selectedCustomerId}
                onFocus={() => { if (selectedCustomerId) setShowServiceDropdown(true); }}
                onChange={(e) => { setServiceQuery(e.target.value); if (selectedCustomerId) setShowServiceDropdown(true); }}
              />
              {showServiceDropdown && selectedCustomerId && (
                <div className="combo-panel" onMouseLeave={() => setShowServiceDropdown(false)}>
                  {services
                    .filter(svc => (svc.customerId === selectedCustomerId) || (svc.customerId?._id === selectedCustomerId))
                    .filter(svc => {
                      const idText = (svc.customerIdField || '-');
                      const pageText = (svc.pageUrl || '-');
                      const label = `${svc.name} — ${idText} — ${pageText}`;
                      return label.toLowerCase().includes((serviceQuery||'').toLowerCase());
                    })
                    .slice(0, 50)
                    .map(svc => {
                      const idText = (svc.customerIdField || '-');
                      const pageText = (svc.pageUrl || '-');
                      const label = `${svc.name} — ${idText} — ${pageText}`;
                      return (
                        <div
                          key={svc._id}
                          className="combo-item"
                          onMouseDown={() => { setServiceQuery(label); setServiceFilter(svc.name); setShowServiceDropdown(false); }}
                        >
                          {label}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="btn btn-search"><Search /> ค้นหา</button>
        </form>

        {/* Transactions Table */}
        <div className="transactions-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="no-data">
              <Wallet size={48} />
              <p>ไม่พบรายการเติมเงิน</p>
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
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
                    const startIndex = (currentPage - 1) * pageSize;
                    const pageItems = filteredTransactions.slice(startIndex, startIndex + pageSize);
                    return pageItems.map((tx) => (
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
                              {tx.breakdowns.map((bd, idx) => {
                                const label = breakdownCodeLabels[bd.code] || bd.code;
                                return (
                                  <div key={idx} className="breakdown-item">
                                    <span className="bd-code">{bd.code}</span>
                                    <span className="bd-sep"> :</span>{' '}
                                    <span className="bd-label">{label}:</span>{' '}
                                    <span className="bd-amount">{formatNumber(bd.amount)} บาท</span>
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
                        <button
                          className="btn-delete-small"
                          onClick={() => {
                            setTransactionToDelete(tx);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <TrashFill />
                        </button>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {filteredTransactions.length > pageSize && (
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
                    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
                    const maxButtons = 7;
                    let start = Math.max(1, currentPage - 3);
                    let end = Math.min(totalPages, start + maxButtons - 1);
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
                  disabled={currentPage >= Math.ceil(filteredTransactions.length / pageSize)}
                >
                  Next ›
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(Math.max(1, Math.ceil(filteredTransactions.length / pageSize)))}
                  disabled={currentPage >= Math.ceil(filteredTransactions.length / pageSize)}
                >
                  Last »
                </button>
                <div className="pagination-info">
                  {(() => {
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = Math.min(startIndex + pageSize, filteredTransactions.length);
                    return `แสดง ${startIndex + 1}–${endIndex} จาก ${filteredTransactions.length}`;
                  })()}
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Summary */}
        {filteredTransactions.length > 0 && (
          <div className="summary-section">
            <div className="summary-card">
              <CashCoin size={24} />
              <div>
                <div className="summary-label">ยอดรวมทั้งหมด</div>
                <div className="summary-value">
                  {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0))}
                </div>
              </div>
            </div>
            <div className="summary-card">
              <Wallet size={24} />
              <div>
                <div className="summary-label">จำนวนรายการ</div>
                <div className="summary-value">{filteredTransactions.length} รายการ</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="modal-backdrop" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-form">
              <h3><Plus /> เพิ่มรายการเติมเงิน</h3>
              <button className="btn-close" onClick={() => setShowCreateForm(false)}>
                <XCircle />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body-form">
                <div className="form-group">
                  <label>เลือกบริการ *</label>
                  <select
                    className="form-control"
                    value={form.serviceId}
                    onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                    required
                  >
                    <option value="">-- เลือกบริการ --</option>
                    {services.map(service => (
                      <option key={service._id} value={service._id}>
                        {service.name} ({customers.find(c => c._id === service.customerId)?.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>จำนวนเงิน (บาท) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>วันที่โอน *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.transactionDate}
                      onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>ธนาคาร</label>
                  <select
                    className="form-control"
                    value={form.bank}
                    onChange={(e) => setForm({ ...form, bank: e.target.value })}
                  >
                    <option value="KBANK">กสิกรไทย</option>
                    <option value="SCB">ไทยพาณิชย์</option>
                    <option value="BBL">กรุงเทพ</option>
                    <option value="KTB">กรุงไทย</option>
                    <option value="TTB">ทหารไทยธนชาต</option>
                    <option value="BAY">กรุงศรีอยุธยา</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>หมายเหตุ</label>
                  <textarea
                    className="form-control"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows="3"
                    placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                  />
                </div>

                <div className="form-group">
                  <label>อัปโหลดสลิป</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleSlipChange}
                  />
                  {slipPreview && (
                    <div className="slip-preview">
                      <img src={slipPreview} alt="Preview" />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
                  <XCircle /> ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus /> บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <ExclamationTriangleFill />
              <h3>ยืนยันการลบ</h3>
            </div>
            <div className="modal-body">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการเติมเงินนี้?
              <br />
              <strong>{transactionToDelete?.customer?.name}</strong> - {formatCurrency(transactionToDelete?.amount || 0)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                <XCircle /> ยกเลิก
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                <TrashFill /> ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Slip Modal */}
      {viewSlip && <SlipViewModal />}
    </div>
  );
}
