import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from '../../utils/toast';
import {
  Search, ChevronDown, ChevronRight,
  CheckCircleFill, Clock, Google, X, ArrowRepeat, Trash
} from 'react-bootstrap-icons';
import { PencilSquare } from 'react-bootstrap-icons';
import './AccountLedgerPage.css';

const fmt = (n) =>
  (n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountGooglePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cards, setCards] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [expandedLimit, setExpandedLimit] = useState({});
  const EXPAND_DEFAULT = 20;
  const LOAD_MORE_STEP = 20;
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Edit remaining balance state
  const [editingRemainingId, setEditingRemainingId] = useState(null);
  const [editRemainingValue, setEditRemainingValue] = useState('');

  // Transfer modal state
  const [transferModal, setTransferModal] = useState(null); // { serviceId, accountName }
  const [transferSearch, setTransferSearch] = useState('');
  const [transferCustomers, setTransferCustomers] = useState([]);
  const [transferSelected, setTransferSelected] = useState(null);
  const [transferNote, setTransferNote] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  const fetchData = useCallback(async (signal) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/ledger?serviceType=Google+Ads&limit=500`,
        { headers: { Authorization: `Bearer ${token}` }, signal }
      );
      const allItems = res.data.items || [];
      const invoiceOnly = allItems.filter(item => item.invGG && item.invGG > 0);
      setItems(invoiceOnly);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error('AccountGooglePage fetch error:', err);
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
          transferStatus: item.serviceTransferStatus || 'active',
          transactions: [],
          totalTopup: 0,
          googleCharged: 0,
          pending: 0,
          ggBalanceOffset: item.serviceGgBalanceOffset || 0,
        });
      }
      const g = map.get(key);
      g.transactions.push(item);
      const clickAmt = item.clickCost || 0;
      g.totalTopup += clickAmt;
      if (item.cardCharged) g.googleCharged += clickAmt;
      else g.pending += clickAmt;
    }
    return Array.from(map.values())
      .map(g => ({ ...g, remaining: (g.ggBalanceOffset || 0) + g.totalTopup - g.googleCharged }))
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
      charged: acc.charged + g.googleCharged,
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
  const collapseAll = () => { setExpanded(new Set()); setExpandedLimit({}); };

  const openTransferModal = (g, e) => {
    e.stopPropagation();
    setTransferModal({ serviceId: g.key, accountName: g.accountName });
    setTransferSearch('');
    setTransferCustomers([]);
    setTransferSelected(null);
    setTransferNote('');
    setTransferError('');
  };

  const searchTransferCustomers = useCallback(async (q) => {
    if (!q.trim()) { setTransferCustomers([]); return; }
    setTransferSearchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/customers?search=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTransferCustomers(res.data || []);
    } catch { setTransferCustomers([]); }
    finally { setTransferSearchLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchTransferCustomers(transferSearch), 350);
    return () => clearTimeout(t);
  }, [transferSearch, searchTransferCustomers]);

  const handleTransferConfirm = async () => {
    if (!transferSelected) { setTransferError('กรุณาเลือกลูกค้าใหม่'); return; }
    setTransferLoading(true);
    setTransferError('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/services/${transferModal.serviceId}/transfer`,
        { newCustomerId: transferSelected._id, note: transferNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTransferModal(null);
      fetchData(new AbortController().signal);
    } catch (err) {
      setTransferError(err?.response?.data?.error || 'โอนบัญชีไม่สำเร็จ');
    } finally { setTransferLoading(false); }
  };

  // Google: record invoice (Inv.Gg) modal state
  const [ggRecordModal, setGgRecordModal] = useState(null);
  const [ggRecordCardId, setGgRecordCardId] = useState('');
  const [ggRecordDate, setGgRecordDate] = useState('');
  const [ggRecordTime, setGgRecordTime] = useState('');
  const [ggRecordAmount, setGgRecordAmount] = useState('');
  const [ggRecordLoading, setGgRecordLoading] = useState(false);

  const openGgRecordModal = (tx, e) => {
    if (e) e.stopPropagation();
    setGgRecordModal(tx);
    setGgRecordCardId('');
    setGgRecordDate(new Date().toISOString().split('T')[0]);
    setGgRecordTime('');
    const defaultAmount = tx.invGG || (tx.clickCost || 0) + (tx.newCustomerGG || tx.renewGG || 0);
    setGgRecordAmount(String(defaultAmount || 0));
  };

  const handleCancelInvoice = async (tx, e) => {
    if (e) e.stopPropagation();
    const ok = window.confirm(`คุณต้องการยกเลิก Invoice สำหรับรายการนี้ใช่หรือไม่?`);
    if (!ok) return;
    const ok2 = window.confirm(`ยืนยันการยกเลิกอีกครั้ง! คุณแน่ใจใช่หรือไม่ที่จะเปลี่ยนสถานะรายการนี้กลับไปเป็นรอการตัดเงิน?`);
    if (!ok2) return;
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/ledger/${tx._id}`,
        { invGG: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('ยกเลิก Invoice สำเร็จ');
      fetchData(new AbortController().signal);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'ยกเลิกไม่สำเร็จ');
    }
  };

  const handleEditRemainingClick = (e, serviceId, remaining) => {
    e.stopPropagation();
    setEditingRemainingId(serviceId);
    setEditRemainingValue(String(remaining));
  };

  const handleEditRemainingBlur = async (serviceId, totalTopup, googleCharged) => {
    if (!editingRemainingId) return;
    const newRemaining = Number(editRemainingValue);
    if (isNaN(newRemaining)) {
      setEditingRemainingId(null);
      return;
    }

    const newOffset = newRemaining - (totalTopup - googleCharged);

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/services/${serviceId}`,
        { ggBalanceOffset: newOffset },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setItems(prev => prev.map(item => {
        if (item.serviceId === serviceId) {
          return { ...item, serviceGgBalanceOffset: newOffset };
        }
        return item;
      }));
      toast.success('อัพเดตยอดคงเหลือสำเร็จ');
    } catch (err) {
      toast.error('อัพเดตยอดคงเหลือไม่สำเร็จ');
    } finally {
      setEditingRemainingId(null);
    }
  };

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/cards`, { headers: { Authorization: `Bearer ${token}` } });
        setCards((res.data || []).filter(c => c.status === 'active'));
      } catch (err) { setCards([]); }
    };
    fetchCards();
  }, []);

  const getLimit = (key) => expandedLimit[key] || EXPAND_DEFAULT;
  const loadMore = (key) => {
    setExpandedLimit(prev => ({ ...prev, [key]: (prev[key] || EXPAND_DEFAULT) + LOAD_MORE_STEP }));
  };
  const collapseLimit = (key) => {
    setExpandedLimit(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#6c757d', fontSize: 15 }}>
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <>
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
            background: '#DB4437', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Google size={20} color="#fff" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, color: '#212529', lineHeight: 1.2 }}>
              บริการ Google Ads
            </h4>
            <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>
              ติดตามสถานะการตัดเงินของ Google
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
            <div style={{ fontSize: 11, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>รอ Google ตัด</div>
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
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>ชื่อบัญชี / หน้า</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#495057' }}>รหัสลูกค้า</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#495057' }}>รายการ</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#495057' }}>ยอดเติมเงิน</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#198754' }}>Google ตัดแล้ว</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#fd7e14' }}>รอ Google ตัด</th>
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
                    <span style={{ fontWeight: 600, color: '#DB4437' }}>{g.accountName}</span>
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
                    {g.googleCharged > 0
                      ? <><CheckCircleFill size={10} style={{ marginRight: 3 }} />{fmt(g.googleCharged)}</>
                      : <span style={{ color: '#dee2e6' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fd7e14', fontWeight: 600 }}>
                    {g.pending > 0
                      ? <><Clock size={10} style={{ marginRight: 3 }} />{fmt(g.pending)}</>
                      : <span style={{ color: '#dee2e6' }}>—</span>
                    }
                  </td>
                  <td
                    style={{ padding: '10px 12px', textAlign: 'right', cursor: 'pointer' }}
                    onClick={(e) => handleEditRemainingClick(e, g.key, g.remaining)}
                  >
                    {editingRemainingId === g.key ? (
                      <input
                        type="number"
                        style={{ width: '100px', textAlign: 'right', padding: '2px 4px', fontSize: 13, border: '1px solid #DB4437', borderRadius: 4 }}
                        value={editRemainingValue}
                        onChange={(e) => setEditRemainingValue(e.target.value)}
                        onBlur={() => handleEditRemainingBlur(g.key, g.totalTopup, g.googleCharged)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEditRemainingBlur(g.key, g.totalTopup, g.googleCharged);
                          } else if (e.key === 'Escape') {
                            setEditingRemainingId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        step="0.01"
                      />
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: 14,
                        color: g.remaining > 0 ? '#0d6efd' : g.remaining < 0 ? '#dc3545' : '#adb5bd',
                      }}>
                        {fmt(g.remaining)}
                      </span>
                    )}
                    {g.transferStatus !== 'transferred' && (
                      <button
                        onClick={e => openTransferModal(g, e)}
                        title="โอนบัญชีนี้ให้ลูกค้าใหม่"
                        style={{
                          display: 'block', margin: '4px auto 0', padding: '2px 7px',
                          fontSize: 11, fontWeight: 600, borderRadius: 5,
                          background: 'none', border: '1px solid #dee2e6',
                          color: '#6c757d', cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ArrowRepeat size={10} style={{ marginRight: 3 }} />โอนบัญชี
                      </button>
                    )}
                    {g.transferStatus === 'transferred' && (
                      <div style={{ fontSize: 10, color: '#adb5bd', marginTop: 3, textAlign: 'center' }}>
                        ✓ โอนแล้ว
                      </div>
                    )}
                  </td>
                </tr>

                {expanded.has(g.key) && (() => {
                  const sorted = g.transactions.slice().sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
                  const limit = getLimit(g.key);
                  const visible = sorted.slice(0, limit);
                  const remaining = sorted.length - limit;
                  const canLoadMore = remaining > 0;
                  const canCollapse = limit > EXPAND_DEFAULT;
                  return (
                    <>
                      {visible.map(tx => (
                    <tr key={tx._id} style={{
                      background: '#f5f8ff', fontSize: 12.5,
                      borderLeft: '3px solid #DB4437', borderBottom: '1px solid #e8edf8',
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
                            Google ตัดแล้ว{tx.cardNumber && tx.cardNumber !== '-' ? ` (${tx.cardNumber})` : ''}
                          </span>
                        ) : tx.invGG ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <span style={{ background: '#fff8f0', color: '#a63d00', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>Inv.Gg</span>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={(e) => openGgRecordModal(tx, e)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: '#e8f5e9',
                                  border: '1px solid #c8e6c9',
                                  color: '#2e7d32',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s'
                                }}
                                title="บันทึกการตัด"
                              >
                                <PencilSquare size={12} /> บันทึกการตัด
                              </button>
                              <button
                                onClick={(e) => handleCancelInvoice(tx, e)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: '#ffebee',
                                  border: '1px solid #ffcdd2',
                                  color: '#c62828',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s'
                                }}
                                title="ยกเลิก Invoice"
                              >
                                <Trash size={12} /> ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#fd7e14', fontSize: 12 }}>
                            <Clock size={10} style={{ marginRight: 3 }} />รอ Google ตัด
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
                      ))}
                      {(canLoadMore || canCollapse) && (
                        <tr style={{ background: '#eef4ff', borderLeft: '3px solid #DB4437', borderBottom: '1px solid #e8edf8' }}>
                          <td colSpan={8} style={{ padding: '6px 12px', textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center' }}>
                            {canLoadMore && (
                              <button
                                onClick={e => { e.stopPropagation(); loadMore(g.key); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#DB4437', fontSize: 12, fontWeight: 600,
                                }}
                              >
                                ▼ แสดงเพิ่มอีก {Math.min(LOAD_MORE_STEP, remaining)} รายการ ({remaining} คงเหลือ)
                              </button>
                            )}
                            {canCollapse && (
                              <button
                                onClick={e => { e.stopPropagation(); collapseLimit(g.key); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#6c757d', fontSize: 12,
                                }}
                              >
                                ▲ ย่อกลับ
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
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
    
      {/* ══ Modal: Google Ads — บันทึกการตัดสำหรับรายการที่เป็น Inv.Gg ══ */}
      {ggRecordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setGgRecordModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: 480, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#212529' }}><PencilSquare size={15} style={{ marginRight: 8, color: '#DB4437' }} />บันทึกการตัด — Invoice Google</div>
                <div style={{ fontSize: 12, color: '#6c757d' }}>{ggRecordModal.accountName}</div>
              </div>
              <button onClick={() => setGgRecordModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}><X size={20} /></button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>บัตรที่ Google ตัด</label>
                  <select value={ggRecordCardId} onChange={e => setGgRecordCardId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #dee2e6' }}>
                    <option value="">— เลือกบัตร —</option>
                    {cards.map(c => <option key={c._id} value={c._id}>{c.displayName} (ท้าย {c.last4})</option>)}
                  </select>
                </div>
                <div style={{ width: 140 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>วันที่ตัด</label>
                  <input type="date" value={ggRecordDate} onChange={e => setGgRecordDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #dee2e6' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ width: 140 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>เวลาที่ตัด</label>
                  <input type="text" placeholder="08:00" maxLength={5} value={ggRecordTime} onChange={e => setGgRecordTime(e.target.value.replace(/\./g, ':').replace(/[^0-9:]/g, ''))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #dee2e6' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>ยอด Invoice</label>
                  <input
                    type="number"
                    value={ggRecordAmount}
                    onChange={e => setGgRecordAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #dee2e6' }}
                    step="0.01"
                  />
                </div>
              </div>
              {/* คำนวณยอดเงินคงเหลือในบัญชี */}
              {(() => {
                const groupKey = ggRecordModal.serviceId || `${ggRecordModal.accountName}__${ggRecordModal.customerCode}`;
                const g = groups.find(group => group.key === groupKey);
                if (!g) return null;
                const currentRemaining = g.remaining;
                const enteredAmount = Number(ggRecordAmount) || 0;
                const newRemaining = currentRemaining - enteredAmount;
                return (
                  <div style={{ marginTop: 4, marginBottom: 12, padding: '10px', borderRadius: 8, background: '#f8f9fa', border: '1px solid #e9ecef', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#6c757d' }}>ยอดคงเหลือเดิมในบัญชี:</span>
                      <span style={{ fontWeight: 600 }}>{fmt(currentRemaining)} บาท</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6c757d' }}>ยอดคงเหลือใหม่หลังบันทึก:</span>
                      <span style={{ fontWeight: 700, color: newRemaining >= 0 ? '#198754' : '#dc3545' }}>
                        {fmt(newRemaining)} บาท
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setGgRecordModal(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #dee2e6', background: '#fff' }}>ยกเลิก</button>
              <button onClick={async () => {
                if (!ggRecordCardId || !ggRecordDate || !ggRecordTime || !ggRecordAmount) { toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }
                try {
                  setGgRecordLoading(true);
                  const token = localStorage.getItem('token');
                  const selectedCard = cards.find(c => c._id === ggRecordCardId);
                  const amount = Number(ggRecordAmount);
                  // 1. ตัดยอดบัตรจริง (ส่ง reference เพื่อเชื่อมโยง)
                  await axios.post(`${process.env.REACT_APP_API_URL}/api/cards/charge`, {
                    cardId: ggRecordCardId,
                    amount,
                    channel: 'Google Ads',
                    note: `Invoice Google ตัดเงิน: ${ggRecordModal.accountName}`,
                    serviceId: ggRecordModal.serviceId,
                    reference: ggRecordModal._id
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  // 2. บันทึก cardCharged บน Transaction พร้อมอัปเดตยอด invGG ให้ตรงกัน
                  await axios.patch(`${process.env.REACT_APP_API_URL}/api/ledger/${ggRecordModal._id}`, {
                    cardCharged: true,
                    cardNumber: selectedCard?.last4 || '',
                    cardTime: ggRecordTime,
                    cardDate: ggRecordDate,
                    invGG: amount
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  toast.success('บันทึกการตัดของ Google สำเร็จ');
                  setGgRecordModal(null);
                  fetchData(new AbortController().signal);
                } catch (err) {
                  toast.error(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
                } finally { setGgRecordLoading(false); }
              }} style={{ padding: '8px 16px', borderRadius: 6, background: '#DB4437', color: '#fff', border: 'none' }} disabled={ggRecordLoading}>{ggRecordLoading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div
          onClick={() => setTransferModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: 28,
              width: 480, maxWidth: '95vw', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#212529' }}>
                  <ArrowRepeat size={15} style={{ marginRight: 6, color: '#DB4437' }} />
                  โอนบัญชี Google Ads
                </div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 3 }}>
                  {transferModal.accountName}
                </div>
              </div>
              <button onClick={() => setTransferModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6c757d' }}>
                <X size={20} />
              </button>
            </div>

            {/* Search customer */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>
                ค้นหาลูกค้าใหม่
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#adb5bd' }} />
                <input
                  autoFocus
                  value={transferSearch}
                  onChange={e => { setTransferSearch(e.target.value); setTransferSelected(null); }}
                  placeholder="ชื่อหรือรหัสลูกค้า..."
                  style={{
                    width: '100%', padding: '8px 12px 8px 32px', fontSize: 13,
                    border: '1px solid #dee2e6', borderRadius: 7, outline: 'none',
                  }}
                />
              </div>
              {/* Results */}
              {transferSearchLoading && (
                <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, color: '#6c757d' }}>กำลังค้นหา...</div>
              )}
              {!transferSearchLoading && transferCustomers.length > 0 && (
                <div style={{
                  border: '1px solid #dee2e6', borderRadius: 7, marginTop: 6,
                  maxHeight: 220, overflowY: 'auto',
                }}>
                  {transferCustomers.map(c => (
                    <div
                      key={c._id}
                      onClick={() => setTransferSelected(c)}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                        background: transferSelected?._id === c._id ? '#eef4ff' : '#fff',
                        borderBottom: '1px solid #f0f0f0',
                        borderLeft: transferSelected?._id === c._id ? '3px solid #DB4437' : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#212529' }}>{c.name}</span>
                      <span style={{ color: '#6c757d', fontSize: 11.5, marginLeft: 8 }}>{c.customerCode}</span>
                    </div>
                  ))}
                </div>
              )}
              {!transferSearchLoading && transferSearch.trim() && transferCustomers.length === 0 && (
                <div style={{ padding: '10px 0', fontSize: 12, color: '#adb5bd', textAlign: 'center' }}>ไม่พบลูกค้า</div>
              )}
            </div>

            {/* Selected */}
            {transferSelected && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '10px 14px', fontSize: 13 }}>
                เลือก: <strong>{transferSelected.name}</strong>
                <span style={{ color: '#6c757d', marginLeft: 8 }}>({transferSelected.customerCode})</span>
              </div>
            )}

            {/* Note */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#495057', display: 'block', marginBottom: 6 }}>
                หมายเหตุ <span style={{ fontWeight: 400, color: '#adb5bd' }}>(optional)</span>
              </label>
              <input
                value={transferNote}
                onChange={e => setTransferNote(e.target.value)}
                placeholder="เช่น เปลี่ยนเจ้าของเดือน ..."
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13,
                  border: '1px solid #dee2e6', borderRadius: 7, outline: 'none',
                }}
              />
            </div>

            {transferError && (
              <div style={{ color: '#dc3545', fontSize: 13 }}>{transferError}</div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setTransferModal(null)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #dee2e6', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleTransferConfirm}
                disabled={transferLoading || !transferSelected}
                style={{
                  padding: '8px 22px', borderRadius: 7, border: 'none',
                  background: transferSelected ? '#DB4437' : '#dee2e6',
                  color: '#fff', fontWeight: 600, fontSize: 13, cursor: transferSelected ? 'pointer' : 'not-allowed',
                }}
              >
                {transferLoading ? 'กำลังโอน...' : 'ยืนยันโอนบัญชี'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
