import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CashCoin, Plus, TrashFill, PencilSquare, ArrowLeftCircle, ThreeDotsVertical, XCircle, Eye, Upload } from 'react-bootstrap-icons';
import '../pages/CustomerListPage.css'; // reuse table styles
import '../pages/CustomerServicesPage.css';
import './ImageGalleryPage.css'; // reuse gradient blue button (.btn-header-upload)
import './TransactionHistoryPage.css'; // slip upload custom styles
import './DashboardPage.css'; // reuse .badge-bank styles to match Dashboard

export default function TransactionHistoryPage() {
  const { serviceId } = useParams(); // service id from URL
  const [service, setService] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    transactionDate: '',
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

  // คำนวณผลรวม breakdowns ในฟอร์มสร้างใหม่
  const breakdownSum = (form.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  // คำนวณผลรวม breakdowns ในฟอร์มแก้ไข
  const editBreakdownSum = (editForm.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [svcRes, txRes] = await Promise.all([
        axios.get(`${api}/api/services/${serviceId}`, authHeaders),
        axios.get(`${api}/api/services/${serviceId}/transactions`, authHeaders)
      ]);
      setService(svcRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, token]);

  useEffect(() => {
    fetchAll();
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
      formData.append('notes', form.notes || '');
      formData.append('bank', form.bank);
      if (form.slipImage) {
        formData.append('slipImage', form.slipImage);
      }
      // แนบ breakdowns เป็น JSON string (ปล่อยแถวที่ไม่มีจำนวนเงิน)
      const cleaned = (form.breakdowns || [])
        .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
        .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote }));
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
      
      // ตรวจสอบว่ารายการนี้เป็น VAT อยู่แล้วหรือไม่ (12 หรือ 13) ห้ามคำนวณซ้ำ
      if (current.code === '12' || current.code === '13') {
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
      let vatCode = '12'; // default: Vat ค่าคลิก
      let vatStatus = current.statusNote; // ใช้สถานะเดียวกัน
      
      if (current.code === '11') {
        vatCode = '12'; // 11:ค่าคลิก → 12:Vat ค่าคลิก
      } else if (current.code === '14') {
        vatCode = '13'; // 14:ค่าบริการ Google → 13:Vat ค่าบริการ
      } else {
        // รหัสอื่นๆ (12,13,15,16) ให้ใช้ 12 เป็น default
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

  const startEdit = (tx) => {
    setEditingId(tx._id);
    setEditForm({
      amount: tx.amount,
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 10) : '',
      notes: tx.notes || '',
      bank: tx.bank || 'KBANK',
      breakdowns: (tx.breakdowns && tx.breakdowns.length > 0) 
        ? tx.breakdowns.map(bd => ({ ...bd }))
        : [{ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
    });
    // ถ้ามีสลิปอยู่แล้ว แสดงตัวอย่าง
    if (tx.slipImage) {
      setEditSlipPreview(`${api}${tx.slipImage}`);
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
      formData.append('notes', editForm.notes || '');
      formData.append('bank', editForm.bank);
      if (editForm.slipImage) {
        formData.append('slipImage', editForm.slipImage);
      }
      // แนบ breakdowns เป็น JSON string
      const cleaned = (editForm.breakdowns || [])
        .filter(r => r && r.amount !== '' && !Number.isNaN(parseFloat(r.amount)))
        .map(r => ({ code: r.code, amount: parseFloat(r.amount), statusNote: r.statusNote, isAutoVat: r.isAutoVat }));
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
    setEditForm(prev => ({
      ...prev,
      breakdowns: prev.breakdowns.filter((_, i) => i !== index)
    }));
  };

  const updateEditBreakdown = (index, field, value) => {
    setEditForm(prev => {
      const updated = [...prev.breakdowns];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, breakdowns: updated };
    });
  };

  const computeVatForEditRow = (index) => {
    const row = editForm.breakdowns[index];
    if (!row || !row.amount) return;
    const amt = parseFloat(row.amount);
    if (isNaN(amt)) return;
    const includesVat = amt;
    const vatVal = includesVat * (7 / 107);
    const noVat = includesVat - vatVal;

    const newBreakdowns = [...editForm.breakdowns];
    newBreakdowns.splice(index, 1);
    newBreakdowns.splice(index, 0, { code: row.code, amount: noVat.toFixed(2), statusNote: row.statusNote, isAutoVat: false });
    newBreakdowns.splice(index + 1, 0, { code: '12', amount: vatVal.toFixed(2), statusNote: row.statusNote, isAutoVat: true });

    setEditForm(prev => ({ ...prev, breakdowns: newBreakdowns }));
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

  // คำนวณยอดรวมทั้งหมด
  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

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

        {/* Create Transaction Modal - moved outside list-container for proper overlay */}
        {/* kept here temporarily for readability; actual render moved below */}
        {false && showCreate && (
          <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>เพิ่มรายการโอนเงินใหม่</h3>
              <form onSubmit={handleCreate} className="svc-form">
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
                  <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreate(false)}>
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

        {/* Edit Transaction Modal */}
        {/* Edit Transaction Modal - moved outside list-container for proper overlay */}
        {false && editingId && (
          <div className="svc-modal-overlay" onClick={cancelEdit}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>แก้ไขรายการโอนเงิน</h3>
              <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingId); }} className="svc-form">
                <label>
                  จำนวนเงิน (บาท)
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}
                  />
                </label>
                <label>
                  วันที่โอน
                  <input
                    type="date"
                    value={editForm.transactionDate}
                    onChange={e => setEditForm({ ...editForm, transactionDate: e.target.value })}
                    required
                  />
                </label>
                <label>
                  บัญชีธนาคาร
                  <select
                    value={editForm.bank}
                    onChange={e => setEditForm({ ...editForm, bank: e.target.value })}
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
                  <div style={{ fontSize: '0.9rem', color: editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginTop: 4 }}>
                    ยอดรวม: {editBreakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท {editForm.amount ? `(ยอดทั้งหมด ${parseFloat(editForm.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)` : ''}
                  </div>
                  {editForm.breakdowns.map((row, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.8fr 1fr auto', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                      <div>
                        {idx === editForm.breakdowns.length - 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={addEditBreakdownRow}
                            title="เพิ่มแถว"
                            style={{ padding: '4px 10px', lineHeight: 1 }}
                          >
                            +
                          </button>
                        )}
                      </div>
                      <select value={row.code} onChange={e => updateEditBreakdown(idx, 'code', e.target.value)} disabled={row.isAutoVat} style={{ minWidth: 0 }}>
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
                          onChange={e => updateEditBreakdown(idx, 'amount', e.target.value)}
                          style={{ 
                            flex: '1 1 auto',
                            minWidth: 0,
                            paddingRight: row.code !== '12' && row.code !== '13' ? '95px' : '8px'
                          }}
                          disabled={row.isAutoVat}
                        />
                        {row.code !== '12' && row.code !== '13' && (
                          <button
                            type="button"
                            onClick={() => computeVatForEditRow(idx)}
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
                      <select value={row.statusNote} onChange={e => updateEditBreakdown(idx, 'statusNote', e.target.value)} style={{ minWidth: 0 }}>
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
                        {editForm.breakdowns.length > 1 && (
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeEditBreakdownRow(idx)} style={{ whiteSpace: 'nowrap' }}>ลบ</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <label>
                  หมายเหตุ
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม"
                  />
                </label>
                <label>
                  อัปโหลดสลิปโอนเงิน
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditSlipChange}
                    style={{ marginTop: '8px' }}
                  />
                  {editSlipPreview && (
                    <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                      <img src={editSlipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd' }} />
                      <button
                        type="button"
                        onClick={removeEditSlipPreview}
                        style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px' }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </label>
                <div className="svc-actions">
                  <button type="button" className="btn-modal btn-modal-cancel" onClick={cancelEdit}>
                    <XCircle /> ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn-modal btn-modal-save"
                    disabled={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2)}
                    title={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                transactions.map(tx => (
                  <tr key={tx._id}>
                    <td>
                      {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td>
                      {`${Number(tx.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                    </td>
                    <td>
                      {tx.bank ? (
                        <span className={`badge-bank ${
                          tx.bank === 'KBANK' || tx.bank === 'กสิกรไทย' ? 'kbank' :
                          tx.bank === 'SCB' || tx.bank === 'ไทยพาณิชย์' ? 'scb' :
                          tx.bank === 'BBL' || tx.bank === 'กรุงเทพ' ? 'bbl' :
                          tx.bank === 'KTB' || tx.bank === 'กรุงไทย' ? 'ktb' :
                          tx.bank === 'TMB' || tx.bank === 'ทหารไทยธนชาต' ? 'tmb' :
                          tx.bank === 'BAY' || tx.bank === 'กรุงศรี' ? 'bay' :
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
      </div>

      {/* Create Transaction Modal - render outside to overlay sidebar/header */}
      {showCreate && (
        <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>เพิ่มรายการโอนเงินใหม่</h3>
            <form onSubmit={handleCreate} className="svc-form">
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
                <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreate(false)}>
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

      {/* Edit Transaction Modal - render outside to overlay sidebar/header */}
      {editingId && (
        <div className="svc-modal-overlay" onClick={cancelEdit}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>แก้ไขรายการโอนเงิน</h3>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingId); }} className="svc-form">
              <label>
                จำนวนเงิน (บาท)
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label>
                วันที่โอน
                <input
                  type="date"
                  value={editForm.transactionDate}
                  onChange={e => setEditForm({ ...editForm, transactionDate: e.target.value })}
                  required
                />
              </label>
              <label>
                บัญชีธนาคาร
                <select
                  value={editForm.bank}
                  onChange={e => setEditForm({ ...editForm, bank: e.target.value })}
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
                <div style={{ fontSize: '0.9rem', color: editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginTop: 4 }}>
                  ยอดรวม: {editBreakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท {editForm.amount ? `(ยอดทั้งหมด ${parseFloat(editForm.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)` : ''}
                </div>
                {editForm.breakdowns.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.8fr 1fr auto', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                    <div>
                      {idx === editForm.breakdowns.length - 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={addEditBreakdownRow}
                          title="เพิ่มแถว"
                          style={{ padding: '4px 10px', lineHeight: 1 }}
                        >
                          +
                        </button>
                      )}
                    </div>
                    <select value={row.code} onChange={e => updateEditBreakdown(idx, 'code', e.target.value)} disabled={row.isAutoVat} style={{ minWidth: 0 }}>
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
                        onChange={e => updateEditBreakdown(idx, 'amount', e.target.value)}
                        style={{ 
                          flex: '1 1 auto',
                          minWidth: 0,
                          paddingRight: row.code !== '12' && row.code !== '13' ? '95px' : '8px'
                        }}
                        disabled={row.isAutoVat}
                      />
                      {row.code !== '12' && row.code !== '13' && (
                        <button
                          type="button"
                          onClick={() => computeVatForEditRow(idx)}
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
                    <select value={row.statusNote} onChange={e => updateEditBreakdown(idx, 'statusNote', e.target.value)} style={{ minWidth: 0 }}>
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
                      {editForm.breakdowns.length > 1 && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeEditBreakdownRow(idx)} style={{ whiteSpace: 'nowrap' }}>ลบ</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <label>
                หมายเหตุ
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม"
                />
              </label>
              <label>
                อัปโหลดสลิปโอนเงิน
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditSlipChange}
                  style={{ marginTop: '8px' }}
                />
                {editSlipPreview && (
                  <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                    <img src={editSlipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd' }} />
                    <button
                      type="button"
                      onClick={removeEditSlipPreview}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px' }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </label>
              <div className="svc-actions">
                <button type="button" className="btn-modal btn-modal-cancel" onClick={cancelEdit}>
                  <XCircle /> ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-modal btn-modal-save"
                  disabled={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2)}
                  title={editBreakdownSum.toFixed(2) !== (parseFloat(editForm.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}
                >
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
