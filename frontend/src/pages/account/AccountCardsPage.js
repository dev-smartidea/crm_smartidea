import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CreditCard2BackFill, Google, Facebook, DashCircle, PlusCircle, Trash2 } from 'react-bootstrap-icons';
import './AccountCardsPage.css';

const CHANNEL_OPTIONS = ['Google Ads', 'Facebook Ads', 'Other'];

const channelMeta = {
  'Google Ads': { label: 'Google Ads', icon: <Google />, tone: 'google' },
  'Facebook Ads': { label: 'Facebook Ads', icon: <Facebook />, tone: 'facebook' },
  Other: { label: 'Other', icon: null, tone: 'other' }
};

export default function AccountCardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionCard, setActionCard] = useState(null); // { cardId, type }
  const [formAmount, setFormAmount] = useState('');
  const [formChannel, setFormChannel] = useState('Google Ads');
  const [formReference, setFormReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newCardForm, setNewCardForm] = useState({ displayName: '', last4: '', status: 'active' });
  const api = process.env.REACT_APP_API_URL;

  const totals = useMemo(() => ({
    totalCards: cards.length,
    totalBalance: cards.reduce((sum, c) => sum + (c.balance || 0), 0),
    google: cards.filter(c => c.channels?.includes('Google Ads')).length,
    facebook: cards.filter(c => c.channels?.includes('Facebook Ads')).length
  }), [cards]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/cards`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setCards(res.data || []);
        setError('');
      } catch (err) {
        setError('โหลดข้อมูลบัตรไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [api]);

  const openAction = (cardId, type) => {
    setActionCard({ cardId, type });
    setFormAmount('');
    setFormChannel('Google Ads');
    setFormReference('');
    setError('');
  };

  const submitAction = async () => {
    if (!actionCard) return;
    const amountNum = Number(formAmount);
    if (!formAmount || Number.isNaN(amountNum) || amountNum <= 0) {
      setError('จำนวนเงินไม่ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      if (actionCard.type === 'topup') {
        await axios.post(`${api}/api/cards/topup`, { cardId: actionCard.cardId, amount: amountNum }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        await axios.post(`${api}/api/cards/charge`, {
          cardId: actionCard.cardId,
          amount: amountNum,
          channel: formChannel,
          reference: formReference
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      setActionCard(null);
      setFormAmount('');
      setFormReference('');
      setError('');
      const res = await axios.get(`${api}/api/cards`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCards(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAddCard = async () => {
    if (!newCardForm.displayName.trim() || !newCardForm.last4.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${api}/api/cards`, newCardForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowAddCard(false);
      setNewCardForm({ displayName: '', last4: '', status: 'active' });
      setError('');
      const res = await axios.get(`${api}/api/cards`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCards(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'เพิ่มบัตรไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeleteCard = async (cardId) => {
    setSubmitting(true);
    try {
      await axios.delete(`${api}/api/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowDeleteConfirm(null);
      setError('');
      const res = await axios.get(`${api}/api/cards`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCards(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'ลบบัตรไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cards-shell">
      <div className="cards-hero">
        <div className="cards-hero-icon"><CreditCard2BackFill /></div>
        <div>
          <h1 className="cards-title">บัตร</h1>
          <p className="cards-subtitle">จัดการบัตรตัดยอดและแพลตฟอร์มที่เชื่อมต่อ</p>
        </div>
        <button className="cards-hero-btn" onClick={() => { setShowAddCard(true); setError(''); }}>
          <PlusCircle /> เพิ่มบัตร
        </button>
      </div>

      <div className="cards-surface">
        {error && <div className="cards-error">{error}</div>}

        {loading ? (
          <div className="cards-loading">
            <div className="cards-loading-spinner" />
            <div>กำลังโหลดข้อมูล...</div>
          </div>
        ) : (
          <>
            <div className="cards-summary-grid">
              <SummaryCard label="จำนวนบัตรทั้งหมด" value={totals.totalCards} tone="a" note="บัตร" />
              <SummaryCard label="ยอดคงเหลือรวม" value={totals.totalBalance.toLocaleString()} tone="b" note="บาท" />
              <SummaryCard label="Google Ads" value={totals.google} tone="c" note="บัตร" />
              <SummaryCard label="Facebook Ads" value={totals.facebook} tone="d" note="บัตร" />
            </div>

            <div className="cards-grid">
              {cards.map(card => (
                <div key={card._id} className="card-panel">
                  <div className="card-top">
                    <div className="card-chip">{card.last4}</div>
                    <div className="card-headings">
                      <div className="card-label">{card.displayName || `บัตรลงท้าย ${card.last4}`}</div>
                      <span className={`pill ${card.status === 'active' ? 'pill-live' : 'pill-off'}`}>
                        {card.status === 'active' ? 'พร้อมใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </div>
                    <div className="card-dots" />
                  </div>

                  <div className="card-balance-row">
                    <div>
                      <p className="muted">ยอดคงเหลือ</p>
                      <div className="value-xxl">{card.balance?.toLocaleString() || '0'} <span className="muted">฿</span></div>
                    </div>
                    <div className="balance-crest" />
                  </div>

                  <div className="card-channels">
                    {card.channels?.length ? (
                      card.channels.map(ch => (
                        <span key={ch} className={`chip ${channelMeta[ch]?.tone || 'other'}`}>
                          {channelMeta[ch]?.icon && <span className="chip-icon">{channelMeta[ch].icon}</span>}
                          {channelMeta[ch]?.label || ch}
                        </span>
                      ))
                    ) : (
                      <span className="chip muted">ไม่ได้ระบุแพลตฟอร์ม</span>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="ghost-btn" onClick={() => openAction(card._id, 'charge')}>
                      <DashCircle /> ตัดยอด
                    </button>
                    <button className="solid-btn" onClick={() => openAction(card._id, 'topup')}>
                      <PlusCircle /> เติมเงิน
                    </button>
                    <button className="danger-btn" onClick={() => { setShowDeleteConfirm(card._id); setError(''); }} title="ลบบัตร">
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddCard && (
        <div className="modal-backdrop" onClick={() => setShowAddCard(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon topup">
                <PlusCircle />
              </div>
              <div>
                <div className="modal-title">เพิ่มบัตรใหม่</div>
                <div className="modal-hint">กรอกข้อมูลบัตรของคุณ</div>
              </div>
              <button className="modal-close" onClick={() => setShowAddCard(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span className="field-label">ชื่อบัตร <span className="req">*</span></span>
                <input
                  type="text"
                  placeholder="เช่น บัตรหลัก"
                  className="field-input"
                  value={newCardForm.displayName}
                  onChange={e => setNewCardForm({ ...newCardForm, displayName: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">ตัวเลข 4 หลักท้าย <span className="req">*</span></span>
                <input
                  type="text"
                  maxLength="4"
                  placeholder="1234"
                  className="field-input"
                  value={newCardForm.last4}
                  onChange={e => setNewCardForm({ ...newCardForm, last4: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <label className="field">
                <span className="field-label">สถานะ</span>
                <select
                  className="field-input"
                  value={newCardForm.status}
                  onChange={e => setNewCardForm({ ...newCardForm, status: e.target.value })}
                >
                  <option value="active">พร้อมใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </label>
              {error && <div className="inline-error">⚠️ {error}</div>}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowAddCard(false)}>ยกเลิก</button>
              <button className="solid-btn topup" disabled={submitting} onClick={submitAddCard}>
                {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มบัตร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon charge">
                <Trash2 />
              </div>
              <div>
                <div className="modal-title">ยืนยันการลบบัตร</div>
                <div className="modal-hint">คุณแน่ใจหรือไม่ว่าต้องการลบบัตรนี้</div>
              </div>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="inline-error">⚠️ {error}</div>}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowDeleteConfirm(null)}>ยกเลิก</button>
              <button className="danger-btn" disabled={submitting} onClick={() => submitDeleteCard(showDeleteConfirm)}>
                {submitting ? 'กำลังลบ...' : 'ลบบัตร'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionCard && (
        <div className="modal-backdrop" onClick={() => setActionCard(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className={`modal-icon ${actionCard.type}`}>
                {actionCard.type === 'topup' ? <PlusCircle /> : <DashCircle />}
              </div>
              <div>
                <div className="modal-title">{actionCard.type === 'topup' ? 'เติมเงินเข้าบัตร' : 'ตัดยอดจากบัตร'}</div>
                <div className="modal-hint">กรอกจำนวนเงินและยืนยันการทำรายการ</div>
              </div>
              <button className="modal-close" onClick={() => setActionCard(null)}>✕</button>
            </div>

            <div className="modal-body">
              <label className="field">
                <span className="field-label">จำนวนเงิน (บาท) <span className="req">*</span></span>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  className="field-input"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                />
              </label>

              {actionCard.type === 'charge' && (
                <>
                  <label className="field">
                    <span className="field-label">ช่องทาง <span className="req">*</span></span>
                    <select
                      className="field-input"
                      value={formChannel}
                      onChange={e => setFormChannel(e.target.value)}
                    >
                      {CHANNEL_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">อ้างอิง (ถ้ามี)</span>
                    <input
                      placeholder="Campaign / Billing / Note"
                      className="field-input"
                      value={formReference}
                      onChange={e => setFormReference(e.target.value)}
                    />
                  </label>
                </>
              )}

              {error && (
                <div className="inline-error">⚠️ {error}</div>
              )}
            </div>

            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setActionCard(null)}>ยกเลิก</button>
              <button
                className={`solid-btn ${actionCard.type}`}
                disabled={submitting}
                onClick={submitAction}
              >
                {submitting ? 'กำลังดำเนินการ...' : 'ยืนยัน' }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, note, tone }) {
  return (
    <div className={`summary-tile tone-${tone}`}>
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-note">{note}</div>
    </div>
  );
}
