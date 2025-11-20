import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wallet, Plus, Search, TrashFill, Eye, XCircle, ExclamationTriangleFill, CashCoin, Google, Facebook, Upload } from 'react-bootstrap-icons';
import './AllTransactionPage.css';
import './DashboardPage.css'; // reuse service-badge styles
import './TransactionHistoryPage.css'; // reuse slip upload button styles
import './ImageGalleryPage.css'; // reuse combobox and search styles to match gallery
import './CustomerServicesPage.css'; // reuse svc-modal styles for create form

export default function AllTransactionPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination (server-side)
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null); // อัปโหลดสลิปรายแถว
  const [form, setForm] = useState({
    customerId: '',
    serviceId: '',
    amount: '',
    transactionDate: '',
    notes: '',
    bank: 'KBANK',
    slipImage: null,
    breakdowns: [
      { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }
    ]
  });
  const [slipPreview, setSlipPreview] = useState(null);

  // คำนวณผลรวม breakdowns ในฟอร์มสร้างใหม่
  const breakdownSum = (form.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // เมื่อเปลี่ยนลูกค้าในฟอร์ม ให้รีเซ็ตบริการ
  useEffect(() => {
    setForm(prev => ({ ...prev, serviceId: '' }));
  }, [form.customerId]);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // ====== Breakdown Rows UI Handlers ======
  const BREAKDOWN_CODE_OPTIONS = [
    { value: '11', label: '11 : ค่าคลิก' },
    { value: '12', label: '12 : Vat ค่าคลิก' },
    { value: '13', label: '13 : Vat ค่าบริการ' },
    { value: '14', label: '14 : ค่าบริการ Google' },
    { value: '15', label: '15 : ค่าบริการบางส่วน' },
    { value: '16', label: '16 : คูปอง Google' }
  ];
  const STATUS_OPTIONS = [
    { value: 'รอบันทึกบัญชี', label: 'รอบันทึกบัญชี' },
    { value: 'ค่าคลิกที่ยังไม่ต้องเติม', label: 'ค่าคลิกที่ยังไม่ต้องเติม' }
  ];

  const addBreakdownRow = () => {
    setForm(prev => ({
      ...prev,
      breakdowns: [...(prev.breakdowns || []), { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    }));
  };

  const removeBreakdownRow = (idx) => {
    setForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      const current = rows[idx];
      const next = rows[idx + 1];
      const shouldRemovePair = current && !current.isAutoVat && next && next.isAutoVat;
      const newRows = rows.filter((_, i) => {
        if (shouldRemovePair) return i !== idx && i !== idx + 1;
        return i !== idx;
      });
      if (newRows.length === 0) {
        newRows.push({ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
      }
      return { ...prev, breakdowns: newRows };
    });
  };

  const updateBreakdown = (idx, key, value) => {
    setForm(prev => ({
      ...prev,
      breakdowns: prev.breakdowns.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const computeVatForRow = (idx) => {
    setForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      const current = rows[idx] || { amount: '', code: '11', statusNote: 'รอบันทึกบัญชี', isAutoVat: false };
      
      if (current.code === '12' || current.code === '13') {
        alert('ไม่สามารถคำนวณ VAT จากรายการ VAT ได้');
        return prev;
      }

      let base = parseFloat(current.amount);
      if (Number.isNaN(base) || base <= 0) {
        alert('กรุณากรอกยอดเงินในช่องนี้ก่อนคำนวณ VAT');
        return prev;
      }

      const vat = Math.round(base * 0.07 * 100) / 100;
      
      let vatCode = '12';
      let vatStatus = current.statusNote;
      
      if (current.code === '11') {
        vatCode = '12';
      } else if (current.code === '14') {
        vatCode = '13';
      } else {
        vatCode = '12';
      }

      const newVatRow = {
        code: vatCode,
        amount: vat.toFixed(2),
        statusNote: vatStatus,
        isAutoVat: true
      };
      
      rows.splice(idx + 1, 0, newVatRow);
      
      return { ...prev, breakdowns: rows };
    });
  };

  // ดึงข้อมูลทั้งหมด (พร้อม server-side pagination)
  const fetchAllData = async (page = 1) => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      
      // ดึงข้อมูลลูกค้า, บริการ และ transactions (พร้อม pagination)
      const [customersRes, servicesRes, transactionsRes] = await Promise.all([
        axios.get(`${api}/api/customers`, authHeaders),
        axios.get(`${api}/api/services`, authHeaders),
        axios.get(`${api}/api/transactions?page=${page}&limit=${pageSize}`, authHeaders)
      ]);
      
      setCustomers(customersRes.data);
      setServices(servicesRes.data);

      // จัดรูปแบบข้อมูล transactions พร้อม customer และ service
      const formattedTransactions = transactionsRes.data.transactions.map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        // ใช้ customerId จาก service (populate) ให้เหมือนมุมมองใน TransactionHistoryPage
        customer: tx.serviceId?.customerId || {}
      }));

      setTransactions(formattedTransactions);
      setFilteredTransactions(formattedTransactions);
      setTotalRecords(transactionsRes.data.pagination.total);
      setTotalPages(transactionsRes.data.pagination.totalPages);
      setCurrentPage(page);
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

  // เมื่อเปลี่ยนหน้า pagination ให้โหลดข้อมูลใหม่จาก server
  useEffect(() => {
    if (currentPage > 0) {
      fetchAllData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleSearch = (e) => {
    e.preventDefault();
    // หมายเหตุ: การค้นหาแบบ client-side ยังคงไว้ สามารถปรับเป็น server-side filter ได้ภายหลัง
    // ตอนนี้เก็บไว้เฉพาะ search state เพื่อแสดง UI
    console.log('Search:', { selectedCustomerId, customerQuery, serviceFilter, serviceQuery });
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
      // แนบ breakdowns เป็น JSON string
      const cleaned = (form.breakdowns || [])
        .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
        .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote }));
      if (cleaned.length > 0) {
        formData.append('breakdowns', JSON.stringify(cleaned));
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

      setShowCreateForm(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('ไม่สามารถเพิ่มรายการได้');
    }
  };

  // ลบรายการ
  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(
        `${api}/api/transactions/${transactionToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowDeleteConfirm(false);
      setTransactionToDelete(null);
      fetchAllData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('ไม่สามารถลบรายการได้');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setForm({
      customerId: '',
      serviceId: '',
      amount: '',
      transactionDate: '',
      notes: '',
      bank: 'KBANK',
      slipImage: null,
      breakdowns: [
        { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }
      ]
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

  const removeSlipPreview = () => {
    setForm({ ...form, slipImage: null });
    setSlipPreview(null);
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
        'KBANK': 'KBANK',
        'SCB': 'SCB',
        'BBL': 'BBL',
        'KTB': 'KTB',
        'TTB': 'TTB',
        'BAY': 'BAY'
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

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <ExclamationTriangleFill />
          <h3>ยืนยันการลบ</h3>
        </div>
        <div className="modal-body">
          คุณแน่ใจหรือไม่ว่าต้องการลบรายการเติมเงินนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="all-transaction-page fade-up">
      {showDeleteConfirm && <DeleteConfirmModal />}
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
            {totalRecords > pageSize && (
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
                  disabled={currentPage >= totalPages}
                >
                  Next ›
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                >
                  Last »
                </button>
                <div className="pagination-info">
                  {(() => {
                    const startIndex = (currentPage - 1) * pageSize + 1;
                    const endIndex = Math.min(currentPage * pageSize, totalRecords);
                    return `แสดง ${startIndex}–${endIndex} จาก ${totalRecords}`;
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

      {/* Create Form Modal - outside container for proper overlay */}
      {showCreateForm && (
        <div className="svc-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>เพิ่มรายการโอนเงินใหม่</h3>
            <form onSubmit={handleCreate} className="svc-form">
              <label>
                เลือกลูกค้า *
                <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">-- เลือกลูกค้า --</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                เลือกบริการ *
                <select value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })} required disabled={!form.customerId}>
                  <option value="">-- เลือกบริการ --</option>
                  {services
                    .filter(service => service.customerId === form.customerId || service.customerId?._id === form.customerId)
                    .map(service => (
                      <option key={service._id} value={service._id}>
                        {service.name} - {service.customerIdField || service.cid || '-'} — {service.pageUrl || '-'}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                จำนวนเงิน (บาท)
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label>
                วันที่โอน
                <input
                  type="date"
                  value={form.transactionDate}
                  onChange={e => setForm({ ...form, transactionDate: e.target.value })}
                  required
                />
              </label>
              <label>
                บัญชีธนาคาร
                <select
                  value={form.bank}
                  onChange={e => setForm({ ...form, bank: e.target.value })}
                >
                  <option value="KBANK">KBANK (กสิกรไทย)</option>
                  <option value="SCB">SCB (ไทยพาณิชย์)</option>
                  <option value="BBL">BBL (กรุงเทพ)</option>
                </select>
              </label>
              {/* Breakdown Rows */}
              <div style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>แยกสัดส่วนการโอนเงิน</strong>
                </div>
                <div style={{ fontSize: '0.9rem', color: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginTop: 4 }}>
                  ยอดรวม: {breakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท {form.amount ? `(ยอดทั้งหมด ${parseFloat(form.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)` : ''}
                </div>
                {form.breakdowns.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.8fr 1fr auto', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                    {/* Add button moved to front as small + icon, appears only on last row */}
                    <div>
                      {idx === form.breakdowns.length - 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={addBreakdownRow}
                          title="เพิ่มแถว"
                          style={{ padding: '4px 10px', lineHeight: 1 }}
                        >
                          +
                        </button>
                      )}
                    </div>
                    <select value={row.code} onChange={e => updateBreakdown(idx, 'code', e.target.value)} disabled={row.isAutoVat} style={{ minWidth: 0 }}>
                      {BREAKDOWN_CODE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="ยอดเงิน"
                        value={row.amount}
                        onChange={e => updateBreakdown(idx, 'amount', e.target.value)}
                        style={{ 
                          flex: '1 1 auto',
                          minWidth: 0,
                          paddingRight: row.code !== '12' && row.code !== '13' ? '95px' : '8px'
                        }}
                        disabled={row.isAutoVat}
                      />
                      {/* ปุ่มคำนวณ VAT อยู่ภายในฟิลด์ยอดเงิน */}
                      {row.code !== '12' && row.code !== '13' && (
                        <button
                          type="button"
                          onClick={() => computeVatForRow(idx)}
                          title="คำนวณ VAT 7%"
                          style={{
                            position: 'absolute',
                            right: '4px',
                            padding: '3px 7px',
                            border: '1px solid #d3d8e2',
                            background: '#f8f9fa',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontSize: '10px',
                            color: '#334155',
                            fontWeight: '500'
                          }}
                        >
                          คำนวณ VAT
                        </button>
                      )}
                    </div>
                    <select value={row.statusNote} onChange={e => updateBreakdown(idx, 'statusNote', e.target.value)} style={{ minWidth: 0 }}>
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
                      {form.breakdowns.length > 1 && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeBreakdownRow(idx)} style={{ whiteSpace: 'nowrap' }}>ลบ</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* หมายเหตุอยู่หลังแยกสัดส่วนและก่อนอัปโหลดสลิป */}
              <label>
                หมายเหตุ
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม"
                />
              </label>
              <label>
                อัปโหลดสลิปโอนเงิน
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  style={{ marginTop: '8px' }}
                />
                {slipPreview && (
                  <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                    <img src={slipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd' }} />
                    <button
                      type="button"
                      onClick={removeSlipPreview}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px' }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </label>
              <div className="svc-actions">
                <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreateForm(false)}>
                  <XCircle /> ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-modal btn-modal-save"
                  disabled={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2)}
                  title={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Slip Modal */}
      {viewSlip && <SlipViewModal />}
    </div>
  );
}
