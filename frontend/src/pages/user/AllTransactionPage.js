import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Wallet, Plus, Search, TrashFill, Eye, XCircle, ExclamationTriangleFill, CashCoin, Google, Facebook, Upload, Send, PencilSquare, Person, Calendar, Clock, Bank, FileText, Image, Gear, ListCheck, Calculator } from 'react-bootstrap-icons';
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

  const VAT_CODES = ['12', '13', '17', '19'];

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
    { value: '7', label: '7 : หัก ณ ที่จ่าย 3% ค่าคลิก' },
    { value: '8', label: '8 : หัก ณ ที่จ่าย 2% ค่าบริการ' },
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

  // คำนวณหัก ณ ที่จ่ายอัตโนมัติ
  const computeWithholdingTax = (entryIdx, idx, code) => {
    setForm(prev => ({
      ...prev,
      serviceEntries: prev.serviceEntries.map((entry, ei) => {
        if (ei !== entryIdx) return entry;
        const rows = [...(entry.breakdowns || [])];
        if (!rows[idx]) return entry;

        // หัก ณ ที่จ่าย 3% ค่าคลิก (code 7) - ใช้ code 11 เป็นฐาน
        if (code === '7') {
          const idx11 = rows.findIndex((b, i) => i !== idx && b.code === '11');
          if (idx11 === -1) {
            alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อน');
            return entry;
          }
          const row11 = rows[idx11];
          const amount11 = parseFloat(row11.amount) || 0;
          if (amount11 <= 0) {
            alert('กรุณากรอกยอดเงินในรหัส 11 ก่อน');
            return entry;
          }
          const w = Math.round(amount11 * 0.03 * 100) / 100;
          rows[idx] = { ...rows[idx], code: '7', amount: (-w).toFixed(2) };
          return { ...entry, breakdowns: rows };
        }

        // หัก ณ ที่จ่าย 2% ค่าบริการ (code 8) - ใช้ code 14, 18, 15 เป็นฐาน
        if (code === '8') {
          const idxSrc = rows.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'));
          if (idxSrc === -1) {
            alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อน');
            return entry;
          }
          const rowSrc = rows[idxSrc];
          const amountSrc = parseFloat(rowSrc.amount) || 0;
          if (amountSrc <= 0) {
            alert('กรุณากรอกยอดเงินในรหัส 14, 18 หรือ 15 ก่อน');
            return entry;
          }
          const w = Math.round(amountSrc * 0.02 * 100) / 100;
          rows[idx] = { ...rows[idx], code: '8', amount: (-w).toFixed(2) };
          return { ...entry, breakdowns: rows };
        }

        // หัก ณ ที่จ่าย 2% ค่าคลิก (code 9) - ใช้ code 11 เป็นฐาน
        if (code === '9') {
          const idx11 = rows.findIndex((b, i) => i !== idx && b.code === '11');
          if (idx11 === -1) {
            alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อน');
            return entry;
          }
          const row11 = rows[idx11];
          const amount11 = parseFloat(row11.amount) || 0;
          if (amount11 <= 0) {
            alert('กรุณากรอกยอดเงินในรหัส 11 ก่อน');
            return entry;
          }
          const w = Math.round(amount11 * 0.02 * 100) / 100;
          rows[idx] = { ...rows[idx], code: '9', amount: (-w).toFixed(2) };
          return { ...entry, breakdowns: rows };
        }

        // หัก ณ ที่จ่าย 3% ค่าบริการ (code 10) - ใช้ code 14, 18, 15 เป็นฐาน
        if (code === '10') {
          const idxSrc = rows.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'));
          if (idxSrc === -1) {
            alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อน');
            return entry;
          }
          const rowSrc = rows[idxSrc];
          const amountSrc = parseFloat(rowSrc.amount) || 0;
          if (amountSrc <= 0) {
            alert('กรุณากรอกยอดเงินในรหัส 14, 18 หรือ 15 ก่อน');
            return entry;
          }
          const w = Math.round(amountSrc * 0.03 * 100) / 100;
          rows[idx] = { ...rows[idx], code: '10', amount: (-w).toFixed(2) };
          return { ...entry, breakdowns: rows };
        }

        return entry;
      })
    }));
  };

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
        if (VAT_CODES.includes(current.code)) {
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

  // Auto-calculate withholding tax
  const handleCodeChange = (entryIdx, idx, newCode) => {
    const entry = form.serviceEntries[entryIdx];
    const rows = [...(entry.breakdowns || [])];
    const current = rows[idx];

    // ตรวจสอบสำหรับ code 7, 8, 9, 10
    if ((newCode === '7' || newCode === '9') && !rows.some((b, i) => i !== idx && b.code === '11')) {
      alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่ายได้');
      return;
    }
    if ((newCode === '8' || newCode === '10') && !rows.some((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'))) {
      alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่ายได้');
      return;
    }

    // คำนวณหัก ณ ที่จ่ายอัตโนมัติ
    if (newCode === '7' || newCode === '8' || newCode === '9' || newCode === '10') {
      computeWithholdingTax(entryIdx, idx, newCode);
      return;
    }

    updateBreakdown(entryIdx, idx, 'code', newCode);
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
    '7': 'หัก ณ ที่จ่าย 3% ค่าคลิก',
    '8': 'หัก ณ ที่จ่าย 2% ค่าบริการ',
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

  // ====== Styled Components for Create Form ======
  const formStyles = {
    sectionCard: {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px 18px',
      marginBottom: '14px',
    },
    sectionTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '0.95rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '14px',
      paddingBottom: '10px',
      borderBottom: '2px solid #e2e8f0',
    },
    sectionIcon: {
      fontSize: '1.1rem',
      color: '#3b82f6',
    },
    fieldLabel: {
      display: 'block',
      fontSize: '0.82rem',
      fontWeight: '600',
      color: '#475569',
      marginBottom: '4px',
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 12px',
      fontSize: '0.92rem',
      borderRadius: '8px',
      border: '1.5px solid #d1d5db',
      background: '#fff',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      outline: 'none',
    },
    inputFocus: {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59,130,246,0.1)',
    },
    select: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 12px',
      fontSize: '0.92rem',
      borderRadius: '8px',
      border: '1.5px solid #d1d5db',
      background: '#fff',
      outline: 'none',
    },
    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '9px 12px',
      fontSize: '0.92rem',
      borderRadius: '8px',
      border: '1.5px solid #d1d5db',
      resize: 'vertical',
      fontFamily: 'inherit',
      outline: 'none',
    },
    serviceCard: {
      border: '1.5px solid #e2e8f0',
      borderRadius: '12px',
      marginBottom: '10px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    },
    serviceHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background 0.2s',
    },
    serviceBody: {
      padding: '16px',
      borderTop: '1.5px solid #e2e8f0',
    },
    breakdownRow: {
      display: 'grid',
      gridTemplateColumns: '32px 1fr 1.4fr 1fr 32px',
      gap: '8px',
      marginTop: '8px',
      alignItems: 'center',
    },
    addServiceBtn: {
      width: '100%',
      padding: '10px',
      border: '2px dashed #93c5fd',
      borderRadius: '10px',
      background: '#f0f7ff',
      color: '#2563eb',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      marginBottom: '14px',
      transition: 'all 0.2s',
    },
    summaryBar: {
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      border: '1px solid #bfdbfe',
      borderRadius: '10px',
      padding: '12px 16px',
      marginBottom: '14px',
    },
    slipUploadArea: {
      border: '2px dashed #d1d5db',
      borderRadius: '10px',
      padding: '20px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#fafafa',
    },
  };

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
                                const isDeduction = bd.code === '7' || bd.code === '8' || bd.code === '9' || bd.code === '10';
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

      {/* Create Form Modal - Redesigned Professional Layout */}
      {showCreateForm && (
        <div className="svc-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', width: '95vw', padding: '28px 30px' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem' }}>
                  <Plus />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>เพิ่มรายการโอนเงินใหม่</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>กรอกข้อมูลรายการโอนเงินให้ครบถ้วน</p>
                </div>
              </div>
              <button onClick={() => setShowCreateForm(false)} style={{ background: 'none', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} type="button">✕</button>
            </div>

            <form onSubmit={handleCreate} className="svc-form" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              
              {/* ── Section 1: ข้อมูลหลัก ── */}
              <div style={formStyles.sectionCard}>
                <div style={formStyles.sectionTitle}>
                  <Person style={formStyles.sectionIcon} />
                  <span>ข้อมูลหลัก</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Customer - Full width */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={formStyles.fieldLabel}>เลือกผู้รับบริการ *</label>
                    <div className="combo">
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
                        style={{ ...formStyles.input, border: form.customerId ? '1.5px solid #86efac' : '1.5px solid #d1d5db' }}
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
                  </div>

                  {/* Date */}
                  <div>
                    <label style={formStyles.fieldLabel}>
                      <Calendar size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      วันที่โอน *
                    </label>
                    <input type="date" value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} required style={formStyles.input} />
                  </div>

                  {/* Time */}
                  <div>
                    <label style={formStyles.fieldLabel}>
                      <Clock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      เวลาที่โอน (AM เท่านั้น)
                    </label>
                    <input 
                      type="text" 
                      value={form.transactionTime} 
                      onChange={e => setForm({ ...form, transactionTime: e.target.value })}
                      onBlur={e => {
                        const timeValue = e.target.value;
                        if (!timeValue) return;
                        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeValue)) {
                          alert('กรุณากรอกเวลาในรูปแบบ HH:MM (เช่น 09:30)');
                          return;
                        }
                        const hour = parseInt(timeValue.split(':')[0], 10);
                        if (hour >= 12) {
                          alert('กรุณากรอกเวลาในช่วง AM (00:00 - 11:59) เท่านั้น');
                        }
                      }}
                      style={formStyles.input}
                      placeholder="HH:MM (เช่น 09:30)"
                    />
                  </div>

                  {/* Bank */}
                  <div>
                    <label style={formStyles.fieldLabel}>
                      <Bank size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      บัญชีธนาคาร
                    </label>
                    <select value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} style={formStyles.select}>
                      <option value="KBANK">KBANK</option>
                      <option value="SCB">SCB</option>
                      <option value="BBL">BBL</option>
                      <option value="BAY-4396">BAY-4396</option>
                      <option value="BAY-7146">BAY-7146</option>
                      <option value="Cr.-8508">Cr.-8508</option>
                      <option value="BBL-ส่วนตัว">BBL-ส่วนตัว</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={formStyles.fieldLabel}>
                      <FileText size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      หมายเหตุ
                    </label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="เลขอ้างอิง, หมายเหตุ..." style={formStyles.textarea} />
                  </div>
                </div>
              </div>

              {/* ── Summary Bar ── */}
              {form.serviceEntries.some(e => e.amount) && (
                <div style={formStyles.summaryBar}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '0.9rem' }}>
                      <Calculator size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      สรุปยอดรวม
                    </span>
                    <span style={{ fontWeight: '800', color: '#1d4ed8', fontSize: '1.1rem' }}>
                      ฿{form.serviceEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {form.serviceEntries.map((entry, i) => {
                    const svc = services.find(s => s._id === entry.serviceId);
                    const bdSum = (entry.breakdowns || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                    const mismatch = entry.amount && bdSum.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                    return entry.amount ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #dbeafe', color: mismatch ? '#dc2626' : '#374151', fontSize: '0.85rem' }}>
                        <span>{svc ? `${svc.name} - ${svc.cid || svc.customerIdField || '-'}` : `บริการที่ ${i + 1}`}</span>
                        <span style={{ fontWeight: '600' }}>฿{parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}{mismatch ? ' ⚠️' : ''}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              {/* ── Section 2: รายการบริการ ── */}
              <div style={formStyles.sectionCard}>
                <div style={formStyles.sectionTitle}>
                  <Gear style={formStyles.sectionIcon} />
                  <span>รายการบริการ</span>
                </div>

                {form.serviceEntries.map((entry, entryIdx) => {
                  const isExpanded = expandedEntries.has(entryIdx);
                  const entryBdSum = (entry.breakdowns || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                  const mismatch = entry.amount && entryBdSum.toFixed(2) !== (parseFloat(entry.amount || 0)).toFixed(2);
                  const svc = services.find(s => s._id === entry.serviceId);
                  return (
                    <div key={entryIdx} style={{ ...formStyles.serviceCard, borderColor: mismatch ? '#fca5a5' : '#e2e8f0' }}>
                      {/* Header */}
                      <div
                        onClick={() => toggleEntry(entryIdx)}
                        style={{ ...formStyles.serviceHeader, background: isExpanded ? '#f0f9ff' : '#f8fafc' }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{entryIdx + 1}</span>
                          <span style={{ fontWeight: '600', fontSize: '0.88rem', color: '#374151' }}>
                            {svc ? `${svc.name} — ${svc.cid || svc.customerIdField || '-'}` : 'เลือกบริการ...'}
                          </span>
                          {entry.amount && (
                            <span style={{ fontSize: '0.85rem', color: mismatch ? '#dc2626' : '#16a34a', fontWeight: '600', background: mismatch ? '#fef2f2' : '#f0fdf4', padding: '2px 8px', borderRadius: '6px' }}>
                              ฿{parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              {mismatch && ' ⚠️'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {form.serviceEntries.length > 1 && (
                            <button type="button" onClick={e => { e.stopPropagation(); removeServiceEntry(entryIdx); }}
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                              ✕
                            </button>
                          )}
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                        </div>
                      </div>

                      {/* Body */}
                      {isExpanded && (
                        <div style={formStyles.serviceBody}>
                          {/* Service Select */}
                          <div style={{ marginBottom: '12px' }}>
                            <label style={formStyles.fieldLabel}>เลือกบริการ *</label>
                            <select value={entry.serviceId} onChange={e => updateServiceEntry(entryIdx, 'serviceId', e.target.value)} required disabled={!form.customerId} style={formStyles.select}>
                              <option value="">-- เลือกบริการ --</option>
                              {services.filter(s => s.customerId === form.customerId || s.customerId?._id === form.customerId).map(s => (
                                <option key={s._id} value={s._id}>{s.name} - {s.customerIdField || s.cid || '-'} — {s.pageUrl || '-'}</option>
                              ))}
                            </select>
                          </div>

                          {/* Amount */}
                          <div style={{ marginBottom: '12px' }}>
                            <label style={formStyles.fieldLabel}>จำนวนเงิน (บาท) *</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              value={entry.amount} 
                              onChange={e => updateServiceEntry(entryIdx, 'amount', e.target.value)} 
                              required 
                              placeholder="0.00" 
                              style={formStyles.input} 
                            />
                          </div>

                          {/* Breakdown */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151' }}>
                                <ListCheck size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                แยกสัดส่วน
                              </span>
                              <span style={{ fontSize: '0.8rem', color: mismatch ? '#dc2626' : '#6c757d', fontWeight: '500' }}>
                                รวม ฿{entryBdSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} {entry.amount ? `/ ฿${parseFloat(entry.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : ''}
                              </span>
                            </div>
                            {entry.breakdowns.map((row, idx) => (
                              <div key={idx} style={formStyles.breakdownRow}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  {idx === entry.breakdowns.length - 1 && (
                                    <button type="button" className="btn btn-sm btn-primary" onClick={() => addBreakdownRow(entryIdx)} style={{ padding: '4px 8px', lineHeight: 1, minWidth: '28px', fontSize: '12px' }}>+</button>
                                  )}
                                </div>
                                <select value={row.code} onChange={e => handleCodeChange(entryIdx, idx, e.target.value)} disabled={row.isAutoVat} style={{ ...formStyles.select, fontSize: '0.8rem', padding: '6px 8px' }}>
                                  {BREAKDOWN_CODE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                </select>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                  <input type="number" step="0.01" placeholder="ยอดเงิน" value={row.amount}
                                    onChange={e => updateBreakdown(entryIdx, idx, 'amount', e.target.value)}
                                    style={{ ...formStyles.input, paddingRight: !VAT_CODES.includes(row.code) ? '72px' : '8px', fontSize: '0.85rem', padding: '6px 8px' }}
                                    disabled={row.isAutoVat} />
                                  {!VAT_CODES.includes(row.code) && (
                                    <button type="button" onClick={() => computeVatForRow(entryIdx, idx)}
                                      style={{ position: 'absolute', right: '3px', padding: '2px 5px', border: '1px solid #d3d8e2', background: '#f8f9fa', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '8px', color: '#334155', fontWeight: '600', lineHeight: '1.2' }}>
                                      +VAT
                                    </button>
                                  )}
                                </div>
                                <select value={row.statusNote} onChange={e => updateBreakdown(entryIdx, idx, 'statusNote', e.target.value)} style={{ ...formStyles.select, fontSize: '0.8rem', padding: '6px 8px' }}>
                                  {STATUS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                </select>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  {entry.breakdowns.length > 1 && (
                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeBreakdownRow(entryIdx, idx)} style={{ padding: '3px 7px', minWidth: '28px', fontSize: '12px' }}>✕</button>
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

                {/* Add Service Button */}
                <button type="button" onClick={addServiceEntry} disabled={!form.customerId}
                  style={{ ...formStyles.addServiceBtn, opacity: form.customerId ? 1 : 0.45, cursor: form.customerId ? 'pointer' : 'not-allowed' }}
                  onMouseEnter={e => { if (form.customerId) e.currentTarget.style.background = '#dbeafe'; }}
                  onMouseLeave={e => { if (form.customerId) e.currentTarget.style.background = '#f0f7ff'; }}>
                  + เพิ่มบริการอีกรายการ (สลิปเดียวกัน)
                </button>
              </div>

              {/* ── Section 3: สลิปโอนเงิน ── */}
              <div style={formStyles.sectionCard}>
                <div style={formStyles.sectionTitle}>
                  <Image style={formStyles.sectionIcon} />
                  <span>สลิปโอนเงิน</span>
                </div>
                
                <div style={formStyles.slipUploadArea}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa'; }}
                  onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { setForm({ ...form, slipImage: file }); const reader = new FileReader(); reader.onloadend = () => setSlipPreview(reader.result); reader.readAsDataURL(file); } }}>
                  <input type="file" accept="image/*" onChange={handleSlipChange} style={{ display: 'none' }} id="slip-upload-input" />
                  <label htmlFor="slip-upload-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>รองรับไฟล์ JPG, PNG, GIF, WEBP (สูงสุด 5MB)</p>
                  </label>
                </div>
                
                {slipPreview && (
                  <div style={{ marginTop: '12px', position: 'relative', display: 'inline-block' }}>
                    <img src={slipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '220px', maxHeight: '220px', borderRadius: '10px', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <button type="button" onClick={removeSlipPreview}
                      style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', boxShadow: '0 2px 8px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ×
                    </button>
                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                      สลิปที่เลือก
                    </div>
                  </div>
                )}
              </div>

              {/* ── Actions ── */}
              <div className="svc-actions" style={{ marginTop: '6px' }}>
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