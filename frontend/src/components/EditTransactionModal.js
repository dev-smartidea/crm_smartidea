import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import toast from '../utils/toast';
import { getImageUrl } from '../utils/imageHelper';
import { PencilSquare, XCircle, Calendar, Clock, Bank, FileText, Image, ListCheck, Upload } from 'react-bootstrap-icons';
import '../pages/user/TransactionHistoryPage.css';

export default function EditTransactionModal({
  open = false,
  onClose = () => {},
  transaction = null,
  token = '',
  api = '',
  onSaved = () => {},
  onResubmitted = () => {}
}) {
  const [form, setForm] = useState({
    amount: '',
    transactionDate: '',
    transactionTime: '',
    bank: '',
    notes: '',
    breakdowns: [],
  });
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

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

  const VAT_CODES = ['12', '13', '17', '19'];

  // Styled components
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
      outline: 'none',
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
    breakdownRow: {
      display: 'grid',
      gridTemplateColumns: '32px 1fr 1.4fr 1fr 32px',
      gap: '8px',
      marginTop: '8px',
      alignItems: 'center',
    },
    slipUploadArea: {
      border: '2px dashed #d1d5db',
      borderRadius: '10px',
      padding: '16px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: '#fafafa',
    },
  };

  // Focus trap & Escape key
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    const timer = setTimeout(() => modalRef.current?.focus(), 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  // คำนวณผลรวม breakdowns
  const breakdownSum = (form.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  useEffect(() => {
    if (transaction) {
      setForm({
        amount: transaction.amount || '',
        transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate).toISOString().slice(0,10) : '',
        transactionTime: transaction.transactionTime || '',
        bank: transaction.bank || '',
        notes: transaction.notes || '',
        breakdowns: Array.isArray(transaction.breakdowns) ? transaction.breakdowns.map(b => ({
          code: b.code || '',
          amount: b.amount || 0,
          statusNote: b.statusNote || 'รอบันทึกบัญชี',
          isAutoVat: b.isAutoVat || false
        })) : [],
      });
      setSlipFile(null);
      setSlipPreview(null);
    }
  }, [transaction]);

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateBreakdown = (idx, key, value) => {
    setForm(prev => {
      const list = [...prev.breakdowns];
      list[idx] = { ...list[idx], [key]: value };
      return { ...prev, breakdowns: list };
    });
  };
  const addBreakdown = () => setForm(prev => ({
    ...prev,
    breakdowns: [...prev.breakdowns, { code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false }]
  }));
  const removeBreakdown = (idx) => {
    setForm(prev => {
      const rows = [...prev.breakdowns];
      const current = rows[idx];
      const next = rows[idx + 1];
      
      // ถ้าลบรายการที่มี VAT ต่อท้าย ให้ลบ VAT ด้วย
      const shouldRemovePair = current && !current.isAutoVat && next && next.isAutoVat;
      
      if (shouldRemovePair) {
        const newRows = rows.filter((_, i) => i !== idx && i !== idx + 1);
        // ถ้าไม่มีแถวเหลือเลย ให้เพิ่มแถวเปล่า 1 แถว
        if (newRows.length === 0) {
          newRows.push({ code: '11', amount: '', statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
        }
        return { ...prev, breakdowns: newRows };
      } else {
        return { ...prev, breakdowns: rows.filter((_, i) => i !== idx) };
      }
    });
  };

  const computeVatForRow = (idx) => {
    setForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      const current = rows[idx] || { amount: '', code: '11', statusNote: 'รอบันทึกบัญชี', isAutoVat: false };
      
      // ตรวจสอบว่ารายการนี้เป็น VAT อยู่แล้วหรือไม่
      if (VAT_CODES.includes(current.code)) {
        toast.warning('ไม่สามารถคำนวณ VAT จากรายการ VAT ได้');
        return prev;
      }

      // ใช้ค่าที่กรอกในช่องนี้เป็นฐาน
      let base = parseFloat(current.amount);
      if (Number.isNaN(base) || base <= 0) {
        toast.warning('กรุณากรอกยอดเงินในช่องนี้ก่อนคำนวณ VAT');
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

      // แทรกรายการ VAT ใหม่ถัดจากรายการปัจจุบัน
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

  // Auto-calculate withholding tax when selecting code 9 or 10
  const handleCodeChange = (idx, newCode) => {
    setForm(prev => {
      const rows = [...(prev.breakdowns || [])];
      const current = rows[idx];

      // ถ้าเลือกรหัส 9 ให้ตรวจสอบว่ามีรายการรหัส 11 อยู่ในแถวอื่นหรือไม่
      if (newCode === '9' && !rows.some((b, i) => i !== idx && b.code === '11')) {
        toast.warning('กรุณาเพิ่มรายการรหัส 11 (ค่าคลิก) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่าย 2% ได้');
        return prev;
      }
      // ถ้าเลือกรหัส 10 ให้ตรวจสอบว่ามีรายการรหัส 14, 18 หรือ 15 อยู่ในแถวอื่นหรือไม่
      if (newCode === '10' && !rows.some((b, i) => i !== idx && (b.code === '14' || b.code === '18' || b.code === '15'))) {
        toast.warning('กรุณาเพิ่มรายการรหัส 14, 18 หรือ 15 (ค่าบริการ) ก่อนจึงจะสามารถเลือกรายการหัก ณ ที่จ่าย 3% ได้');
        return prev;
      }

      if (newCode === '9') {
        const idx11 = rows.findIndex((b, i) => i !== idx && b.code === '11');
        if (idx11 !== -1) {
          const row11 = rows[idx11];
          const amount11 = parseFloat(row11.amount) || 0;
          if (amount11 > 0) {
            const w = Math.round(amount11 * 0.02 * 100) / 100;
            rows[idx] = { ...current, code: '9', amount: (-w).toFixed(2) };
            return { ...prev, breakdowns: rows };
          }
        }
      }

      if (newCode === '10') {
        const idxSrc = rows.findIndex((b, i) => i !== idx && (b.code === '14' || b.code === '15' || b.code === '18'));
        if (idxSrc !== -1) {
          const rowSrc = rows[idxSrc];
          const amountSrc = parseFloat(rowSrc.amount) || 0;
          if (amountSrc > 0) {
            const w = Math.round(amountSrc * 0.03 * 100) / 100;
            rows[idx] = { ...current, code: '10', amount: (-w).toFixed(2) };
            return { ...prev, breakdowns: rows };
          }
        }
      }

      rows[idx] = { ...current, code: newCode };
      return { ...prev, breakdowns: rows };
    });
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setSlipPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeSlipPreview = () => {
    setSlipFile(null);
    setSlipPreview(null);
  };

  const handleSave = async () => {
    if (!transaction) return;
    
    try {
      setSaving(true);
      const payload = new FormData();
      payload.append('amount', form.amount);
      payload.append('transactionDate', form.transactionDate);
      if (form.transactionTime) payload.append('transactionTime', form.transactionTime);
      payload.append('bank', form.bank);
      payload.append('notes', form.notes || '');
      payload.append('breakdowns', JSON.stringify(form.breakdowns || []));
      if (slipFile) payload.append('slipImage', slipFile);
      const res = await axios.put(`${api}/api/transactions/${transaction._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSaved && onSaved(res.data);
      toast.success('บันทึกรายการสำเร็จ');
      onClose && onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    if (!transaction) return;
    try {
      setSaving(true);
      const res = await axios.put(`${api}/api/transactions/${transaction._id}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onResubmitted && onResubmitted(res.data);
      toast.success('ส่งรายการใหม่สำเร็จ');
      onClose && onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'ส่งใหม่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="svc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="แก้ไขรายการโอนเงิน">
      <div className="svc-modal-card" onClick={(e) => e.stopPropagation()} ref={modalRef} tabIndex={-1} style={{ maxWidth: '680px', width: '95vw', padding: '28px 30px' }}>
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
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="ปิด" type="button">✕</button>
        </div>

        <form className="svc-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          
          {/* ── Section 1: ข้อมูลหลัก ── */}
          <div style={formStyles.sectionCard}>
            <div style={formStyles.sectionTitle}>
              <FileText style={formStyles.sectionIcon} />
              <span>ข้อมูลหลัก</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Amount - Full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={formStyles.fieldLabel}>จำนวนเงิน (บาท) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateField('amount', e.target.value)}
                  placeholder="0.00"
                  aria-required="true"
                  style={formStyles.input}
                />
              </div>

              {/* Date */}
              <div>
                <label style={formStyles.fieldLabel}>
                  <Calendar size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  วันที่โอน
                </label>
                <input
                  type="date"
                  value={form.transactionDate}
                  onChange={(e) => updateField('transactionDate', e.target.value)}
                  style={formStyles.input}
                />
              </div>

              {/* Time */}
              <div>
                <label style={formStyles.fieldLabel}>
                  <Clock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  เวลาที่โอน
                </label>
                <input
                  type="time"
                  value={form.transactionTime}
                  onChange={(e) => updateField('transactionTime', e.target.value)}
                  style={formStyles.input}
                />
              </div>

              {/* Bank */}
              <div>
                <label style={formStyles.fieldLabel}>
                  <Bank size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  บัญชีธนาคาร
                </label>
                <select value={form.bank} onChange={(e) => updateField('bank', e.target.value)} aria-label="เลือกบัญชีธนาคาร" style={formStyles.select}>
                  <option value="KBANK">กสิกรไทย (KBANK)</option>
                  <option value="SCB">ไทยพาณิชย์ (SCB)</option>
                  <option value="BBL">กรุงเทพ (BBL)</option>
                  <option value="BAY-4396">กรุงศรี (BAY-4396)</option>
                  <option value="BAY-7146">กรุงศรี (BAY-7146)</option>
                  <option value="Cr.-8508">เครดิต (Cr.-8508)</option>
                  <option value="BBL-ส่วนตัว">กรุงเทพ - ส่วนตัว</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={formStyles.fieldLabel}>
                  <FileText size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  หมายเหตุ
                </label>
                <textarea rows={2} placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม" value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)} style={formStyles.textarea} />
              </div>
            </div>
          </div>

          {/* ── Section 2: แยกสัดส่วน ── */}
          <div style={formStyles.sectionCard}>
            <div style={formStyles.sectionTitle}>
              <ListCheck style={formStyles.sectionIcon} />
              <span>แยกสัดส่วนการโอนเงิน</span>
            </div>
            
            {form.amount && (
              <div style={{ fontSize: '0.9rem', color: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginBottom: '10px', padding: '8px 12px', background: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', fontWeight: '500' }}>
                ยอดรวม: {breakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (ยอดทั้งหมด {parseFloat(form.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)
              </div>
            )}
            
            {(form.breakdowns || []).map((row, idx) => (
              <div key={idx} style={formStyles.breakdownRow}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {idx === form.breakdowns.length - 1 && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={addBreakdown} title="เพิ่มแถว" style={{ padding: '4px 8px', lineHeight: 1, minWidth: '28px', fontSize: '12px' }}>+</button>
                  )}
                </div>
                <select value={row.code} onChange={e => handleCodeChange(idx, e.target.value)} disabled={row.isAutoVat} style={{ ...formStyles.select, fontSize: '0.8rem', padding: '6px 8px' }}>
                  {BREAKDOWN_CODE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <input type="number" step="0.01" placeholder="ยอดเงิน" value={row.amount}
                    onChange={e => updateBreakdown(idx, 'amount', e.target.value)}
                    disabled={row.isAutoVat}
                    style={{ ...formStyles.input, paddingRight: !VAT_CODES.includes(row.code) ? '72px' : '8px', fontSize: '0.85rem', padding: '6px 8px' }} />
                  {/* ปุ่มคำนวณ VAT อยู่ภายในฟิลด์ยอดเงิน */}
                  {!VAT_CODES.includes(row.code) && !row.isAutoVat && (
                    <button
                      type="button"
                      onClick={() => computeVatForRow(idx)}
                      title="คำนวณ VAT 7%"
                      style={{
                        position: 'absolute',
                        right: '3px',
                        padding: '2px 5px',
                        border: '1px solid #d3d8e2',
                        background: '#f8f9fa',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '8px',
                        color: '#334155',
                        fontWeight: '600',
                        lineHeight: '1.2'
                      }}
                    >
                      คำนวณ VAT
                    </button>
                  )}
                </div>
                <select value={row.statusNote} onChange={e => updateBreakdown(idx, 'statusNote', e.target.value)} style={{ ...formStyles.select, fontSize: '0.8rem', padding: '6px 8px' }}>
                  <option value="รอบันทึกบัญชี">รอบันทึกบัญชี</option>
                  <option value="ค่าคลิกที่ยังไม่ต้องเติม">ค่าคลิกที่ยังไม่ต้องเติม</option>
                </select>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {form.breakdowns.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeBreakdown(idx)} style={{ padding: '3px 7px', minWidth: '28px', fontSize: '12px' }}>✕</button>
                  )}
                </div>
              </div>
            ))}
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
              onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { setSlipFile(file); const reader = new FileReader(); reader.onloadend = () => setSlipPreview(reader.result); reader.readAsDataURL(file); } }}>
              <input type="file" accept="image/*" onChange={handleSlipChange} style={{ display: 'none' }} id="edit-slip-upload-input" />
              <label htmlFor="edit-slip-upload-input" style={{ cursor: 'pointer', display: 'block' }}>
                <Upload size={24} style={{ color: '#94a3b8', marginBottom: '6px' }} />
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>คลิกเพื่อเปลี่ยนสลิป หรือลากไฟล์มาวาง</p>
                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>รองรับไฟล์ JPG, PNG, GIF, WEBP (สูงสุด 5MB)</p>
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              {/* แสดงสลิปปัจจุบัน (ถ้ามี) */}
              {!slipPreview && transaction?.slipImage && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={getImageUrl(transaction.slipImage, api)} alt="สลิปปัจจุบัน"
                    style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '10px', border: '3px solid #86efac', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(22,163,74,0.9)', color: '#fff', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                    สลิปปัจจุบัน
                  </div>
                </div>
              )}
              {/* แสดง preview สลิปใหม่ (ถ้ามี) */}
              {slipPreview && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={slipPreview} alt="ตัวอย่างสลิปใหม่"
                    style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '10px', border: '3px solid #3b82f6', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <button type="button" onClick={removeSlipPreview}
                    style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 8px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ×
                  </button>
                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                    สลิปใหม่
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="svc-actions" style={{ marginTop: '6px' }}>
            <button type="button" className="btn-modal btn-modal-cancel" onClick={onClose} disabled={saving}>
              <XCircle /> ยกเลิก
            </button>
            <button 
              type="submit" 
              className="btn-modal btn-modal-save" 
              disabled={saving || breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2)}
              title={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            {transaction?.submissionStatus === 'rejected' && (
              <button type="button" className="btn-modal btn-modal-save" onClick={handleResubmit} disabled={saving} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>ส่งใหม่</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

EditTransactionModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  transaction: PropTypes.object,
  token: PropTypes.string,
  api: PropTypes.string,
  onSaved: PropTypes.func,
  onResubmitted: PropTypes.func
};