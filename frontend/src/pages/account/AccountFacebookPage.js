import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Search, ChevronDown, ChevronRight,
  CheckCircleFill, Clock, CashStack, CalendarDate
} from 'react-bootstrap-icons';
import './AccountLedgerPage.css';

const fmt = (n) =>
  (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryCard({ label, value, unit, color }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e9ecef',
      borderRadius: 8,
      padding: '12px 18px',
      minWidth: 150,
      flex: '1 1 150px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#adb5bd' }}>{unit}</div>
    </div>
  );
}

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

  // จัดกลุ่มตาม serviceId
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
      if (item.cardCharged) {
        g.fbCharged += clickAmt;
      } else {
        g.pending += clickAmt;
      }
    }
    return Array.from(map.values())
      .map(g => ({ ...g, remaining: g.totalTopup - g.fbCharged }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [items, dateFilter]);

  // ค้นหา
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.accountName?.toLowerCase().includes(q) ||
      g.customerCode?.toLowerCase().includes(q) ||
      g.customerName?.toLowerCase().includes(q)
    );
  }, [groups, search]);

  // ยอดรวม
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
      <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="ledger-page" style={{ padding: '20px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CashStack size={22} color="#1877f2" />
          บริการ Facebook Ads
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={expandAll}
            style={{ fontSize: 12 }}
          >
            ขยายทั้งหมด
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={collapseAll}
            style={{ fontSize: 12 }}
          >
            ย่อทั้งหมด
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard
          label="จำนวนบริการ"
          value={filtered.length}
          unit="บริการ"
          color="#6c757d"
        />
        <SummaryCard
          label="ยอดเติมเงินรวม"
          value={fmt(total.topup)}
          unit="บาท"
          color="#0d6efd"
        />
        <SummaryCard
          label="FB ตัดแล้ว"
          value={fmt(total.charged)}
          unit="บาท"
          color="#198754"
        />
        <SummaryCard
          label="รอ FB ตัด"
          value={fmt(total.pending)}
          unit="บาท"
          color="#fd7e14"
        />
        <SummaryCard
          label="คงเหลือ"
          value={fmt(total.remaining)}
          unit="บาท"
          color={total.remaining >= 0 ? '#0d6efd' : '#dc3545'}
        />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Date filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarDate size={14} color="#6c757d" />
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 160 }}
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setDateFilter('')}
            >
              ล้างวันที่
            </button>
          )}
        </div>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
          />
          <input
            className="form-control form-control-sm"
            style={{ paddingLeft: 32 }}
            placeholder="ค้นหาชื่อบัญชี / รหัสลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setSearch('')}
          >
            ล้าง
          </button>
        )}
        <span style={{ fontSize: 13, color: '#6c757d', marginLeft: 'auto' }}>
          {filtered.length} บริการ / {totalTxCount} รายการ
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          className="ledger-table"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        >
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>ชื่อบัญชี / หน้า FB</th>
              <th>รหัสลูกค้า</th>
              <th style={{ textAlign: 'center' }}>รายการ</th>
              <th style={{ textAlign: 'right' }}>ยอดเติมเงิน</th>
              <th style={{ textAlign: 'right' }}>FB ตัดแล้ว</th>
              <th style={{ textAlign: 'right' }}>รอ FB ตัด</th>
              <th style={{ textAlign: 'right' }}>คงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
            {paginated.map(g => (
              <React.Fragment key={g.key}>
                {/* แถวกลุ่มบริการ */}
                <tr
                  onClick={() => toggleExpand(g.key)}
                  style={{
                    cursor: 'pointer',
                    background: expanded.has(g.key) ? '#f0f7ff' : undefined,
                  }}
                >
                  <td style={{ textAlign: 'center', color: '#6c757d' }}>
                    {expanded.has(g.key)
                      ? <ChevronDown size={13} />
                      : <ChevronRight size={13} />
                    }
                  </td>
                  <td>
                    <strong style={{ color: '#1877f2' }}>{g.accountName}</strong>
                    {g.customerName && g.customerName !== g.accountName && (
                      <div style={{ fontSize: 12, color: '#6c757d' }}>{g.customerName}</div>
                    )}
                  </td>
                  <td style={{ color: '#495057' }}>{g.customerCode}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      background: '#e9ecef', borderRadius: 10,
                      padding: '1px 8px', fontSize: 12
                    }}>
                      {g.transactions.length}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {fmt(g.totalTopup)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#198754', fontWeight: 600 }}>
                    {g.fbCharged > 0 ? (
                      <><CheckCircleFill size={11} style={{ marginRight: 3 }} />{fmt(g.fbCharged)}</>
                    ) : (
                      <span style={{ color: '#adb5bd' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: '#fd7e14', fontWeight: 600 }}>
                    {g.pending > 0 ? (
                      <><Clock size={11} style={{ marginRight: 3 }} />{fmt(g.pending)}</>
                    ) : (
                      <span style={{ color: '#adb5bd' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: g.remaining > 0
                        ? '#0d6efd'
                        : g.remaining < 0
                          ? '#dc3545'
                          : '#6c757d',
                    }}>
                      {fmt(g.remaining)}
                    </span>
                  </td>
                </tr>

                {/* แถวรายการ transaction แต่ละรายการ */}
                {expanded.has(g.key) && g.transactions
                  .slice()
                  .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
                  .map(tx => (
                    <tr
                      key={tx._id}
                      style={{ background: '#f8faff', fontSize: 13, borderLeft: '3px solid #1877f2' }}
                    >
                      <td></td>
                      <td colSpan={2} style={{ paddingLeft: 24, color: '#495057' }}>
                        {new Date(tx.transactionDate).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                        {tx.transactionTime && tx.transactionTime !== '-'
                          ? ` ${tx.transactionTime}`
                          : ''}
                        {tx.bank && tx.bank !== '-' && (
                          <span style={{
                            marginLeft: 8, background: '#e9ecef',
                            borderRadius: 4, padding: '1px 6px', fontSize: 11
                          }}>
                            {tx.bank}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {tx.cardCharged ? (
                          <span style={{ color: '#198754', fontSize: 12 }}>
                            <CheckCircleFill size={10} style={{ marginRight: 3 }} />
                            FB ตัดแล้ว
                            {tx.cardNumber && tx.cardNumber !== '-'
                              ? ` (${tx.cardNumber})`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#fd7e14', fontSize: 12 }}>
                            <Clock size={10} style={{ marginRight: 3 }} />
                            รอ FB ตัด
                          </span>
                        )}
                      </td>
                      {/* ยอดเติมเงิน (เฉพาะค่าคลิก code 11) */}
                      <td style={{ textAlign: 'right' }}>{fmt(tx.clickCost)}</td>
                      {/* FB ตัดแล้ว */}
                      <td style={{ textAlign: 'right', color: '#198754' }}>
                        {tx.cardCharged
                          ? fmt(tx.clickCost)
                          : <span style={{ color: '#adb5bd' }}>-</span>
                        }
                      </td>
                      {/* รอ FB ตัด */}
                      <td style={{ textAlign: 'right', color: '#fd7e14' }}>
                        {!tx.cardCharged
                          ? fmt(tx.clickCost)
                          : <span style={{ color: '#adb5bd' }}>-</span>
                        }
                      </td>
                      <td></td>
                    </tr>
                  ))
                }
              </React.Fragment>
            ))}
          </tbody>

          {/* แถวสรุปรวม */}
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: '#dbeafe', fontWeight: 700 }}>
                <td></td>
                <td colSpan={2}>รวมทั้งหมด ({filtered.length} บริการ){totalPages > 1 ? ` — หน้า ${page}/${totalPages}` : ''}</td>
                <td style={{ textAlign: 'center' }}>{totalTxCount}</td>
                <td style={{ textAlign: 'right' }}>{fmt(total.topup)}</td>
                <td style={{ textAlign: 'right', color: '#198754' }}>{fmt(total.charged)}</td>
                <td style={{ textAlign: 'right', color: '#fd7e14' }}>{fmt(total.pending)}</td>
                <td style={{ textAlign: 'right', color: total.remaining >= 0 ? '#0d6efd' : '#dc3545' }}>
                  {fmt(total.remaining)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ ก่อนหน้า</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...' ? (
                <span key={`e${idx}`} style={{ padding: '0 4px', color: '#6c757d' }}>…</span>
              ) : (
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
          <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป ›</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
          <span style={{ fontSize: 12, color: '#6c757d', marginLeft: 8 }}>หน้า {page}/{totalPages}</span>
        </div>
      )}
    </div>
  );
}
