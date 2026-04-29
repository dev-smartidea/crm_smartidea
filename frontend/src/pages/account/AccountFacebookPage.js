import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Search, ChevronDown, ChevronRight,
  CheckCircleFill, Clock, Facebook, X
} from 'react-bootstrap-icons';
import './AccountLedgerPage.css';

const fmt = (n) =>
  (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountFacebookPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchData = useCallback(async (signal) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/ledger?serviceType=Facebook+Ads&limit=200`,
        { headers: { Authorization: `Bearer ${token}` }, signal }
      );
      setItems(res.data.items || []);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error('AccountFacebookPage fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  useEffect(() => { setPage(1); }, [search, dateFilter]);

  const groups = useMemo(() => {
    const src = dateFilter
      ? items.filter(item => item.transactionDate?.slice(0, 10) === dateFilter)
      : items;
    const map = new Map();
    for (const item of src) {
      const key = item.serviceId || `${item.accountName}__${item.customerCode}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          accountName: item.accountName,
          customerCode: item.customerCode,
          customerName: item.customerName,
          transactions: [],
          totalTopup: 0,
          fbCharged: 0,
          pending: 0,
        });
      }
      const g = map.get(key);
      g.transactions.push(item);
      const clickAmt = item.clickCost || 0;
      g.totalTopup += clickAmt;
      if (item.cardCharged) g.fbCharged += clickAmt;
      else g.pending += clickAmt;
    }
    return Array.from(map.values())
      .map(g => ({ ...g, remaining: g.totalTopup - g.fbCharged }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [items, dateFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.accountName?.toLowerCase().includes(q) ||
      g.customerCode?.toLowerCase().includes(q) ||
      g.customerName?.toLowerCase().includes(q)
    );
  }, [groups, search]);

  const total = useMemo(() =>
    filtered.reduce((acc, g) => ({
      topup: acc.topup + g.totalTopup,
      charged: acc.charged + g.fbCharged,
      pending: acc.pending + g.pending,
      remaining: acc.remaining + g.remaining,
    }), { topup: 0, charged: 0, pending: 0, remaining: 0 }),
    [filtered]
  );

  const totalTxCount = useMemo(() =>
    filtered.reduce((sum, g) => sum + g.transactions.length, 0),
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const toggleExpand = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const expandAll = () => setExpanded(new Set(filtered.map(g => g.key)));
  const collapseAll = () => setExpanded(new Set());

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#6c757d', fontSize: 15 }}>
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '2px solid #e9ecef',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Facebook size={20} color="#fff" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, color: '#212529', lineHeight: 1.2 }}>
              บริการ Facebook Ads
            </h4>
            <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>
              ติดตามสถานะการตัดเงินของ Facebook
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-outline-secondary" onClick={expandAll} style={{ fontSize: 12 }}>
            ขยายทั้งหมด
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={collapseAll} style={{ fontSize: 12 }}>
            ย่อทั้งหมด
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid #e9ecef', borderRadius: 8,
          padding: '10px 20px', borderLeft: '4px solid #6c757d',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>จำนวนบริการ</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#343a40', lineHeight: 1.2 }}>{filtered.length}</div>
          </div>
          <div style={{ fontSize: 12, color: '#adb5bd', alignSelf: 'flex-end', marginBottom: 2 }}>บริการ</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff8f0', border: '1px solid #fde8cc', borderRadius: 8,
          padding: '10px 20px', borderLeft: '4px solid #fd7e14',
        }}>
          <Clock size={18} color="#fd7e14" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>รอ FB ตัด</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fd7e14', lineHeight: 1.2 }}>{fmt(total.pending)}</div>
          </div>
          <div style={{ fontSize: 12, color: '#fca96a', alignSelf: 'flex-end', marginBottom: 2 }}>บาท</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        background: '#f8f9fa', border: '1px solid #e9ecef',
        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
      }}>
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ width: 155 }}
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        />
        {dateFilter && (
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setDateFilter('')}
            style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <X size={13} /> ล้างวันที่
          </button>
        )}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={13} style={{
            position: 'absolute', left: 9, top: '50%',
            transform: 'translateY(-50%)', color: '#adb5bd',
          }} />
          <input
            className="form-control form-control-sm"
            style={{ paddingLeft: 28 }}
            placeholder="ค้นหาชื่อบัญชี / รหัสลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setSearch('')}
            style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <X size={13} /> ล้าง
          </button>
        )}
        <span style={{ fontSize: 12, color: '#6c757d', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {filtered.length} บริการ · {totalTxCount} รายการ
          {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e9ecef' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ width: 36, padding: '10px 8px' }}></th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>ชื่อบัญชี / หน้า FB</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>รหัสลูกค้า</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>รายการ</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#495057' }}>ยอดเติมเงิน</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#198754' }}>FB ตัดแล้ว</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#fd7e14' }}>รอ FB ตัด</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#495057' }}>ยอดคงเหลือในบัญชี</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#adb5bd', fontSize: 14 }}>
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
            {paginated.map((g, idx) => (
              <React.Fragment key={g.key}>
                <tr
                  onClick={() => toggleExpand(g.key)}
                  style={{
                    cursor: 'pointer',
                    background: expanded.has(g.key) ? '#eef4ff' : idx % 2 === 0 ? '#fff' : '#fafafa',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <td style={{ textAlign: 'center', padding: '10px 8px', color: '#adb5bd' }}>
                    {expanded.has(g.key) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 600, color: '#1877f2' }}>{g.accountName}</span>
                    {g.customerName && g.customerName !== g.accountName && (
                      <div style={{ fontSize: 11.5, color: '#6c757d', marginTop: 1 }}>{g.customerName}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#495057', fontSize: 13 }}>{g.customerCode}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      background: '#e9ecef', color: '#495057',
                      borderRadius: 10, padding: '2px 9px', fontSize: 12, fontWeight: 500,
                    }}>
                      {g.transactions.length}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#343a40' }}>
                    {fmt(g.totalTopup)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#198754', fontWeight: 600 }}>
                    {g.fbCharged > 0
                      ? <><CheckCircleFill size={10} style={{ marginRight: 3 }} />{fmt(g.fbCharged)}</>
                      : <span style={{ color: '#dee2e6' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fd7e14', fontWeight: 600 }}>
                    {g.pending > 0
                      ? <><Clock size={10} style={{ marginRight: 3 }} />{fmt(g.pending)}</>
                      : <span style={{ color: '#dee2e6' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 14,
                      color: g.remaining > 0 ? '#0d6efd' : g.remaining < 0 ? '#dc3545' : '#adb5bd',
                    }}>
                      {fmt(g.remaining)}
                    </span>
                  </td>
                </tr>

                {expanded.has(g.key) && g.transactions
                  .slice().sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
                  .map(tx => (
                    <tr key={tx._id} style={{
                      background: '#f5f8ff', fontSize: 12.5,
                      borderLeft: '3px solid #1877f2', borderBottom: '1px solid #e8edf8',
                    }}>
                      <td></td>
                      <td colSpan={2} style={{ padding: '8px 12px 8px 24px', color: '#495057' }}>
                        {new Date(tx.transactionDate).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                        {tx.transactionTime && tx.transactionTime !== '-' && (
                          <span style={{ marginLeft: 5, color: '#6c757d' }}>{tx.transactionTime}</span>
                        )}
                        {tx.bank && tx.bank !== '-' && (
                          <span style={{
                            marginLeft: 8, background: '#e9ecef',
                            borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#495057',
                          }}>
                            {tx.bank}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {tx.cardCharged ? (
                          <span style={{ color: '#198754', fontSize: 12 }}>
                            <CheckCircleFill size={10} style={{ marginRight: 3 }} />
                            FB ตัดแล้ว{tx.cardNumber && tx.cardNumber !== '-' ? ` (${tx.cardNumber})` : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#fd7e14', fontSize: 12 }}>
                            <Clock size={10} style={{ marginRight: 3 }} />รอ FB ตัด
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(tx.clickCost)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#198754' }}>
                        {tx.cardCharged ? fmt(tx.clickCost) : <span style={{ color: '#dee2e6' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#fd7e14' }}>
                        {!tx.cardCharged ? fmt(tx.clickCost) : <span style={{ color: '#dee2e6' }}>—</span>}
                      </td>
                      <td></td>
                    </tr>
                  ))
                }
              </React.Fragment>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: '#dbeafe', borderTop: '2px solid #93c5fd', fontWeight: 700 }}>
                <td></td>
                <td colSpan={2} style={{ padding: '10px 12px', color: '#1e40af', fontSize: 13 }}>
                  รวมทั้งหมด ({filtered.length} บริการ)
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1e40af' }}>{totalTxCount}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af' }}>{fmt(total.topup)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#198754' }}>{fmt(total.charged)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fd7e14' }}>{fmt(total.pending)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: total.remaining >= 0 ? '#1e40af' : '#dc3545' }}>
                  {fmt(total.remaining)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 4, marginTop: 16, flexWrap: 'wrap',
        }}>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...'
                ? <span key={`e${idx}`} style={{ padding: '0 4px', color: '#6c757d' }}>…</span>
                : (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setPage(p)}
                    style={{ minWidth: 34 }}
                  >
                    {p}
                  </button>
                )
            )
          }
          <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      )}
    </div>
  );
}
