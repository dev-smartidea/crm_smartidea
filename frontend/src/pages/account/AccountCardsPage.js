import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard2BackFill, Google, Facebook, DashCircle, PlusCircle, Trash2, Eye, Calendar3 } from 'react-bootstrap-icons';
import toast from '../../utils/toast';
import './AccountCardsPage.css';

const CHANNEL_OPTIONS = ['Google Ads', 'Facebook Ads', 'Other'];

const channelMeta = {
  'Google Ads': { label: 'Google Ads', icon: <Google />, tone: 'google' },
  'Facebook Ads': { label: 'Facebook Ads', icon: <Facebook />, tone: 'facebook' },
  Other: { label: 'Other', icon: null, tone: 'other' }
};

export default function AccountCardsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionCard, setActionCard] = useState(null); // { cardId, type }
  const [formAmount, setFormAmount] = useState('');
  const [formChannel, setFormChannel] = useState('Google Ads');
  const [formReference, setFormReference] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formServiceSearch, setFormServiceSearch] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [formNote, setFormNote] = useState('');
  const [formChargeTime, setFormChargeTime] = useState('');
  const [serviceOptions, setServiceOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newCardForm, setNewCardForm] = useState({ displayName: '', last4: '', status: 'active', channels: [] });
  const [showEditCard, setShowEditCard] = useState(null);
  const [editCardForm, setEditCardForm] = useState({ displayName: '', last4: '', status: 'active', channels: [] });
  const api = process.env.REACT_APP_API_URL;

  // Escape key handler for all modals
  const closeAllModals = useCallback(() => {
    setShowAddCard(false);
    setShowEditCard(null);
    setShowDeleteConfirm(null);
    setActionCard(null);
    setError('');
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeAllModals();
    };
    if (showAddCard || showEditCard || showDeleteConfirm || actionCard) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showAddCard, showEditCard, showDeleteConfirm, actionCard, closeAllModals]);

  // ปรับแต่งบัตรที่ใช้วงเงินร่วมกัน (1000, 1018, 1026)
  const cardsWithSharedBalance = useMemo(() => {
    const sharedBalanceCards = ['1000', '1018', '1026'];
    const masterCard = cards.find(c => c.last4 === '1000');
    
    if (!masterCard) return cards; // ถ้าไม่มีบัตร 1000 ให้ใช้ cards ตัวเดิม

    const sharedBalance = masterCard.balance;

    return cards.map(card => {
      if (sharedBalanceCards.includes(card.last4)) {
        return { ...card, balance: sharedBalance };
      }
      return card;
    });
  }, [cards]);

  const totals = useMemo(() => ({
    totalCards: cardsWithSharedBalance.length,
    totalBalance: cardsWithSharedBalance.reduce((sum, c) => sum + (c.balance || 0), 0),
    google: cardsWithSharedBalance.filter(c => c.channels?.includes('Google Ads')).length,
    facebook: cardsWithSharedBalance.filter(c => c.channels?.includes('Facebook Ads')).length
  }), [cardsWithSharedBalance]);

  // Filter services by selected channel + search text
  const filteredServices = useMemo(() => {
    let list = serviceOptions;
    if (formChannel) {
      list = list.filter(s => s.serviceType === formChannel);
    }
    if (formServiceSearch) {
      const q = formServiceSearch.toLowerCase();
      list = list.filter(s => {
        const name = (s.name || '').toLowerCase();
        const cid = (s.customerIdField || s.cid || '').toLowerCase();
        return name.includes(q) || cid.includes(q);
      });
    }
    return list;
  }, [serviceOptions, formChannel, formServiceSearch]);

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

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await axios.get(`${api}/api/services`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const list = Array.isArray(res.data) ? res.data : (res.data.services || []);
        setServiceOptions(list);
      } catch (e) {
        // keep options empty on error
        setServiceOptions([]);
      }
    };
    fetchServices();
  }, [api]);

  const openAction = (cardId, type) => {
    setActionCard({ cardId, type });
    setFormAmount('');
    setFormChannel('Google Ads');
    setFormReference('');
    setFormServiceId('');
    setFormServiceSearch('');
    setShowServiceDropdown(false);
    setFormNote('');
    setFormChargeTime('');
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
          reference: formReference,
          note: formNote,
          chargeTime: formChargeTime,
          serviceId: formServiceId || undefined
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
      toast.success(actionCard.type === 'topup' ? 'เติมเงินสำเร็จ' : 'ตัดยอดสำเร็จ');
    } catch (err) {
      setError(err.response?.data?.error || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChannel = (channel) => {
    setNewCardForm(prev => {
      const exists = prev.channels.includes(channel);
      const channels = exists ? prev.channels.filter(c => c !== channel) : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  const submitAddCard = async () => {
    if (!newCardForm.displayName.trim() || !newCardForm.last4.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (!newCardForm.channels || newCardForm.channels.length === 0) {
      setError('เลือกแพลตฟอร์มอย่างน้อย 1 รายการ');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${api}/api/cards`, newCardForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowAddCard(false);
      setNewCardForm({ displayName: '', last4: '', status: 'active', channels: [] });
      setError('');
      const res = await axios.get(`${api}/api/cards`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCards(res.data || []);
      toast.success('เพิ่มบัตรสำเร็จ');
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
      toast.success('ลบบัตรสำเร็จ');
    } catch (err) {
      setError(err.response?.data?.error || 'ลบบัตรไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditCard = (card) => {
    setError(''); // Clear error first
    setEditCardForm({
      displayName: card.displayName || '',
      last4: card.last4 || '',
      status: card.status || 'active',
      channels: (card.channels && card.channels.length > 0) ? card.channels : []
    });
    setShowEditCard(card._id);
  };

  const toggleEditChannel = (channel) => {
    setEditCardForm(prev => {
      const exists = prev.channels.includes(channel);
      const channels = exists ? prev.channels.filter(c => c !== channel) : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  const submitEditCard = async () => {
    if (!editCardForm.displayName.trim() || !editCardForm.last4.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    const channelsArray = Array.isArray(editCardForm.channels) ? editCardForm.channels : [];
    // อนุญาตให้ไม่เลือกแพลตฟอร์มได้ (จะไปแสดงว่า "ไม่ได้ระบุแพลตฟอร์ม")
    setSubmitting(true);
    try {
      await axios.put(`${api}/api/cards/${showEditCard}`, { ...editCardForm, channels: channelsArray }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShowEditCard(null);
      setEditCardForm({ displayName: '', last4: '', status: 'active', channels: [] });
      setError('');
      const res = await axios.get(`${api}/api/cards`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setCards(res.data || []);
      toast.success('แก้ไขบัตรสำเร็จ');
    } catch (err) {
      setError(err.response?.data?.error || 'แก้ไขบัตรไม่สำเร็จ');
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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="cards-hero-btn" 
            style={{ background: '#10b981', borderColor: '#10b981' }}
            onClick={() => navigate('/dashboard/account/cards/daily-summary')}
          >
            <Calendar3 /> สรุปรายวัน
          </button>
          <button className="cards-hero-btn" onClick={() => { setShowAddCard(true); setError(''); }}>
            <PlusCircle /> เพิ่มบัตร
          </button>
        </div>
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
              <SummaryCard label="ยอดคงเหลือรวม" value={totals.totalBalance.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tone="b" note="บาท" />
              <SummaryCard label="Google Ads" value={totals.google} tone="c" note="บัตร" />
              <SummaryCard label="Facebook Ads" value={totals.facebook} tone="d" note="บัตร" />
            </div>

            {cardsWithSharedBalance.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                <CreditCard2BackFill size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>ยังไม่มีบัตร</p>
                <p style={{ fontSize: '0.85rem' }}>กดปุ่ม "เพิ่มบัตร" เพื่อเริ่มต้นใช้งาน</p>
              </div>
            )}

            <div className="cards-grid">
              {cardsWithSharedBalance.map(card => (
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
                      <div className="value-xxl">{card.balance?.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} <span className="muted">฿</span></div>
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
                    <button className="ghost-btn" onClick={() => navigate(`/dashboard/account/cards/${card._id}/ledger`)} aria-label="ดูประวัติ">
                      <Eye /> ประวัติ
                    </button>
                    <button className="ghost-btn" onClick={() => openEditCard(card)} aria-label="แก้ไขบัตร">
                      ✏️ แก้ไข
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => openAction(card._id, 'charge')}
                      disabled={card.status !== 'active'}
                      title={card.status !== 'active' ? 'บัตรถูกปิดใช้งาน' : 'ตัดยอด'}
                    >
                      <DashCircle /> ตัดยอด
                    </button>
                    <button
                      className="solid-btn"
                      onClick={() => openAction(card._id, 'topup')}
                      disabled={card.status !== 'active'}
                      title={card.status !== 'active' ? 'บัตรถูกปิดใช้งาน' : 'เติมเงิน'}
                    >
                      <PlusCircle /> เติมเงิน
                    </button>
                    <button className="danger-btn" onClick={() => { setShowDeleteConfirm(card._id); setError(''); }} title="ลบบัตร" aria-label="ลบบัตร">
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="เพิ่มบัตรใหม่" onClick={() => setShowAddCard(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon topup">
                <PlusCircle />
              </div>
              <div>
                <div className="modal-title">เพิ่มบัตรใหม่</div>
                <div className="modal-hint">กรอกข้อมูลบัตรของคุณ</div>
              </div>
              <button className="modal-close" onClick={() => setShowAddCard(false)} aria-label="ปิด">✕</button>
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
              <div className="field">
                <span className="field-label">แพลตฟอร์มที่ใช้ <span className="req">*</span></span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Google Ads', 'Facebook Ads'].map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: newCardForm.channels.includes(ch) ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        background: newCardForm.channels.includes(ch) ? '#eff6ff' : '#fff',
                        color: '#0f172a',
                        cursor: 'pointer',
                        boxShadow: newCardForm.channels.includes(ch) ? '0 6px 14px rgba(37,99,235,0.18)' : 'none'
                      }}
                    >
                      {ch === 'Google Ads' && <Google />}
                      {ch === 'Facebook Ads' && <Facebook />}
                      <span>{ch}</span>
                    </button>
                  ))}
                </div>
              </div>
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

      {showEditCard && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="แก้ไขบัตร" onClick={() => setShowEditCard(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon topup">
                ✏️
              </div>
              <div>
                <div className="modal-title">แก้ไขบัตร</div>
                <div className="modal-hint">อัปเดตข้อมูลบัตรของคุณ</div>
              </div>
              <button className="modal-close" onClick={() => setShowEditCard(null)} aria-label="ปิด">✕</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span className="field-label">ชื่อบัตร <span className="req">*</span></span>
                <input
                  type="text"
                  placeholder="เช่น บัตรหลัก"
                  className="field-input"
                  value={editCardForm.displayName}
                  onChange={e => setEditCardForm({ ...editCardForm, displayName: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">ตัวเลข 4 หลักท้าย <span className="req">*</span></span>
                <input
                  type="text"
                  maxLength="4"
                  placeholder="1234"
                  className="field-input"
                  value={editCardForm.last4}
                  onChange={e => setEditCardForm({ ...editCardForm, last4: e.target.value.replace(/\D/g, '') })}
                />
              </label>
              <label className="field">
                <span className="field-label">สถานะ</span>
                <select
                  className="field-input"
                  value={editCardForm.status}
                  onChange={e => setEditCardForm({ ...editCardForm, status: e.target.value })}
                >
                  <option value="active">พร้อมใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </label>
              <div className="field">
                <span className="field-label">แพลตฟอร์มที่ใช้ <span className="req">*</span></span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Google Ads', 'Facebook Ads'].map(ch => {
                    const isSelected = Array.isArray(editCardForm.channels) && editCardForm.channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleEditChannel(ch)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#fff',
                          color: '#0f172a',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 6px 14px rgba(37,99,235,0.18)' : 'none'
                        }}
                      >
                        {ch === 'Google Ads' && <Google />}
                        {ch === 'Facebook Ads' && <Facebook />}
                        <span>{ch}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && <div className="inline-error">⚠️ {error}</div>}
            </div>
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowEditCard(null)}>ยกเลิก</button>
              <button className="solid-btn topup" disabled={submitting} onClick={submitEditCard}>
                {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="ยืนยันการลบบัตร" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon charge">
                <Trash2 />
              </div>
              <div>
                <div className="modal-title">ยืนยันการลบบัตร</div>
                <div className="modal-hint">คุณแน่ใจหรือไม่ว่าต้องการลบบัตรนี้</div>
              </div>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)} aria-label="ปิด">✕</button>
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={actionCard.type === 'topup' ? 'เติมเงินเข้าบัตร' : 'ตัดยอดจากบัตร'} onClick={() => setActionCard(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className={`modal-icon ${actionCard.type}`}>
                {actionCard.type === 'topup' ? <PlusCircle /> : <DashCircle />}
              </div>
              <div>
                <div className="modal-title">{actionCard.type === 'topup' ? 'เติมเงินเข้าบัตร' : 'ตัดยอดจากบัตร'}</div>
                <div className="modal-hint">กรอกจำนวนเงินและยืนยันการทำรายการ</div>
              </div>
              <button className="modal-close" onClick={() => setActionCard(null)} aria-label="ปิด">✕</button>
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

                  <label className="field" style={{ position: 'relative' }}>
                    <span className="field-label" style={{ display: 'block', marginBottom: 6 }}>บริการที่ใช้</span>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="พิมพ์ค้นหาบริการ..."
                      value={formServiceSearch || ''}
                      onChange={e => { setFormServiceSearch(e.target.value); setFormServiceId(''); }}
                      onFocus={() => setShowServiceDropdown(true)}
                      onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                      autoComplete="off"
                    />
                    {showServiceDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        maxHeight: '220px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #d4d4d4',
                        borderRadius: '0 0 6px 6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                      }}>
                        {filteredServices.length === 0 ? (
                          <div style={{ padding: '10px 12px', color: '#a3a3a3', fontSize: '13px' }}>ไม่พบบริการ</div>
                        ) : (
                          <button
                            type="button"
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: !formServiceId ? '#eff6ff' : '#fff',
                              cursor: 'pointer',
                              fontSize: '13px',
                              textAlign: 'left',
                              color: '#525252',
                              borderBottom: '1px solid #f5f5f5'
                            }}
                            onClick={() => { setFormServiceId(''); setFormServiceSearch(''); setShowServiceDropdown(false); }}
                          >
                            — ไม่ได้ระบุบริการ —
                          </button>
                        )}
                        {filteredServices.map(s => {
                          const label = `${s.name || 'บริการ'}${s.customerIdField ? ` • ${s.customerIdField}` : ''}`;
                          const isSelected = formServiceId === s._id;
                          return (
                            <button
                              key={s._id}
                              type="button"
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: isSelected ? '#eff6ff' : '#fff',
                                cursor: 'pointer',
                                fontSize: '13px',
                                textAlign: 'left',
                                color: '#0f172a',
                                borderBottom: '1px solid #f5f5f5'
                              }}
                              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                              onMouseLeave={e => e.target.style.background = isSelected ? '#eff6ff' : '#fff'}
                              onClick={() => { setFormServiceId(s._id); setFormServiceSearch(label); setShowServiceDropdown(false); }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
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

                  <label className="field">
                    <span className="field-label">เวลาที่ตัดเงิน</span>
                    <input
                      type="text"
                      className="field-input"
                      value={formChargeTime}
                      onChange={e => setFormChargeTime(e.target.value)}
                      placeholder="00:00"
                      maxLength="5"
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">หมายเหตุ</span>
                    <input
                      placeholder="รายละเอียดเพิ่มเติม"
                      className="field-input"
                      value={formNote}
                      onChange={e => setFormNote(e.target.value)}
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
