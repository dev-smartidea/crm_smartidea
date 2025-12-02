import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircleFill, Google, Facebook } from 'react-bootstrap-icons';
import '../shared/DashboardPage.css';

export default function ApprovedTransactionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchApproved = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/transactions?submissionStatus=approved&limit=200`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const formatted = (res.data.transactions || []).map(tx => ({
          ...tx,
          service: tx.serviceId || {},
          customer: tx.serviceId?.customerId || {}
        }));
        setItems(formatted);
      } catch (e) {
        console.error('Load approved transactions failed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchApproved();
  }, [api, token]);

  if (loading) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <CheckCircleFill size={24} color="#22c55e" />
        <h2 style={{ margin: 0 }}>รายการที่อนุมัติแล้ว</h2>
      </div>
      {items.length === 0 ? (
        <p>ยังไม่มีรายการที่อนุมัติ</p>
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
                <th>สถานะ</th>
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
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: '#f0fdf4',
                      color: '#16a34a',
                      border: '1px solid #22c55e',
                      fontSize: '0.875rem'
                    }}>
                      อนุมัติแล้ว
                    </span>
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
