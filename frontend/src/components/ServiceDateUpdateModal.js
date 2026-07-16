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
  const [current, setCurrent] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // คำนวณวันที่แนะนำ
  const suggestDates = useCallback((item) => {
    if (!item) return { start: '', due: '' };
    const now = new Date();
    let suggestedStart;

    if (item.currentDueDate) {
      const existingDue = new Date(item.currentDueDate);
      // ถ้ายังไม่หมดอายุ → เริ่มต่อจากวันหมดเดิม
      // ถ้าหมดแล้ว → เริ่มวันนี้
      suggestedStart = existingDue > now ? existingDue : now;
    } else {
      suggestedStart = now;
    }

    // วันสิ้นสุด = วันเริ่ม + 1 เดือน
    const suggestedDue = new Date(suggestedStart);
    suggestedDue.setMonth(suggestedDue.getMonth() + 1);

    const fmt = (d) => d.toISOString().split('T')[0];
    return { start: fmt(suggestedStart), due: fmt(suggestedDue) };
  }, []);

  // เมื่อ queue เปลี่ยน → โหลดรายการแรก
  useEffect(() => {
    if (queue.length > 0) {
      const item = queue[0];
      setCurrent(item);
      const { start, due } = suggestDates(item);
      setStartDate(start);
      setDueDate(due);
      setError('');
    } else {
      setCurrent(null);
    }
  }, [queue, suggestDates]);

  if (!current) return null;

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
    } catch (err) {
      setError(err?.response?.data?.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss(current.notificationId);
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

  return (
    <div className="sdu-backdrop" onClick={handleDismiss}>
      <div className="sdu-modal" onClick={(e) => e.stopPropagation()}>

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

        {/* Queue info */}
        {queueLength > 1 && (
          <div className="sdu-queue-info">
            ⚠️ มีรายการรอกำหนดวันอีก {queueLength - 1} รายการหลังจากนี้
          </div>
        )}

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
          <button className="sdu-btn-skip" onClick={handleDismiss} disabled={saving}>
            ข้ามก่อน
          </button>
          <button className="sdu-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ กำลังบันทึก...' : '✓ บันทึกวันที่'}
          </button>
        </div>

      </div>
    </div>
  );
}
