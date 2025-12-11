import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CreditCard2BackFill, Google, Facebook, DashCircle, PlusCircle } from 'react-bootstrap-icons';

const channelBadge = {
  'Google Ads': { background: '#e8f0fe', color: '#1a73e8', icon: <Google style={{ marginRight: 6 }} /> },
  'Facebook Ads': { background: '#e8f1ff', color: '#1877f2', icon: <Facebook style={{ marginRight: 6 }} /> }
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
  const api = process.env.REACT_APP_API_URL;

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

  useEffect(() => {
    fetchCards();
  }, []);

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
      await fetchCards();
      setActionCard(null);
      setFormAmount('');
      setFormReference('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="all-transaction-page">
      <div className="transaction-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <CreditCard2BackFill />
              </div>
              <div>
                <h1>บัตร</h1>
                <p className="subtitle">รายการบัตรที่ใช้ตัดเงินและแพลตฟอร์มที่ผูกไว้</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
          {loading ? (
            <div>กำลังโหลด...</div>
          ) : (
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {cards.map(card => (
                <div key={card._id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: '16px',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: '#f0f4ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                      color: '#1a237e',
                      fontWeight: 700
                    }}>
                      {card.last4}
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{card.displayName || `บัตรลงท้าย ${card.last4}`}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>สถานะ: {card.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}</div>
                      <div style={{ color: '#111827', fontWeight: 700 }}>ยอดคงเหลือ: {card.balance?.toLocaleString()} ฿</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {card.channels?.length > 0 ? card.channels.map(ch => (
                      <span key={ch} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        background: channelBadge[ch]?.background || '#f3f4f6',
                        color: channelBadge[ch]?.color || '#6b7280'
                      }}>
                        {channelBadge[ch]?.icon}
                        {ch}
                      </span>
                    )) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        background: '#f3f4f6',
                        color: '#6b7280'
                      }}>
                        ไม่ได้ระบุแพลตฟอร์ม
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-action-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => openAction(card._id, 'topup')}>
                      <PlusCircle /> เติมเงิน
                    </button>
                    <button className="btn-action-delete" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecdd3' }} onClick={() => openAction(card._id, 'charge')}>
                      <DashCircle /> ตัดยอด
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {actionCard && (
            <div className="modal-backdrop" onClick={() => setActionCard(null)} style={{ zIndex: 9999 }}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header" style={{ justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0 }}>
                    {actionCard.type === 'topup' ? 'เติมเงินเข้าบัตร' : 'ตัดยอดจากบัตร'}
                  </h3>
                  <button onClick={() => setActionCard(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>จำนวนเงิน (บาท)</span>
                    <input
                      type="number"
                      min="0"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                    />
                  </label>

                  {actionCard.type === 'charge' && (
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ color: '#374151', fontWeight: 600 }}>ช่องทาง</span>
                        <select
                          value={formChannel}
                          onChange={e => setFormChannel(e.target.value)}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                        >
                          <option>Google Ads</option>
                          <option>Facebook Ads</option>
                          <option>Other</option>
                        </select>
                      </label>

                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ color: '#374151', fontWeight: 600 }}>อ้างอิง (เช่น Campaign/Billing)</span>
                        <input
                          value={formReference}
                          onChange={e => setFormReference(e.target.value)}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                        />
                      </label>
                    </>
                  )}

                  {error && <div style={{ color: 'red', fontWeight: 600 }}>{error}</div>}
                </div>

                <div className="modal-footer">
                  <button
                    className="btn-action-upload"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}
                    disabled={submitting}
                    onClick={submitAction}
                  >
                    {actionCard.type === 'topup' ? <PlusCircle /> : <DashCircle />} {actionCard.type === 'topup' ? 'ยืนยันเติมเงิน' : 'ยืนยันตัดยอด'}
                  </button>
                  <button
                    className="btn-action-delete"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setActionCard(null)}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
