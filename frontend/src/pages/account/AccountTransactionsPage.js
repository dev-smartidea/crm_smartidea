import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Google, Facebook } from 'react-bootstrap-icons';
import '../shared/DashboardPage.css';

export default function AccountTransactionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchSubmitted = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${api}/api/transactions?submissionStatus=submitted&limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = (res.data.transactions || []).map(tx => ({
        ...tx,
        service: tx.serviceId || {},
        customer: tx.serviceId?.customerId || {}
      }));
      setItems(formatted);
    } catch (e) {
      console.error('Load submitted queue failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (txId) => {
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('อนุมัติรายการสำเร็จ');
      fetchSubmitted(); // รีโหลดรายการ
    } catch (e) {
      alert('อนุมัติไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (txId) => {
    try {
      setProcessingId(txId);
      await axios.put(`${api}/api/transactions/${txId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('ปฏิเสธรายการสำเร็จ');
      fetchSubmitted(); // รีโหลดรายการ
    } catch (e) {
      alert('ปฏิเสธไม่สำเร็จ');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>รายการที่ส่งมาบัญชี</h2>
      {items.length === 0 ? (
        <p>ยังไม่มีรายการที่ส่งมา</p>
      ) : (
        <div className="table-responsive">
          <table className="transaction-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>วันที่โอน</th>
                <th>ลูกค้า</th>
                <th>บริการ</th>
                <th>จำนวนเงิน</th>
                <th>ธนาคาร</th>
                <th>หมายเหตุ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map(tx => (
                <tr key={tx._id}>
                  <td>{new Date(tx.transactionDate).toLocaleDateString('th-TH')}</td>
                  <td>{tx.customer?.name || '-'}</td>
                  <td>
                    {tx.service?.customerIdField && tx.service?.name ? (
                      <span className={`service-badge ${
                        tx.service.name === 'Facebook Ads' ? 'facebook' :
                        tx.service.name === 'Google Ads' ? 'google' :
                        'other'
                      }`}>
                        {tx.service.name === 'Facebook Ads' && <Facebook className="service-icon" />}
                        {tx.service.name === 'Google Ads' && <Google className="service-icon" />}
                        <span className="service-id-text">{tx.service.customerIdField}</span>
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(tx.amount)}</td>
                  <td>{tx.bank}</td>
                  <td>
                    <div style={{ maxWidth: '320px' }}>
                      {tx.notes && (
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: tx.breakdowns && tx.breakdowns.length ? 6 : 0
                        }}>
                          {tx.notes}
                        </div>
                      )}
                      {tx.breakdowns && tx.breakdowns.length > 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                          {tx.breakdowns.map((bd, idx) => (
                            <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{ fontWeight: 600 }}>{bd.code}</span>
                              <span>:</span>
                              <span>{bd.amount?.toLocaleString('th-TH')}</span>
                              <span>บาท</span>
                              {bd.statusNote && <span style={{ opacity: 0.8 }}>— {bd.statusNote}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {!tx.notes && (!tx.breakdowns || tx.breakdowns.length === 0) && '-'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleApprove(tx._id)}
                        disabled={processingId === tx._id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #22c55e',
                          background: '#f0fdf4',
                          color: '#16a34a',
                          cursor: processingId === tx._id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <CheckCircle /> อนุมัติ
                      </button>
                      <button
                        onClick={() => handleReject(tx._id)}
                        disabled={processingId === tx._id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #ef4444',
                          background: '#fef2f2',
                          color: '#dc2626',
                          cursor: processingId === tx._id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <XCircle /> ปฏิเสธ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
