import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wallet, Plus, Search, TrashFill, Eye, XCircle, ExclamationTriangleFill, CashCoin, Google, Facebook, Upload, Send, PencilSquare } from 'react-bootstrap-icons';
import './AllTransactionPage.css';
import '../shared/DashboardPage.css'; // reuse service-badge styles
import './TransactionHistoryPage.css'; // reuse slip upload button styles
import '../shared/ImageGalleryPage.css'; // reuse combobox and search styles to match gallery
import './CustomerServicesPage.css'; // reuse svc-modal styles for create form
import EditTransactionModal from '../../components/EditTransactionModal';
import { getImageUrl } from '../../utils/imageHelper';

export default function AllTransactionPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pagination (client-side)
  const pageSize = 6;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewSlip, setViewSlip] = useState(null);
  const [uploadingId, setUploadingId] = useState(null); // อัปโหลดสลิปรายแถว
  const [submittingId, setSubmittingId] = useState(null); // ส่งรายการให้บัญชี
  const [editTx, setEditTx] = useState(null); // รายการที่กำลังแก้ไข
  const [form, setForm] = useState({
    customerId: '',
    serviceEntries: [
      { serviceId: '', amount: '', breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }] }
    ],
    transactionDate: new Date().toISOString().split('T')[0],
    transactionTime: '',
    notes: '',
    bank: 'KBANK',
    slipImage: null,
  });
  const [slipPreview, setSlipPreview] = useState(null);
  // searchable customer combobox in create form
  const [formCustomerQuery, setFormCustomerQuery] = useState('');
  const [showFormCustomerDropdown, setShowFormCustomerDropdown] = useState(false);
  // collapse/expand state for service entries
  const [expandedEntries, setExpandedEntries] = useState(new Set([0]));

  // เมื่อเปลี่ยนลูกค้าในฟอร์ม ให้รีเซ็ต serviceId ทุก entry
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map(e => ({ ...e, serviceId: '' }))
    }));
  }, [form.customerId]);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // ====== Breakdown Rows UI Handlers ======
  const BREAKDOWN_CODE_OPTIONS = [
    { value: '9', label: '9 : หัก ณ ที่จ่าย 2% ค่าคลิก' },
    { value: '10', label: '10 : หัก ณ ที่จ่าย 3% ค่าบริการ' },
    { value: '11', label: '11 : ค่าคลิก' },
    { value: '12', label: '12 : Vat ค่าคลิก' },
    { value: '13', label: '13 : Vat ค่าบริการ Google' },
    { value: '14', label: '14 : ค่าบริการ Google' },
    { value: '15', label: '15 : ค่าบริการบางส่วน' },
    { value: '16', label: '16 : คูปอง Google' },
    { value: '17', label: '17 : Vat ค่าบริการ Facebook' },
    { value: '18', label: '18 : ค่าบริการ Facebook' },
    { value: '19', label: '19 : Vat ค่าบริการ Hosting Domain' },
    { value: '20', label: '20 : ค่าบริการ Hosting Domain' }
  ];
  const STATUS_OPTIONS = [
    { value: 'รอบันทึกบัญชี', label: 'รอบันทึกบัญชี' },
    { value: 'ค่าคลิกที่ยังไม่ต้องเติม', label: 'ค่าคลิกที่ยังไม่ต้องเติม' }
  ];

  const addBreakdownRow = (entryIdx) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, ei) =>
        ei !== entryIdx ? entry : {
          ...entry,
          breakdowns: [...(entry.breakdowns || []), { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
        }
      )
    }));
  };

  const removeBreakdownRow = (entryIdx, idx) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, ei) => {
        if (ei !== entryIdx) return entry;
        const rows = [...(entry.breakdowns || [])];
        const current = rows[idx];
        const next = rows[idx + 1];
        const shouldRemovePair = current && !current.isAutoVat && next && next.isAutoVat;
        const newRows = rows.filter((_, i) => {
          if (shouldRemovePair) return i !== idx && i !== idx + 1;
          return i !== idx;
        });
        if (newRows.length === 0) newRows.push({ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
        return { ...entry, breakdowns: newRows };
      })
    }));
  };

  const updateBreakdown = (entryIdx, idx, key, value) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, ei) =>
        ei !== entryIdx ? entry : {
          ...entry,
          breakdowns: entry.breakdowns.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
        }
      )
    }));
  };

  const addServiceEntry = () => {
    setForm(prev => ({
      ...prev,
      serviceEntries: [...prev.serviceEntries, { serviceId: '', amount: '', breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }] }]
    }));
    setExpandedEntries(prev => {
      const next = new Set(prev);
      next.add(form.serviceEntries.length); // index of the new entry
      return next;
    });
  };

  const removeServiceEntry = (entryIdx) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.filter((_, i) => i !== entryIdx)
    }));
    setExpandedEntries(prev => {
      const next = new Set();
      prev.forEach(i => { if (i < entryIdx) next.add(i); else if (i > entryIdx) next.add(i - 1); });
      return next;
    });
  };

  const toggleEntry = (entryIdx) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryIdx)) next.delete(entryIdx); else next.add(entryIdx);
      return next;
    });
  };

  const updateServiceEntry = (entryIdx, key, value) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, i) => i === entryIdx ? { ...entry, [key]: value } : entry)
    }));
  };

  const computeVatForRow = (entryIdx, idx) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, ei) => {
        if (ei !== entryIdx) return entry;
        const rows = [...(entry.breakdowns || [])];
        const current = rows[idx] || { amount: '', code: '11', statusNote: 'รอบันทึกบัญชี', isAutoVat: false };
        if (current.code === '12' || current.code === '13' || current.code === '17' || current.code === '19') {
          alert('ไม่สามารถคำนวณ VAT จากรายการ VAT ได้');
          return entry;
        }
        const base = parseFloat(current.amount);
        if (Number.isNaN(base) || base <= 0) {
          alert('กรุณากรอกยอดเงินในช่องนี้ก่อนคำนวณ VAT');
          return entry;
        }
        const vat = Math.round(base * 0.07 * 100) / 100;
        let vatCode = '12';
        if (current.code === '14') vatCode = '13';
        else if (current.code === '18') vatCode = '17';
        else if (current.code === '20') vatCode = '19';
        rows.splice(idx + 1, 0, { code: vatCode, amount: vat.toFixed(2), statusNote: current.statusNote, isAutoVat: true });
        return { ...entry, breakdowns: rows };
      })
    }));
  };

  // ดึงข้อมูลทั้งหมด (client-side pagination)
  const fetchAllData = async (signal) => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` }, ...(signal ? { signal } : {}) };
      
      // ดึงข้อมูลลูกค้า, บริการ และ transactions (จำกัด 500 รายการล่าสุดที่ยังรอ/ถูกปฏิเสธ)
      const [customersRes, servicesRes, transactionsRes] = await Promise.all([
        axios.get(`${api}/api/customers`, authHeaders),
        axios.get(`${api}/api/services`, authHeaders),
        axios.get(`${api}/api/transactions?limit=500`, authHeaders)
      ]);
      
      setCustomers(customersRes.data);
      setServices(servicesRes.data);

      // จัดรูปแบบข้อมูล transactions พร้อม customer และ service
      const allTransactions = transactionsRes.data.transactions || transactionsRes.data;
      
      const formattedTransactions = allTransactions
        .filter(tx => {
          // แสดงเฉพาะรายการที่ยังไม่ส่ง (null/undefined/none) หรือถูกปฏิเสธ (rejected)
          // ไม่แสดง: submitted (รอการอนุมัติ) และ approved (อนุมัติแล้ว)
          const shouldShow = !tx.submissionStatus || tx.submissionStatus === 'none' || tx.submissionStatus === 'rejected';
          return shouldShow;
        })
        .map(tx => ({
          ...tx,
          service: tx.serviceId || {},
          // ใช้ customerId จาก service (populate) ให้เหมือนมุมมองใน TransactionHistoryPage
          customer: tx.serviceId?.customerId || {}
        }));

      setTransactions(formattedTransactions);
      setFilteredTransactions(formattedTransactions);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('Error fetching data:', error);
      alert('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAllData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เมื่อเปลี่ยนลูกค้าใน combobox ให้รีเซ็ตบริการ
  useEffect(() => {
    setServiceFilter('');
    // setServiceQuery(''); // Removed duplicate reset, already handled in combobox onMouseDown
  }, [selectedCustomerId]);

  const handleSearch = (e) => {
    e.preventDefault();
    
    // กรองข้อมูล client-side ตาม selectedCustomerId และ serviceFilter
    // แสดงเฉพาะรายการที่ยังไม่ส่ง หรือถูกปฏิเสธ
    let filtered = transactions.filter(tx => {
      return !tx.submissionStatus || tx.submissionStatus === 'none' || tx.submissionStatus === 'rejected';
    });
    
    // กรองตามลูกค้า
    if (selectedCustomerId) {
      filtered = filtered.filter(tx => {
        const customerId = tx.customer?._id || tx.service?.customerId?._id;
        return customerId === selectedCustomerId;
      });
    }
    
    // กรองตามบริการ
    if (serviceFilter) {
      filtered = filtered.filter(tx => {
        return tx.service?.name === serviceFilter;
      });
    }
    
    setFilteredTransactions(filtered);
    setCurrentPage(1); // รีเซ็ตกลับไปหน้าแรก
  };

  // สร้างรายการเติมเงินใหม่
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.transactionDate) {
      alert('กรุณาเลือกวันที่โอน');
      return;
    }
    for (const entry of form.serviceEntries) {
      if (!entry.serviceId || !entry.amount) {
        alert('กรุณากรอกข้อมูลบริการและจำนวนเงินให้ครบทุกรายการ');
        return;
      }
    }

    try {
      let sharedSlipUrl = null;
      let sharedCloudinaryId = null;

      for (let i = 0; i < form.serviceEntries.length; i++) {
        const entry = form.serviceEntries[i];
        const formData = new FormData();
        formData.append('amount', parseFloat(entry.amount));
        formData.append('transactionDate', form.transactionDate);
        if (form.transactionTime) formData.append('transactionTime', form.transactionTime);
        formData.append('notes', form.notes || '');
        formData.append('bank', form.bank);

        if (i === 0 && form.slipImage) {
          formData.append('slipImage', form.slipImage);
        } else if (sharedSlipUrl) {
          formData.append('slipImageUrl', sharedSlipUrl);
          if (sharedCloudinaryId) formData.append('slipCloudinaryId', sharedCloudinaryId);
        }

        const cleaned = (entry.breakdowns || [])
          .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
          .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote, isAutoVat: r.isAutoVat || false }));
        if (cleaned.length > 0) {
          formData.append('breakdowns', JSON.stringify(cleaned));
        }

        const res = await axios.post(
          `${api}/api/services/${entry.serviceId}/transactions`,
          formData,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
        );

        if (i === 0 && res.data?.slipImage) {
          sharedSlipUrl = res.data.slipImage;
          sharedCloudinaryId = res.data.cloudinaryId || null;
        }
      }

      setShowCreateForm(false);
      resetForm();
      await fetchAllData();
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
      serviceEntries: [
        { serviceId: '', amount: '', breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }] }
      ],
      transactionDate: new Date().toISOString().split('T')[0],
      transactionTime: '',
      notes: '',
      bank: 'KBANK',
      slipImage: null,
    });
    setSlipPreview(null);
    setFormCustomerQuery('');
    setExpandedEntries(new Set([0]));
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
    '9': 'หัก ณ ที่จ่าย 2% ค่าคลิก',
    '10': 'หัก ณ ที่จ่าย 3% ค่าบริการ',
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
    const bankNames = {
        'KBANK': 'KBANK',
        'SCB': 'SCB',
        'BBL': 'BBL',
        'BAY-4396': 'BAY-4396',
        'BAY-7146': 'BAY-7146',
        'Cr.-8508': 'Cr.-8508',
        'BBL-ส่วนตัว': 'BBL-ส่วนตัว'
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

  // ส่งรายการไปให้ทีมบัญชี (placeholder ถ้า backend ยังไม่มี endpoint จะโชว์ข้อความแจ้ง)
  const handleSubmitTransaction = async (txId) => {
    try {
      setSubmittingId(txId);
      const res = await axios.put(
        `${api}/api/transactions/${txId}/submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedRaw = res.data || {};
      const updated = {
        ...updatedRaw,
        service: updatedRaw.serviceId || {},
        customer: updatedRaw.serviceId?.customerId || {}
      };
      setTransactions(transactions.map(t => (t._id === txId ? updated : t)));
      setFilteredTransactions(filteredTransactions.map(t => (t._id === txId ? updated : t)));
      alert('ส่งรายการไปยังทีมบัญชีแล้ว');
    } catch (err) {
      alert('ยังไม่สามารถส่งรายการได้ (backend ยังไม่รองรับ)');
    } finally {
      setSubmittingId(null);
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
          <img src={getImageUrl(viewSlip?.url, api)} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block' }} />
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
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '14px' }}>
            {transactions.length > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                  <CashCoin size={20} />
                  <div>
                    <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวมทั้งหมด</div>
                    <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                      {formatCurrency(transactions.reduce((sum, tx) => sum + tx.amount, 0))}
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
            <button className="btn-header-upload" onClick={() => setShowCreateForm(true)}>
              <Plus /> เพิ่มรายการ
            </button>
          </div>
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
                    return pageItems.map((tx) => {
                      const isRejected = tx.submissionStatus === 'rejected';
                      return (
                    <tr key={tx._id} className={isRejected ? 'rejected-transaction' : ''}>
                      <td>
                        <div>{formatDate(tx.transactionDate)}</div>
                        {tx.transactionTime && <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>{tx.transactionTime}</div>}
                      </td>
                      <td>
                        <div className="customer-info">
                          <span className="customer-name">{tx.customer?.name || '-'}</span>
                        </div>
                      </td>
                      <td>
                        {tx.service ? (
                          <span className={`service-badge ${
                            (tx.service.serviceType || tx.service.name) === 'Facebook Ads' ? 'facebook' :
                            (tx.service.serviceType || tx.service.name) === 'Google Ads' ? 'google' :
                            'other'
                          }`}>
                            {(tx.service.serviceType || tx.service.name) === 'Facebook Ads' && <Facebook className="service-icon" />}
                            {(tx.service.serviceType || tx.service.name) === 'Google Ads' && <Google className="service-icon" />}
                            <span className="service-id-text">{tx.service.cid || tx.service.customerIdField || '-'}</span>
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
                              title={uploadingId === tx._id ? 'กำลังอัปโหลด...' : 'อัปโหลดสลิป'}
                            >
                              {uploadingId === tx._id ? (
                                <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                              ) : (
                                <Upload />
                              )}
                              <span>{uploadingId === tx._id ? 'กำลังอัปโหลด...' : 'เพิ่มสลิป'}</span>
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
                          {tx.notes && <div className="note-text" style={{ marginBottom: tx.breakdowns?.length ? '6px' : 0 }}>{tx.notes}</div>}
                          {tx.breakdowns && tx.breakdowns.length > 0 && (
                            <div className="breakdowns">
                              {tx.breakdowns.map((bd, idx) => {
                                const label = breakdownCodeLabels[bd.code] || bd.code;
                                const isDeduction = bd.code === '9' || bd.code === '10';
                                const isVat = bd.code === '12' || bd.code === '13' || bd.code === '17' || bd.code === '19';
                                const amountColor = isDeduction ? '#dc2626' : isVat ? '#7c3aed' : '#1d4ed8';
                                return (
                                  <div key={idx} className="breakdown-item" style={{ marginBottom: '4px' }}>
                                    <span className="bd-code" style={{ background: isDeduction ? '#fee2e2' : isVat ? '#ede9fe' : '#eff6ff', color: isDeduction ? '#b91c1c' : isVat ? '#6d28d9' : '#1d4ed8' }}>{bd.code}</span>
                                    <span className="bd-sep"> :</span>{' '}
                                    <span className="bd-label">{label}:</span>{' '}
                                    <span className="bd-amount" style={{ color: amountColor, fontWeight: '600' }}>{formatNumber(bd.amount)} บาท</span>
                                    {bd.statusNote && (
                                      <span
                                        className="bd-status"
                                        style={{
                                          display: 'inline-block',
                                          marginLeft: '6px',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.75rem',
                                          background: bd.statusNote === 'ค่าคลิกที่ยังไม่ต้องเติม' ? '#fef9c3' : '#f0fdf4',
                                          color: bd.statusNote === 'ค่าคลิกที่ยังไม่ต้องเติม' ? '#92400e' : '#15803d',
                                          border: `1px solid ${bd.statusNote === 'ค่าคลิกที่ยังไม่ต้องเติม' ? '#fde68a' : '#86efac'}`,
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {bd.statusNote}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!tx.notes && (!tx.breakdowns || tx.breakdowns.length === 0) && '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button
                            className="btn-edit-small"
                            onClick={() => setEditTx(tx)}
                            title="แก้ไขรายการ"
                          >
                            <PencilSquare />
                          </button>
                          {tx.submissionStatus === 'submitted' ? (
                            <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>ส่งแล้ว</span>
                          ) : (
                            <button
                              className="btn-submit-small"
                              onClick={() => handleSubmitTransaction(tx._id)}
                              disabled={submittingId === tx._id}
                              title={submittingId === tx._id ? 'กำลังส่ง...' : 'ส่งให้บัญชี'}
                            >
                              {submittingId === tx._id ? (
                                <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                              ) : (
                                <Send />
                              )}
                              <span>ส่ง</span>
                            </button>
                          )}
                          <button
                            className="btn-delete-small"
                            onClick={() => {
                              setTransactionToDelete(tx);
                              setShowDeleteConfirm(true);
                            }}
                            title="ลบรายการ"
                          >
                            <TrashFill />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {(() => {
              const filteredTotal = filteredTransactions.length;
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

      {/* Create Form Modal - outside container for proper overlay */}
      {showCreateForm && (
        <div className="svc-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '95vw' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>เพิ่มรายการโอนเงินใหม่</h3>
            <form onSubmit={handleCreate} className="svc-form">

              {/* ── ข้อมูลหลัก ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px', alignItems: 'start' }}>
                <label style={{ gridColumn: '1 / -1', display: 'block' }}>
                  เลือกลูกค้า *
                  <div className="combo" style={{ marginTop: '4px' }}>
                    <input
                      className="combo-input"
                      type="text"
                      placeholder="พิมพ์ค้นหาชื่อลูกค้า..."
                      value={formCustomerQuery}
                      onChange={e => {
                        setFormCustomerQuery(e.target.value);
                        setShowFormCustomerDropdown(true);
                        if (!e.target.value) setForm(prev => ({ ...prev, customerId: '' }));
                      }}
                      onFocus={() => setShowFormCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowFormCustomerDropdown(false), 150)}
                      autoComplete="off"
                      required={!form.customerId}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: form.customerId ? '1px solid #86efac' : '1px solid #ccc' }}
                    />
                    {showFormCustomerDropdown && (
                      <div className="combo-panel">
                        {customers.filter(c => c.name.toLowerCase().includes(formCustomerQuery.toLowerCase())).map(c => (
                          <div key={c._id} className="combo-item" onMouseDown={() => { setForm(prev => ({ ...prev, customerId: c._id })); setFormCustomerQuery(c.name); setShowFormCustomerDropdown(false); }}>
                            {c.name}
                          </div>
                        ))}
                        {customers.filter(c => c.name.toLowerCase().includes(formCustomerQuery.toLowerCase())).length === 0 && (
                          <div className="combo-item" style={{ color: '#9ca3af' }}>ไม่พบลูกค้า</div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label style={{ display: 'block' }}>
                  วันที่โอน *
                  <input type="date" value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} required
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} />
                </label>
                <label style={{ display: 'block' }}>
                  เวลาที่โอน
                  <input type="text" value={form.transactionTime} onChange={e => setForm({ ...form, transactionTime: e.target.value })} placeholder="14:30" pattern="[0-2][0-9]:[0-5][0-9]" maxLength="5"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} />
                </label>
                <label style={{ display: 'block' }}>
                  บัญชีธนาคาร
                  <select value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}>
                    <option value="KBANK">KBANK</option>
                    <option value="SCB">SCB</option>
                    <option value="BBL">BBL</option>
                    <option value="BAY-4396">BAY-4396</option>
                    <option value="BAY-7146">BAY-7146</option>
                    <option value="Cr.-8508">Cr.-8508</option>
                    <option value="BBL-ส่วนตัว">BBL-ส่วนตัว</option>
                  </select>
                </label>
                <label style={{ display: 'block' }}>
                  หมายเหตุ
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="เลขอ้างอิง, หมายเหตุ..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px', resize: 'vertical' }} />
                </label>
              </div>

              {/* ── Summary Bar ── */}
              {form.serviceEntries.some(e => e.amount) && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600', color: '#1d4ed8' }}>สรุปยอดรวม</span>
                    <span style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '1rem' }}>
                      ฿{form.serviceEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {form.serviceEntries.map((entry, i) => {
                    const svc = services.find(s => s._id === entry.serviceId);
                    const bdSum = (entry.breakdowns || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                    const mismatch = entry.amount && bdSum.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                    return entry.amount ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: '1px solid #dbeafe', color: mismatch ? '#dc2626' : '#374151' }}>
                        <span>{svc ? `${svc.name} - ${svc.cid || svc.customerIdField || '-'}` : `บริการที่ ${i + 1}`}</span>
                        <span style={{ fontWeight: '600' }}>฿{parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}{mismatch ? ' ⚠️' : ''}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              {/* ── Service Entries ── */}
              {form.serviceEntries.map((entry, entryIdx) => {
                const isExpanded = expandedEntries.has(entryIdx);
                const entryBdSum = (entry.breakdowns || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                const mismatch = entry.amount && entryBdSum.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                const svc = services.find(s => s._id === entry.serviceId);
                return (
                  <div key={entryIdx} style={{ border: `1px solid ${mismatch ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
                    {/* Header (always visible) */}
                    <div
                      onClick={() => toggleEntry(entryIdx)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isExpanded ? '#f0f9ff' : '#f8fafc', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{entryIdx + 1}</span>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                          {svc ? `${svc.name} — ${svc.cid || svc.customerIdField || '-'}` : 'เลือกบริการ...'}
                        </span>
                        {entry.amount && (
                          <span style={{ fontSize: '0.88rem', color: mismatch ? '#dc2626' : '#16a34a', fontWeight: '600' }}>
                            ฿{parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            {mismatch && ' ⚠️ breakdown ไม่ตรง'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {form.serviceEntries.length > 1 && (
                          <button type="button" onClick={e => { e.stopPropagation(); removeServiceEntry(entryIdx); }}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                            ✕
                          </button>
                        )}
                        <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Body (collapsible) */}
                    {isExpanded && (
                      <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
                        <label>
                          เลือกบริการ *
                          <select value={entry.serviceId} onChange={e => updateServiceEntry(entryIdx, 'serviceId', e.target.value)} required disabled={!form.customerId} style={{ width: '100%', marginTop: '4px' }}>
                            <option value="">-- เลือกบริการ --</option>
                            {services.filter(s => s.customerId === form.customerId || s.customerId?._id === form.customerId).map(s => (
                              <option key={s._id} value={s._id}>{s.name} - {s.customerIdField || s.cid || '-'} — {s.pageUrl || '-'}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ marginTop: '10px', display: 'block' }}>
                          จำนวนเงิน (บาท) *
                          <input type="number" step="0.01" value={entry.amount} onChange={e => updateServiceEntry(entryIdx, 'amount', e.target.value)} required placeholder="0.00"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} />
                        </label>

                        {/* Breakdown */}
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.88rem', color: '#374151' }}>แยกสัดส่วน</span>
                            <span style={{ fontSize: '0.82rem', color: mismatch ? '#dc2626' : '#6c757d' }}>
                              รวม ฿{entryBdSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} {entry.amount ? `/ ฿${parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : ''}
                            </span>
                          </div>
                          {entry.breakdowns.map((row, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.6fr 1fr auto', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                              <div>
                                {idx === entry.breakdowns.length - 1 && (
                                  <button type="button" className="btn btn-sm btn-primary" onClick={() => addBreakdownRow(entryIdx)} style={{ padding: '4px 8px', lineHeight: 1 }}>+</button>
                                )}
                              </div>
                              <select value={row.code} onChange={e => {
                                const newCode = e.target.value;
                                // ถ้าเลือกรหัส 9 ให้ตรวจสอบว่ามีรายการรหัส 11 อยู่ในแถวอื่นหรือไม่
                                if (newCode === '9' && !entry.breakdowns.some((b, i) => i !== idx && b.code === '11')) {
                                  alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่าย 2% ได้');
                                  return;
                                }
                                // ถ้าเลือกรหัส 10 ให้ตรวจสอบว่ามีรายการรหัส 14, 18 หรือ 15 อยู่ในแถวอื่นหรือไม่
                                if (newCode === '10' && !entry.breakdowns.some((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'))) {
                                  alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่าย 3% ได้');
                                  return;
                                }

                                if (newCode === '9') {
                                  const idx11 = entry.breakdowns.findIndex((b, i) => i !== idx && b.code === '11');
                                  if (idx11 !== -1) {
                                    const row11 = entry.breakdowns[idx11];
                                    const amount11 = parseFloat(row11.amount) || 0;
                                    if (amount11 > 0) {
                                      const w = Math.round(amount11 * 0.02 * 100) / 100;
                                      setForm(prev => ({
                                        ...prev,
                                        serviceEntries: prev.serviceEntries.map((ent, ei) => {
                                          if (ei !== entryIdx) return ent;
                                          return {
                                            ...ent,
                                            breakdowns: ent.breakdowns.map((r, i) => {
                                              if (i === idx) {
                                                return { ...r, code: '9', amount: (-w).toFixed(2) };
                                              }
                                              return r;
                                            })
                                          };
                                        })
                                      }));
                                      return;
                                    }
                                  }
                                }

                                if (newCode === '10') {
                                  // หาแถวรหัส 14, 15 หรือ 18 แถวแรก (ไม่รวมแถวปัจจุบัน)
                                  const idxSrc = entry.breakdowns.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '15' || b.code === '18'));
                                  if (idxSrc !== -1) {
                                    const rowSrc = entry.breakdowns[idxSrc];
                                    const amountSrc = parseFloat(rowSrc.amount) || 0;
                                    if (amountSrc > 0) {
                                      const w = Math.round(amountSrc * 0.03 * 100) / 100;
                                      setForm(prev => ({
                                        ...prev,
                                        serviceEntries: prev.serviceEntries.map((ent, ei) => {
                                          if (ei !== entryIdx) return ent;
                                          return {
                                            ...ent,
                                            breakdowns: ent.breakdowns.map((r, i) => {
                                              if (i === idx) {
                                                return { ...r, code: '10', amount: (-w).toFixed(2) };
                                              }
                                              return r;
                                            })
                                          };
                                        })
                                      }));
                                      return;
                                    }
                                  }
                                }

                                updateBreakdown(entryIdx, idx, 'code', newCode);
                              }} disabled={row.isAutoVat} style={{ minWidth: 0, fontSize: '0.82rem' }}>
                                {BREAKDOWN_CODE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                              </select>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                <input type="number" step="0.01" placeholder="ยอดเงิน" value={row.amount}
                                  onChange={e => updateBreakdown(entryIdx, idx, 'amount', e.target.value)}
                                  style={{ flex: '1 1 auto', minWidth: 0, paddingRight: row.code !== '12' && row.code !== '13' && row.code !== '17' && row.code !== '19' ? '80px' : '8px' }}
                                  disabled={row.isAutoVat} />
                                {row.code !== '12' && row.code !== '13' && row.code !== '17' && row.code !== '19' && (
                                  <button type="button" onClick={() => computeVatForRow(entryIdx, idx)}
                                    style={{ position: 'absolute', right: '4px', padding: '2px 6px', border: '1px solid #d3d8e2', background: '#f8f9fa', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '9px', color: '#334155', fontWeight: '600' }}>
                                    +VAT 7%
                                  </button>
                                )}
                              </div>
                              <select value={row.statusNote} onChange={e => updateBreakdown(entryIdx, idx, 'statusNote', e.target.value)} style={{ minWidth: 0, fontSize: '0.82rem' }}>
                                {STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                              </select>
                              <div>
                                {entry.breakdowns.length > 1 && (
                                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeBreakdownRow(entryIdx, idx)} style={{ padding: '3px 7px' }}>✕</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Add Service Button ── */}
              <button type="button" onClick={addServiceEntry} disabled={!form.customerId}
                style={{ width: '100%', padding: '9px', border: '2px dashed #3b82f6', borderRadius: '8px', background: 'transparent', color: '#3b82f6', cursor: form.customerId ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: '500', marginBottom: '14px', opacity: form.customerId ? 1 : 0.45 }}>
                + เพิ่มบริการอีกรายการ (สลิปเดียวกัน)
              </button>

              {/* ── Slip Upload ── */}
              <label>
                อัปโหลดสลิปโอนเงิน
                <input type="file" accept="image/*" onChange={handleSlipChange} style={{ marginTop: '8px' }} />
                {slipPreview && (
                  <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                    <img src={slipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd' }} />
                    <button type="button" onClick={removeSlipPreview}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '16px' }}>
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
                  disabled={form.serviceEntries.some(entry => {
                    const s = (entry.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    return s.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                  })}
                  title={form.serviceEntries.some(entry => {
                    const s = (entry.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    return s.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                  }) ? 'ยอดรวม breakdown ไม่ตรงกับยอดเงินบางรายการ' : ''}
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

      {/* Edit Transaction Modal */}
      {editTx && (
        <EditTransactionModal
          open={!!editTx}
          onClose={() => setEditTx(null)}
          transaction={editTx}
          token={token}
          api={api}
          onSaved={(updated) => {
            // Update transaction in the list
            setTransactions(prev => prev.map(t => (
              t._id === updated._id ? {
                ...updated,
                service: updated.serviceId || {},
                customer: updated.serviceId?.customerId || {}
              } : t
            )));
            setFilteredTransactions(prev => prev.map(t => (
              t._id === updated._id ? {
                ...updated,
                service: updated.serviceId || {},
                customer: updated.serviceId?.customerId || {}
              } : t
            )));
          }}
          onResubmitted={(updated) => {
            // Remove from list when resubmitted (goes to submitted status)
            fetchAllData();
          }}
        />
      )}
    </div>
  );
}
