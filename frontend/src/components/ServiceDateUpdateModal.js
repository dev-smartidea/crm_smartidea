import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ServiceDateUpdateModal.css';

/**
 * ServiceDateUpdateModal
 * แสดงเมื่อบัญชีอนุมัติรายการโอนที่มีค่าบริการ
 * ให้ user กรอกวันเริ่มและวันสิ้นสุดรอบใหม่ของบริการ
 *
 * Props:
 *   queue: Array<{ notificationId, serviceId, cid, customerName, serviceType, amount, transactionDate, currentStartDate, currentDueDate }>
 *   onSaved(notificationId): callback เมื่อบันทึกสำเร็จ
 *   onDismiss(notificationId): callback เมื่อกด "ข้ามก่อน"
 */
export default function ServiceDateUpdateModal({ queue = [], onSaved, onDismiss }) {
  // index ของรายการที่กำลังแสดง
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const current = queue[currentIndex] || null;

  // คำนวณวันที่แนะนำ
  const suggestDates = useCallback((item) => {
    if (!item) return { start: '', due: '' };
    const now = new Date();
    let suggestedStart;
    if (item.currentDueDate) {
      const existingDue = new Date(item.currentDueDate);
      suggestedStart = existingDue > now ? existingDue : now;
    } else {
      suggestedStart = now;
    }
    const suggestedDue = new Date(suggestedStart);
    suggestedDue.setMonth(suggestedDue.getMonth() + 1);
    const fmt = (d) => d.toISOString().split('T')[0];
    return { start: fmt(suggestedStart), due: fmt(suggestedDue) };
  }, []);

  // เมื่อเปลี่ยน index → reset dates
  useEffect(() => {
    if (current) {
      const { start, due } = suggestDates(current);
      setStartDate(start);
      setDueDate(due);
      setError('');
    }
  }, [currentIndex, current, suggestDates]);

  // ถ้า index เกิน queue ให้ reset กลับ 0
  useEffect(() => {
    if (queue.length > 0 && currentIndex >= queue.length) {
      setCurrentIndex(0);
    }
  }, [queue.length, currentIndex]);

  if (!current) {
    // แสดง modal ว่าง (กรณีกด "ดูรายการ" แต่ queue ว่างเพราะ fetch ยังไม่เสร็จ หรือไม่มีรายการค้าง)
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '40px 32px',
          maxWidth: '440px', width: '100%', textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1f2937' }}>
            ไม่มีรายการค้างกำหนดวันที่
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#6b7280' }}>
            ทุกบริการที่ได้รับการอนุมัติกำหนดวันรันโฆษณาเรียบร้อยแล้ว
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('close-date-update-modal'))}
            style={{
              padding: '10px 28px', borderRadius: '10px',
              background: '#f97316', color: '#fff', border: 'none',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            ปิด
          </button>
        </div>
      </div>
    );
  }

  // คำนวณจำนวนวัน/เดือนของช่วงที่เลือก
  const getDurationText = () => {
    if (!startDate || !dueDate) return null;
    const s = new Date(startDate);
    const d = new Date(dueDate);
    if (d <= s) return null;
    const diffMs = d - s;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    if (months > 0 && days > 0) return `${months} เดือน ${days} วัน`;
    if (months > 0) return `${months} เดือน`;
    return `${diffDays} วัน`;
  };

  const handleSave = async () => {
    setError('');
    if (!startDate || !dueDate) {
      setError('กรุณาเลือกวันที่เริ่มต้นและวันสิ้นสุด');
      return;
    }
    if (new Date(dueDate) <= new Date(startDate)) {
      setError('วันสิ้นสุดต้องมาหลังวันเริ่มต้น');
      return;
    }
    try {
      setSaving(true);
      await axios.put(
        `${api}/api/services/${current.serviceId}/update-dates`,
        { startDate, dueDate, notificationId: current.notificationId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onSaved) onSaved(current.notificationId);
      // หลังบันทึก index จะต้อง clamp ให้ถูก (queue จะสั้นลง 1)
      setCurrentIndex(prev => Math.max(0, prev >= queue.length - 1 ? prev - 1 : prev));
    } catch (err) {
      setError(err?.response?.data?.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ข้ามรายการนี้ชั่วคราว → ไปรายการถัดไป (ยังอยู่ใน queue)
  const handleSkipNext = () => {
    setError('');
    setCurrentIndex(prev => (prev < queue.length - 1 ? prev + 1 : 0));
  };

  // ปิด Modal ทั้งหมดชั่วคราว แต่ queue ยังอยู่ใน App state
  const handleCloseAll = () => {
    window.dispatchEvent(new CustomEvent('close-date-update-modal'));
  };

  // ข้ามถาวร → ลบออกจาก queue
  const handleDismissPermanent = () => {
    if (onDismiss) onDismiss(current.notificationId);
    setCurrentIndex(prev => Math.max(0, prev >= queue.length - 1 ? prev - 1 : prev));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return '-'; }
  };

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '-';
    return parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  };

  const durationText = getDurationText();
  const queueLength = queue.length;
  const isMultiple = queueLength > 1;

  return (
    <div className="sdu-backdrop" onClick={handleCloseAll}>
      <div className="sdu-modal" onClick={(e) => e.stopPropagation()}>

        {/* Step indicator — แสดงเฉพาะกรณีมีหลายรายการ */}
        {isMultiple && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px 0', gap: '8px'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>
              รายการที่ {currentIndex + 1} จาก {queueLength} รายการ
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {queue.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  style={{
                    width: i === currentIndex ? '20px' : '8px',
                    height: '8px', borderRadius: '4px',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    background: i === currentIndex ? '#f97316' : '#d1d5db',
                    padding: 0, flexShrink: 0
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="sdu-header">
          <div className="sdu-header-icon">📅</div>
          <div className="sdu-header-text">
            <h3>กรุณากำหนดวันรันโฆษณา</h3>
            <p>
              บัญชีอนุมัติรายการโอน{' '}
              <strong style={{ color: '#fff' }}>
                "{current.cid || current.serviceId}"
              </strong>{' '}
              ({current.customerName || 'ลูกค้า'}) แล้ว
            </p>
          </div>
        </div>

        {/* Transaction info */}
        <div className="sdu-info">
          <div className="sdu-info-row">
            <span className="sdu-info-label">ประเภทบริการ</span>
            <span className="sdu-info-value">{current.serviceType || '-'}</span>
          </div>
          <div className="sdu-info-row">
            <span className="sdu-info-label">ยอดโอน</span>
            <span className="sdu-info-value amount">{formatAmount(current.amount)} บาท</span>
          </div>
          <div className="sdu-info-row">
            <span className="sdu-info-label">ลูกค้า</span>
            <span className="sdu-info-value">{current.customerName || '-'}</span>
          </div>
          <div className="sdu-info-row">
            <span className="sdu-info-label">วันที่โอน</span>
            <span className="sdu-info-value">{formatDate(current.transactionDate)}</span>
          </div>
        </div>

        {/* Previous dates (if any) */}
        {(current.currentStartDate || current.currentDueDate) && (
          <div className="sdu-prev-dates">
            <span className="sdu-prev-label">รอบเดิม:</span>
            <span className="sdu-prev-value">
              {formatDate(current.currentStartDate)} → {formatDate(current.currentDueDate)}
            </span>
          </div>
        )}

        {/* Date inputs */}
        <div className="sdu-fields">
          <div className="sdu-field">
            <label>
              วันเริ่มรอบใหม่<span className="required">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              className={error && !startDate ? 'error' : ''}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError('');
                // Auto-adjust dueDate = startDate + 1 month
                if (e.target.value) {
                  const d = new Date(e.target.value);
                  d.setMonth(d.getMonth() + 1);
                  setDueDate(d.toISOString().split('T')[0]);
                }
              }}
            />
          </div>
          <div className="sdu-field">
            <label>
              วันสิ้นสุดรอบใหม่<span className="required">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              min={startDate || undefined}
              className={error && !dueDate ? 'error' : ''}
              onChange={(e) => { setDueDate(e.target.value); setError(''); }}
            />
          </div>
        </div>

        {/* Duration display */}
        {durationText && (
          <div className="sdu-duration-badge">
            ระยะเวลา: <strong>{durationText}</strong>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 24px 0' }}>
            <p className="sdu-error-msg">⚠️ {error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="sdu-actions">
          {isMultiple ? (
            <>
              <button
                className="sdu-btn-skip"
                onClick={handleDismissPermanent}
                disabled={saving}
                title="ไม่ต้องการกำหนดวันนี้ ลบออกจากรายการ"
              >
                ข้ามถาวร
              </button>
              <button
                className="sdu-btn-next"
                onClick={handleSkipNext}
                disabled={saving}
                title="ข้ามไปรายการถัดไปก่อน กลับมาทำทีหลัง"
              >
                ถัดไป ({currentIndex + 1}/{queueLength})
              </button>
              <button className="sdu-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : '✓ บันทึกวันที่'}
              </button>
            </>
          ) : (
            <>
              <button className="sdu-btn-skip" onClick={handleCloseAll} disabled={saving}>
                ทำทีหลัง
              </button>
              <button className="sdu-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : '✓ บันทึกวันที่'}
              </button>
            </>
          )}
        </div>

        {/* ลิงก์ปิดทั้งหมด (กรณีหลายรายการ) */}
        {isMultiple && (
          <div style={{ textAlign: 'center', paddingBottom: '16px' }}>
            <button
              onClick={handleCloseAll}
              disabled={saving}
              style={{
                background: 'none', border: 'none', color: '#9ca3af',
                fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline'
              }}
            >
              ปิดหน้าต่างนี้ กลับมาทำทีหลัง (ยังมี {queueLength} รายการค้าง)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
