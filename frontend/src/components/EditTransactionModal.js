import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../pages/user/TransactionHistoryPage.css';

export default function EditTransactionModal({
  open,
  onClose,
  transaction,
  token,
  api,
  onSaved,
  onResubmitted
}) {
  const [form, setForm] = useState({
    amount: '',
    transactionDate: '',
    bank: '',
    notes: '',
    breakdowns: [],
  });
  const [slipFile, setSlipFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // คำนวณผลรวม breakdowns
  const breakdownSum = (form.breakdowns || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  useEffect(() => {
    if (transaction) {
      setForm({
        amount: transaction.amount || '',
        transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate).toISOString().slice(0,10) : '',
        bank: transaction.bank || '',
        notes: transaction.notes || '',
        breakdowns: Array.isArray(transaction.breakdowns) ? transaction.breakdowns.map(b => ({
          code: b.code || '',
          amount: b.amount || 0,
          statusNote: b.statusNote || 'รอบบันทึกบัญชี',
          isAutoVat: b.isAutoVat || false
        })) : [],
      });
      setSlipFile(null);
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
    breakdowns: [...prev.breakdowns, { code: '11', amount: '', statusNote: 'รอบบันทึกบัญชี', isAutoVat: false }]
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
          newRows.push({ code: '11', amount: '', statusNote: 'รอบบันทึกบัญชี', isAutoVat: false });
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
      const current = rows[idx] || { amount: '', code: '11', statusNote: 'รอบบันทึกบัญชี', isAutoVat: false };
      
      // ตรวจสอบว่ารายการนี้เป็น VAT อยู่แล้วหรือไม่
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
      let vatCode = '12';
      let vatStatus = current.statusNote;
      
      if (current.code === '11') {
        vatCode = '12';
      } else if (current.code === '14') {
        vatCode = '13';
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

  const handleSave = async () => {
    if (!transaction) return;
    
    try {
      setSaving(true);
      const payload = new FormData();
      payload.append('amount', form.amount);
      payload.append('transactionDate', form.transactionDate);
      payload.append('bank', form.bank);
      payload.append('notes', form.notes || '');
      payload.append('breakdowns', JSON.stringify(form.breakdowns || []));
      if (slipFile) payload.append('slipImage', slipFile);
      const res = await axios.put(`${api}/api/transactions/${transaction._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSaved && onSaved(res.data);
      onClose && onClose();
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'บันทึกไม่สำเร็จ');
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
      onClose && onClose();
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'ส่งใหม่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>แก้ไขรายการโอนเงิน</h3>
        <form className="svc-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <label>
            จำนวนเงิน (บาท)
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              placeholder="0.00"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}
            />
          </label>
          <label>
            วันที่โอน
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) => updateField('transactionDate', e.target.value)}
            />
          </label>
          <label>
            บัญชีธนาคาร
            <select value={form.bank} onChange={(e) => updateField('bank', e.target.value)}>
              <option value="KBANK">KBANK (กสิกรไทย)</option>
              <option value="SCB">SCB (ไทยพาณิชย์)</option>
              <option value="BBL">BBL (กรุงเทพ)</option>
              <option value="KTB">KTB (กรุงไทย)</option>
              <option value="TTB">TTB (ทหารไทยธนชาต)</option>
              <option value="BAY">BAY (กรุงศรี)</option>
            </select>
          </label>

          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong>แยกสัดส่วนการโอนเงิน</strong>
            </div>
            {form.amount && (
              <div style={{ fontSize: '0.9rem', color: breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? '#dc3545' : '#6c757d', marginTop: 4 }}>
                ยอดรวม: {breakdownSum.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (ยอดทั้งหมด {parseFloat(form.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)
              </div>
            )}
            {(form.breakdowns || []).map((row, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1.8fr 1fr auto', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <div>
                  {idx === form.breakdowns.length - 1 && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={addBreakdown} title="เพิ่มแถว" style={{ padding: '4px 10px', lineHeight: 1 }}>+</button>
                  )}
                </div>
                <select value={row.code} onChange={e => updateBreakdown(idx, 'code', e.target.value)} disabled={row.isAutoVat} style={{ minWidth: 0 }}>
                  <option value="11">11 : ค่าคลิก</option>
                  <option value="12">12 : Vat ค่าคลิก</option>
                  <option value="13">13 : Vat ค่าบริการ</option>
                  <option value="14">14 : ค่าบริการ Google</option>
                  <option value="15">15 : ค่าบริการบางส่วน</option>
                  <option value="16">16 : คูปอง Google</option>
                </select>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <input type="number" step="0.01" placeholder="ยอดเงิน" value={row.amount}
                    onChange={e => updateBreakdown(idx, 'amount', e.target.value)}
                    disabled={row.isAutoVat}
                    style={{ flex: '1 1 auto', minWidth: 0, paddingRight: (row.code !== '12' && row.code !== '13') ? '95px' : '8px' }} />
                  {/* ปุ่มคำนวณ VAT อยู่ภายในฟิลด์ยอดเงิน */}
                  {(row.code !== '12' && row.code !== '13') && !row.isAutoVat && (
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
                  <option value="รอบบันทึกบัญชี">รอบบันทึกบัญชี</option>
                  <option value="ค่าคลิกที่ยังไม่ต้องเติม">ค่าคลิกที่ยังไม่ต้องเติม</option>
                </select>
                <div style={{ display: 'flex', gap: '4px', minWidth: 0 }}>
                  {form.breakdowns.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeBreakdown(idx)} style={{ whiteSpace: 'nowrap' }}>ลบ</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <label>
            หมายเหตุ
            <textarea rows={3} placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม" value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)} />
          </label>
          <label>
            อัปโหลดสลิปโอนเงิน
            <input type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} style={{ marginTop: '8px' }} />
          </label>

          <div className="svc-actions">
            <button type="button" className="btn-modal btn-modal-cancel" onClick={onClose} disabled={saving}>ยกเลิก</button>
            <button 
              type="submit" 
              className="btn-modal btn-modal-save" 
              disabled={saving || breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2)}
              title={breakdownSum.toFixed(2) !== (parseFloat(form.amount || 0)).toFixed(2) ? 'ยอดรวมจากการแยกไม่ตรงกับยอดเงินหลัก' : ''}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            {transaction?.submissionStatus === 'rejected' && (
              <button type="button" className="btn-modal btn-modal-save" onClick={handleResubmit} disabled={saving}>ส่งใหม่</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
