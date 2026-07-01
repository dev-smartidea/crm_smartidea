import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CashCoin, Plus, TrashFill, PencilSquare, ArrowLeftCircle, ThreeDotsVertical, XCircle, Eye, Upload } from 'react-bootstrap-icons';
import './CustomerListPage.css'; // reuse table styles
import './CustomerServicesPage.css';
import '../shared/ImageGalleryPage.css'; // reuse gradient blue button (.btn-header-upload)
import './TransactionHistoryPage.css'; // slip upload custom styles
import '../shared/DashboardPage.css'; // reuse .badge-bank styles to match Dashboard
import { getImageUrl } from '../../utils/imageHelper';

export default function TransactionHistoryPage() {
    const { serviceId } = useParams();
    const [service, setService] = useState(null);
    const [transactions, setTransactions] = useState([]);
    
    // Pagination state
    const pageSize = 6;
    const [currentPage, setCurrentPage] = useState(1);
  // Removed duplicate declarations of serviceId, service, transactions
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    transactionDate: '',
    transactionTime: '',
    notes: '',
    bank: 'KBANK',
    slipImage: null, // เก็บ File object
    breakdowns: [
      { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }
    ]
  });
  // viewSlip: { id, url } | null
  const [viewSlip, setViewSlip] = useState(null); // สำหรับ modal แสดงสลิปขนาดใหญ่
  const [uploadingId, setUploadingId] = useState(null); // อัปโหลดสลิปรายแถว
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    transactionDate: '',
    transactionTime: '',
    notes: '',
    bank: 'KBANK',
    breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
  });
  const [slipPreview, setSlipPreview] = useState(null); // ตัวอย่างสลิปในการสร้างใหม่
  const [editSlipPreview, setEditSlipPreview] = useState(null); // ตัวอย่างสลิปในการแก้ไข
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const VAT_CODES = ['12', '13', '17', '19'];

  // คำนวณผลรวม breakdowns ในฟอร์มสร้างใหม่
  const breakdownSum = (form.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  // คำนวณผลรวม breakdowns ในฟอร์มแก้ไข
  const editBreakdownSum = (editForm.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const fetchAll = useCallback(async (signal) => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` }, ...(signal ? { signal } : {}) };
      const [svcRes, txRes] = await Promise.all([
        axios.get(`${api}/api/services/${serviceId}`, authHeaders),
        axios.get(`${api}/api/services/${serviceId}/transactions`, authHeaders)
      ]);
      setService(svcRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal);
    return () => controller.abort();
  }, [fetchAll]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.transactionDate) return;
    try {
      // ใช้ FormData สำหรับอัปโหลดไฟล์
      const formData = new FormData();
      formData.append('amount', parseFloat(form.amount));
      formData.append('transactionDate', form.transactionDate);
      if (form.transactionTime) formData.append('transactionTime', form.transactionTime);
      formData.append('notes', form.notes || '');
      formData.append('bank', form.bank);
      if (form.slipImage) {
        formData.append('slipImage', form.slipImage);
      }
      // แนบ breakdowns เป็น JSON string (ปล่อยแถวที่ไม่มีจำนวนเงิน)
      const cleaned = (form.breakdowns || [])
        .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
        .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote, isAutoVat: r.isAutoVat || false }));
      if (cleaned.length > 0) {
        formData.append('breakdowns', JSON.stringify(cleaned));
      }

      const res = await axios.post(`${api}/api/services/${serviceId}/transactions`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setTransactions([res.data, ...transactions]);
      setShowCreate(false);
      setForm({
        amount: '',
        transactionDate: '',
        transactionTime: '',
        notes: '',
        bank: 'KBANK',
        slipImage: null,
        breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
      });
      setSlipPreview(null);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '';
      alert(`เพิ่มรายการไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  };

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

  // Helper function เพื่อดึงชื่อรายการจากรหัส
  const getBreakdownLabel = (code) => {
    const option = BREAKDOWN_CODE_OPTIONS.find(opt => opt.value === code);
    return option ? option.label : code;
  };

  const addBreakdownRow = () => {
    setForm(prev => ({
      ...prev,
      breakdowns: [...(prev.breakdowns || []), { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    }));
  };

  const removeBreakdownRow = (idx) => {
    setForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      // ถ้าแถวที่ลบเป็นแถวหลัก (ไม่ใช่ VAT) และมีแถว VAT ต่อท้ายติดกัน ให้ลบคู่
      const current = rows[idx];
      const next = rows[idx + 1];
      const shouldRemovePair = current && !current.isAutoVat && next && next.isAutoVat;
      const newRows = rows.filter((_, i) => {
        if (shouldRemovePair) return i !== idx && i !== idx + 1;
        return i !== idx; // ลบเดี่ยว
      });
      // ถ้าลบแล้วไม่เหลืออะไรเลย ให้สร้างแถวเริ่มต้นใหม่อัตโนมัติ
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
      
      // ตรวจสอบว่ารายการนี้เป็น VAT อยู่แล้วหรือไม่
      if (VAT_CODES.includes(current.code)) {
        alert('ไม่สามารถคำนวณ VAT จากรายการ VAT ได้');
        return prev;
      }

      // ใช้ค่าที่กรอกในช่องนี้เป็นฐาน
      let base = parseFloat(current.amount);
      if (Number.isNaN(base) || base <= 0) {
        alert('กรุณากรอกยอดเงินในช่องนี้ก่อนคำนวณ VAT');
        return prev;
      }

      const vat = Math.round(base * 0.07 * 100) / 100;
      
      // กำหนดรหัส VAT ตามรหัสต้นทาง
      let vatCode = '12';
      let vatStatus = current.statusNote;
      
      if (current.code === '11') {
        vatCode = '12';
      } else if (current.code === '14') {
        vatCode = '13';
      } else if (current.code === '18') {
        vatCode = '17';
      } else if (current.code === '20') {
        vatCode = '19';
      } else {
        vatCode = '12';
      }

      // แทรกรายการ VAT ใหม่ถัดจากรายการปัจจุบัน (ตั้งค่า isAutoVat: true)
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

  // คำนวณหัก ณ ที่จ่ายอัตโนมัติ
  const computeWithholdingTax = (idx, code, breakdownsList) => {
    const rows = [...(breakdownsList || [])];
    const current = rows[idx];
    if (!current) return breakdownsList;

    // หัก ณ ที่จ่าย 3% ค่าคลิก (code 7) - ใช้ code 11 เป็นฐาน
    if (code === '7') {
      const idx11 = rows.findIndex((b, i) => i !== idx && b.code === '11');
      if (idx11 === -1) {
        alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อน');
        return breakdownsList;
      }
      const row11 = rows[idx11];
      const amount11 = parseFloat(row11.amount) || 0;
      if (amount11 <= 0) {
        alert('กรุณากรอกยอดเงินในรหัส 11 ก่อน');
        return breakdownsList;
      }
      const w = Math.round(amount11 * 0.03 * 100) / 100;
      rows[idx] = { ...current, code: '7', amount: (-w).toFixed(2) };
      return rows;
    }

    // หัก ณ ที่จ่าย 2% ค่าบริการ (code 8) - ใช้ code 14, 18, 15 เป็นฐาน
    if (code === '8') {
      const idxSrc = rows.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'));
      if (idxSrc === -1) {
        alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อน');
        return breakdownsList;
      }
      const rowSrc = rows[idxSrc];
      const amountSrc = parseFloat(rowSrc.amount) || 0;
      if (amountSrc <= 0) {
        alert('กรุณากรอกยอดเงินในรหัส 14, 18 หรือ 15 ก่อน');
        return breakdownsList;
      }
      const w = Math.round(amountSrc * 0.02 * 100) / 100;
      rows[idx] = { ...current, code: '8', amount: (-w).toFixed(2) };
      return rows;
    }

    // หัก ณ ที่จ่าย 2% ค่าคลิก (code 9) - ใช้ code 11 เป็นฐาน
    if (code === '9') {
      const idx11 = rows.findIndex((b, i) => i !== idx && b.code === '11');
      if (idx11 === -1) {
        alert('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อน');
        return breakdownsList;
      }
      const row11 = rows[idx11];
      const amount11 = parseFloat(row11.amount) || 0;
      if (amount11 <= 0) {
        alert('กรุณากรอกยอดเงินในรหัส 11 ก่อน');
        return breakdownsList;
      }
      const w = Math.round(amount11 * 0.02 * 100) / 100;
      rows[idx] = { ...current, code: '9', amount: (-w).toFixed(2) };
      return rows;
    }

    // หัก ณ ที่จ่าย 3% ค่าบริการ (code 10) - ใช้ code 14, 18, 15 เป็นฐาน
    if (code === '10') {
      const idxSrc = rows.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'));
      if (idxSrc === -1) {
        alert('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อน');
        return breakdownsList;
      }
      const rowSrc = rows[idxSrc];
      const amountSrc = parseFloat(rowSrc.amount) || 0;
      if (amountSrc <= 0) {
        alert('กรุณากรอกยอดเงินในรหัส 14, 18 หรือ 15 ก่อน');
        return breakdownsList;
      }
      const w = Math.round(amountSrc * 0.03 * 100) / 100;
      rows[idx] = { ...current, code: '10', amount: (-w).toFixed(2) };
      return rows;
    }

    return rows;
  };

  // Auto-calculate withholding tax when selecting code 7, 8, 9 or 10
  const handleCodeChange = (idx, newCode, breakdownsList, setter) => {
    const withholdingTaxCodes = ['7', '8', '9', '10'];
    if (withholdingTaxCodes.includes(newCode)) {
      const updatedRows = computeWithholdingTax(idx, newCode, breakdownsList);
      if (updatedRows !== breakdownsList && setter) {
        setter(updatedRows);
      }
    } else {
      const rows = [...(breakdownsList || [])];
      if (rows[idx]) {
        rows[idx] = { ...rows[idx], code: newCode };
      }
      if (setter) {
        setter(rows);
      }
    }
  };

  const startEdit = (tx) => {
    setEditingId(tx._id);
    setEditForm({
      amount: tx.amount,
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 10) : '',
      transactionTime: tx.transactionTime || '',
      notes: tx.notes || '',
      bank: tx.bank || 'KBANK',
      breakdowns: (tx.breakdowns && tx.breakdowns.length > 0) 
        ? tx.breakdowns.map(bd => ({ ...bd }))
        : [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    });
    // ถ้ามีสลิปอยู่แล้ว แสดงตัวอย่าง
    if (tx.slipImage) {
      setEditSlipPreview(getImageUrl(tx.slipImage, api));
    } else {
      setEditSlipPreview(null);
    }
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, slipImage: file });
      // แสดงตัวอย่างรูป
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSlipPreview = () => {
    setForm({ ...form, slipImage: null });
    setSlipPreview(null);
  };

  const handleEditSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditForm({ ...editForm, slipImage: file });
      // แสดงตัวอย่างรูป
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditSlipPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeEditSlipPreview = () => {
    setEditForm({ ...editForm, slipImage: null });
    setEditSlipPreview(null);
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
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'อัปโหลดสลิปไม่สำเร็จ';
      alert(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const saveEdit = async (txId) => {
    try {
      const formData = new FormData();
      formData.append('amount', parseFloat(editForm.amount));
      formData.append('transactionDate', editForm.transactionDate);
      if (editForm.transactionTime) formData.append('transactionTime', editForm.transactionTime);
      formData.append('notes', editForm.notes || '');
      formData.append('bank', editForm.bank);
      if (editForm.slipImage) {
        formData.append('slipImage', editForm.slipImage);
      }
      // แนบ breakdowns เป็น JSON string
      const cleaned = (editForm.breakdowns || [])
        .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
        .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote, isAutoVat: r.isAutoVat || false }));
      if (cleaned.length > 0) {
        formData.append('breakdowns', JSON.stringify(cleaned));
      }

      const res = await axios.put(`${api}/api/transactions/${txId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactions.map(t => (t._id === txId ? res.data : t)));
      setEditingId(null);
      setEditSlipPreview(null);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSlipPreview(null);
    setEditForm({
      amount: '',
      transactionDate: '',
      transactionTime: '',
      notes: '',
      bank: 'KBANK',
      breakdowns: [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    });
  };

  const addEditBreakdownRow = () => {
    setEditForm(prev => ({
      ...prev,
      breakdowns: [...prev.breakdowns, { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    }));
  };

  const removeEditBreakdownRow = (index) => {
    setEditForm(prev => {
      const rows = [...prev.breakdowns];
      const current = rows[index];
      const next = rows[index + 1];
      const shouldRemovePair = current && !current.isAutoVat && next && next.isAutoVat;
      const newRows = rows.filter((_, i) => {
        if (shouldRemovePair) return i !== index && i !== index + 1;
        return i !== index;
      });
      if (newRows.length === 0) {
        newRows.push({ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
      }
      return { ...prev, breakdowns: newRows };
    });
  };

  const updateEditBreakdown = (index, field, value) => {
    setEditForm(prev => {
      const updated = [...prev.breakdowns];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, breakdowns: updated };
    });
  };

  const computeVatForEditRow = (index) => {
    setEditForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      const current = rows[index] || { amount: '', code: '11', statusNote: 'รอบันทึกบัญชี', isAutoVat: false };
      
      if (VAT_CODES.includes(current.code)) {
        alert('ไม่สามารถคำนวณ VAT จากรายการ VAT ได้');
        return prev;
      }

      const amt = parseFloat(current.amount);
      if (isNaN(amt) || amt <= 0) {
        alert('กรุณากรอกยอดเงินในช่องนี้ก่อนคำนวณ VAT');
        return prev;
      }

      const vat = Math.round(amt * 0.07 * 100) / 100;

      let vatCode = '12';
      if (current.code === '11') {
        vatCode = '12';
      } else if (current.code === '14') {
        vatCode = '13';
      } else if (current.code === '18') {
        vatCode = '17';
      } else if (current.code === '20') {
        vatCode = '19';
      } else {
        vatCode = '12';
      }

      rows.splice(index + 1, 0, {
        code: vatCode,
        amount: vat.toFixed(2),
        statusNote: current.statusNote,
        isAutoVat: true
      });

      return { ...prev, breakdowns: rows };
    });
  };

  const askDelete = (txId) => {
    setTransactionToDelete(txId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await axios.delete(`${api}/api/transactions/${transactionToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactions.filter(t => t._id !== transactionToDelete));
      setShowDeleteConfirm(false);
      setTransactionToDelete(null);
    } catch (err) {
      alert('ลบไม่สำเร็จ');
    }
  };

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header" style={{ color: '#dc3545' }}>
          <h3 style={{ margin: 0 }}>ยืนยันการลบรายการโอนเงิน</h3>
        </div>
        <div className="modal-body">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteConfirm(false)}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" type="button" onClick={confirmDelete}>
            ยืนยันลบ
          </button>
        </div>
      </div>
    </div>
  );

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

  // คำนวณยอดรวมทั้งหมด
  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Reusable breakdown row component for both create and edit forms
  const renderBreakdownRows = (breakdowns, addFn, removeFn, updateFn, vatFn, changeHandler, isEdit) => {
    return breakdowns.map((row, idx) => (
      <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.8fr 1fr auto', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
        <div>
          {idx === breakdowns.length - 1 && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={addFn}
              title="เพิ่มแถว"
              style={{ padding: '4px 10px', lineHeight: 1 }}
            >
              +
            </button>
          )}
        </div>
        <select value={row.code} onChange={e => {
          const result = handleCodeChange(idx, e.target.value, breakdowns, isEdit ? setEditForm : setForm);
          if (result !== null) {
            if (Array.isArray(result)) {
              if (isEdit) {
                setEditForm(prev => ({ ...prev, breakdowns: result }));
              } else {
                setForm(prev => ({ ...prev, breakdowns: result }));
              }
            } else {
              updateFn(idx, 'code', e.target.value);
            }
          }
        }} disabled={row.isAutoVat} style={{ minWidth: 0 }}>
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
            onChange={e => updateFn(idx, 'amount', e.target.value)}
            style={{ 
              flex: '1 1 auto',
              minWidth: 0,
              paddingRight: !VAT_CODES.includes(row.code) ? '95px' : '8px'
            }}
            disabled={row.isAutoVat}
          />
          {/* ปุ่มคำนวณ VAT อยู่ภายในฟิลด์ยอดเงิน */}
          {!VAT_CODES.includes(row.code) && !row.isAutoVat && (
            <button
              type="button"
              onClick={() => vatFn(idx)}
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
        <select value={row.statusNote} onChange={e => updateFn(idx, 'statusNote', e.target.value)} style={{ minWidth: 0 }}>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
          {breakdowns.length > 1 && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeFn(idx)} style={{ whiteSpace: 'nowrap' }}>ลบ</button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="customer-list-page fade-up">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <CashCoin />
              </div>
              <div>
                <h1>
                  ประวัติการโอนเงิน: {service ? `${service.name} / ${service.customerId?.name || '...'}` : '...'}
                </h1>
                <p className="subtitle">บันทึกและจัดการรายการโอนเงิน</p>
              </div>
            </div>
            <div className="header-buttons">
              <Link to={`/dashboard/customer/${service?.customerId?._id || service?.customerId}/services`} className="btn btn-sm btn-back">
                <ArrowLeftCircle /> กลับ
              </Link>
              <button className="btn-header-upload" onClick={() => setShowCreate(true)}>
                <Plus /> เพิ่มรายการโอนเงิน
              </button>
            </div>
          </div>
        </div>
        {service && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f7fa', borderRadius: 8 }}>
            <strong>บริการ:</strong> {service.name} | <strong>สถานะ:</strong> {service.status}
            {service.pageUrl && (
              <>
                {' '}| <strong>Website/Page:</strong> {service.pageUrl}
              </>
            )}
          </div>
        )}

        {/* แสดงยอดรวม */}
        <div style={{ marginBottom: '15px', padding: '12px', background: '#e7f3ff', borderRadius: 8, fontWeight: 'bold' }}>
          ยอดรวมทั้งหมด: {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
        </div>

        <div className="table-responsive">
          <table className="customer-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>จำนวนเงิน</th>
                <th>ธนาคาร</th>
                <th>สลิป</th>
                <th>หมายเหตุ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-5">กำลังโหลด...</td></tr>
              ) : transactions.length > 0 ? (
                transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(tx => (
                    <tr key={tx._id}>
                    <td>
                      <div>{tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('th-TH') : '-'}</div>
                      {tx.transactionTime && <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>{tx.transactionTime}</div>}
                    </td>
                    <td>
                      {`${Number(tx.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                    </td>
                    <td>
                      {tx.bank ? (
                        <span className={`badge-bank ${
                          tx.bank === 'KBANK' || tx.bank === 'กสิกรไทย' ? 'kbank' :
                          tx.bank === 'SCB' || tx.bank === 'ไทยพาณิชย์' ? 'scb' :
                          tx.bank === 'BBL' || tx.bank === 'กรุงเทพ' || tx.bank === 'BBL-ส่วนตัว' ? 'bbl' :
                          tx.bank === 'BAY-4396' || tx.bank === 'BAY-7146' ? 'bay' :
                          'default'
                        }`}>
                          {tx.bank}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
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
                      <div style={{ textAlign: 'left' }}>
                        {Array.isArray(tx.breakdowns) && tx.breakdowns.length > 0 ? (
                          <div style={{ marginBottom: tx.notes ? 6 : 0 }}>
                            {tx.breakdowns.map((bd, i) => (
                              <div key={i} style={{ fontSize: '0.9rem', color: '#444' }}>
                                <strong>{getBreakdownLabel(bd.code)}</strong>: {Number(bd.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                                {bd.statusNote ? ` — ${bd.statusNote}` : ''}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {tx.notes || (tx.breakdowns && tx.breakdowns.length ? '' : '-')}
                      </div>
                    </td>
                    <td>
                      <div className="dropdown-container">
                        <button 
                          className="btn-dropdown-toggle" 
                          onClick={(e) => {
                            setOpenDropdown(openDropdown === tx._id ? null : tx._id);
                          }}
                        >
                          <ThreeDotsVertical />
                        </button>
                        {openDropdown === tx._id && (
                          <div className="dropdown-menu-custom">
                            <button className="dropdown-item" onClick={() => { startEdit(tx); setOpenDropdown(null); }}>
                              <PencilSquare /> แก้ไข
                            </button>
                            <button className="dropdown-item danger" onClick={() => { askDelete(tx._id); setOpenDropdown(null); }}>
                              <TrashFill /> ลบ
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center p-5">
                    ยังไม่มีรายการโอนเงิน
                  </td>
                </tr>
              )}
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
      </div>

      {/* Create Transaction Modal - Professional Redesign */}
      {showCreate && (
        <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '95vw', padding: '28px 30px' }}>
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
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} type="button">✕</button>
            </div>
            <form onSubmit={handleCreate} className="svc-form" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* ── Section 1: ข้อมูลหลัก ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                  <span>ข้อมูลหลัก</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>จำนวนเงิน (บาท) *</label>
                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>วันที่โอน *</label>
                    <input type="date" value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} required style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>เวลาที่โอน</label>
                    <input 
                      type="text" 
                      value={form.transactionTime} 
                      onChange={e => setForm({ ...form, transactionTime: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }}
                      placeholder="เช่น 0930"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>บัญชีธนาคาร</label>
                    <select value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }}>
                      <option value="KBANK">KBANK (กสิกรไทย)</option>
                      <option value="SCB">SCB (ไทยพาณิชย์)</option>
                      <option value="BBL">BBL (กรุงเทพ)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>หมายเหตุ</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="เลขอ้างอิง, หมายเหตุ..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
              </div>
              {/* ── Section 2: แยกสัดส่วน ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M2.5 0a.5.5 0 0 1 .5.5V2h10V.5a.5.5 0 0 1 1 0v2a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-2A.5.5 0 0 1 2.5 0zM1 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1H1V4zm1 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V7zm1 3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1H3v-1zm1 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1H4v-1z"/></svg>
                  <span>แยกสัดส่วนการโอนเงิน</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginBottom: '10px', padding: '8px 12px', background: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', fontWeight: '500' }}>
                  ยอดรวม: {breakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท {form.amount ? `(ยอดทั้งหมด ${parseFloat(form.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)` : ''}
                </div>
                {renderBreakdownRows(form.breakdowns, addBreakdownRow, removeBreakdownRow, updateBreakdown, computeVatForRow, handleCodeChange, false)}
              </div>
              {/* ── Section 3: สลิปโอนเงิน ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm13 1a.5.5 0 0 1 .5.5v6l-3.775-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.5 12.5V3.5a.5.5 0 0 1 .5-.5h13z"/></svg>
                  <span>สลิปโอนเงิน</span>
                </div>
                <div style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: '#fafafa' }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa'; }}
                  onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { setForm({ ...form, slipImage: file }); const reader = new FileReader(); reader.onloadend = () => setSlipPreview(reader.result); reader.readAsDataURL(file); } }}>
                  <input type="file" accept="image/*" onChange={handleSlipChange} style={{ display: 'none' }} id="txh-upload-input" />
                  <label htmlFor="txh-upload-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={24} style={{ color: '#94a3b8', marginBottom: '6px' }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                    <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>รองรับไฟล์ JPG, PNG, GIF, WEBP (สูงสุด 5MB)</p>
                  </label>
                </div>
                {slipPreview && (
                  <div style={{ marginTop: '12px', position: 'relative', display: 'inline-block' }}>
                    <img src={slipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '10px', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <button type="button" onClick={removeSlipPreview}
                      style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 8px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>สลิปที่เลือก</div>
                  </div>
                )}
              </div>
              {/* ── Actions ── */}
              <div className="svc-actions" style={{ marginTop: '6px' }}>
                <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreate(false)}>
                  <XCircle /> ยกเลิก
                </button>
                <button type="submit" className="btn-modal btn-modal-save"
                  disabled={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2)}
                  title={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}>
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal - Professional Redesign */}
      {editingId && (
        <div className="svc-modal-overlay" onClick={cancelEdit}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '95vw', padding: '28px 30px' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem' }}>
                  <PencilSquare />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>แก้ไขรายการโอนเงิน</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#64748b' }}>แก้ไขข้อมูลรายการโอนเงิน</p>
                </div>
              </div>
              <button onClick={cancelEdit} style={{ background: 'none', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} type="button">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingId); }} className="svc-form" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* ── Section 1: ข้อมูลหลัก ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                  <span>ข้อมูลหลัก</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>จำนวนเงิน (บาท) *</label>
                    <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} required placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>วันที่โอน</label>
                    <input type="date" value={editForm.transactionDate} onChange={e => setEditForm({ ...editForm, transactionDate: e.target.value })} required style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>เวลาที่โอน</label>
                    <input 
                      type="text" 
                      value={editForm.transactionTime} 
                      onChange={e => setEditForm({ ...editForm, transactionTime: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }}
                      placeholder="เช่น 0930"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>บัญชีธนาคาร</label>
                    <select value={editForm.bank} onChange={e => setEditForm({ ...editForm, bank: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#fff', outline: 'none' }}>
                      <option value="KBANK">KBANK (กสิกรไทย)</option>
                      <option value="SCB">SCB (ไทยพาณิชย์)</option>
                      <option value="BBL">BBL (กรุงเทพ)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>หมายเหตุ</label>
                    <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} placeholder="เลขอ้างอิง, หมายเหตุ..." style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '0.92rem', borderRadius: '8px', border: '1.5px solid #d1d5db', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
              </div>
              {/* ── Section 2: แยกสัดส่วน ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M2.5 0a.5.5 0 0 1 .5.5V2h10V.5a.5.5 0 0 1 1 0v2a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-2A.5.5 0 0 1 2.5 0zM1 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1H1V4zm1 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V7zm1 3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1H3v-1zm1 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1H4v-1z"/></svg>
                  <span>แยกสัดส่วนการโอนเงิน</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginBottom: '10px', padding: '8px 12px', background: editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', fontWeight: '500' }}>
                  ยอดรวม: {editBreakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท {editForm.amount ? `(ยอดทั้งหมด ${parseFloat(editForm.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)` : ''}
                </div>
                {renderBreakdownRows(editForm.breakdowns, addEditBreakdownRow, removeEditBreakdownRow, updateEditBreakdown, computeVatForEditRow, handleCodeChange, true)}
              </div>
              {/* ── Section 3: สลิปโอนเงิน ── */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #e2e8f0' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3b82f6"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zm13 1a.5.5 0 0 1 .5.5v6l-3.775-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.5 12.5V3.5a.5.5 0 0 1 .5-.5h13z"/></svg>
                  <span>สลิปโอนเงิน</span>
                </div>
                <div style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: '#fafafa' }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa'; }}
                  onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { setEditForm({ ...editForm, slipImage: file }); const reader = new FileReader(); reader.onloadend = () => setEditSlipPreview(reader.result); reader.readAsDataURL(file); } }}>
                  <input type="file" accept="image/*" onChange={handleEditSlipChange} style={{ display: 'none' }} id="txh-edit-upload-input" />
                  <label htmlFor="txh-edit-upload-input" style={{ cursor: 'pointer', display: 'block' }}>
                    <Upload size={24} style={{ color: '#94a3b8', marginBottom: '6px' }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>คลิกเพื่อเปลี่ยนสลิป หรือลากไฟล์มาวาง</p>
                    <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>รองรับไฟล์ JPG, PNG, GIF, WEBP (สูงสุด 5MB)</p>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {!editSlipPreview?.includes('data:') && editForm.slipImage && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={getImageUrl(editForm.slipImage, api)} alt="สลิปปัจจุบัน" style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '10px', border: '3px solid #86efac', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(22,163,74,0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>สลิปปัจจุบัน</div>
                    </div>
                  )}
                  {editSlipPreview && editSlipPreview.startsWith('data:') && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={editSlipPreview} alt="ตัวอย่างสลิปใหม่" style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '10px', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <button type="button" onClick={removeEditSlipPreview}
                        style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 8px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>สลิปใหม่</div>
                    </div>
                  )}
                </div>
              </div>
              {/* ── Actions ── */}
              <div className="svc-actions" style={{ marginTop: '6px' }}>
                <button type="button" className="btn-modal btn-modal-cancel" onClick={cancelEdit}>
                  <XCircle /> ยกเลิก
                </button>
                <button type="submit" className="btn-modal btn-modal-save"
                  disabled={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2)}
                  title={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}>
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slip View Modal - ย้ายออกมานอก list-container */}
      {viewSlip && <SlipViewModal />}
    </div>
  );
}