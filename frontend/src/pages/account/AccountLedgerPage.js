import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from '../../utils/toast';
import { 
  FileEarmarkSpreadsheet, Search, Download, 
  ChevronLeft, ChevronRight, Funnel, X, CreditCard2Back, CheckCircleFill
} from 'react-bootstrap-icons';
import './AccountLedgerPage.css';

const BANK_OPTIONS = ['KBANK', 'SCB', 'BBL', 'BAY-4396', 'BAY-7146', 'Cr.-8508', 'BBL-ส่วนตัว'];
const SERVICE_TYPES = ['Google Ads', 'Facebook Ads'];

// Helper: get sum by breakdown code
// Helper: ลูกค้าใหม่ = รายการแรกของบริการนั้น, ต่ออายุ = รายการที่ไม่ใช่รายการแรก
// Pre-compute first transaction map to avoid O(n²) per-cell scans
const buildFirstTxMap = (allItems) => {
  const map = new Map();
  for (const item of allItems) {
    const key = `${item.serviceType}-${item.customerCode}`;
    const existing = map.get(key);
    if (!existing || new Date(item.transactionDate) < new Date(existing.transactionDate)) {
      map.set(key, item);
    }
  }
  return map;
};

const getFirstTransactionAmount = (item, code, firstTxMap) => {
  if (!item.breakdowns || !Array.isArray(item.breakdowns)) return 0;
  const key = `${item.serviceType}-${item.customerCode}`;
  const firstTx = firstTxMap.get(key);
  if (firstTx && firstTx._id === item._id) {
    return item.breakdowns.filter(bd => String(bd.code) === String(code)).reduce((sum, bd) => sum + (parseFloat(bd.amount) || 0), 0);
  }
  return 0;
};

const getRenewTransactionAmount = (item, code, firstTxMap) => {
  if (!item.breakdowns || !Array.isArray(item.breakdowns)) return 0;
  const key = `${item.serviceType}-${item.customerCode}`;
  const firstTx = firstTxMap.get(key);
  if (firstTx && firstTx._id !== item._id) {
    return item.breakdowns.filter(bd => String(bd.code) === String(code)).reduce((sum, bd) => sum + (parseFloat(bd.amount) || 0), 0);
  }
  return 0;
};
const getBreakdownAmount = (item, code) => {
  if (!item.breakdowns || !Array.isArray(item.breakdowns)) return 0;
  return item.breakdowns
    .filter(bd => String(bd.code) === String(code))
    .reduce((sum, bd) => sum + (parseFloat(bd.amount) || 0), 0);
};

export default function AccountLedgerPage() {
  const [ledgerData, setLedgerData] = useState([]);
  const firstTxMap = useMemo(() => buildFirstTxMap(ledgerData), [ledgerData]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    bank: '',
    serviceType: '',
    search: ''
  });

  // Inline editing
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');

  // Card charging
  const [cards, setCards] = useState([]);
  const [chargingId, setChargingId] = useState(null);
  const [chargeModal, setChargeModal] = useState(null); // item to charge
  const [chargeCardId, setChargeCardId] = useState('');
  const [chargeTime, setChargeTime] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNote, setChargeNote] = useState('');
  const [chargeHistory, setChargeHistory] = useState(null);

  const pageSummary = useMemo(() => {
    const hasActiveFilters = filters.startDate || filters.endDate || filters.bank || filters.serviceType || filters.search;
    if (!ledgerData.length || !hasActiveFilters) return null;
    return ledgerData.reduce((acc, item) => ({
      amount:     acc.amount     + (item.amount || 0),
      newGG:      acc.newGG      + getFirstTransactionAmount(item, 14, firstTxMap),
      renewGG:    acc.renewGG    + getRenewTransactionAmount(item, 14, firstTxMap),
      newFB:      acc.newFB      + getFirstTransactionAmount(item, 18, firstTxMap),
      renewFB:    acc.renewFB    + getRenewTransactionAmount(item, 18, firstTxMap),
      hosting:    acc.hosting    + getBreakdownAmount(item, 20),
      click:      acc.click      + getBreakdownAmount(item, 11),
      vat36:      acc.vat36      + getBreakdownAmount(item, 12),
      vat30:      acc.vat30      + getBreakdownAmount(item, 13) + getBreakdownAmount(item, 17) + getBreakdownAmount(item, 19),
    }), { amount: 0, newGG: 0, renewGG: 0, newFB: 0, renewFB: 0, hosting: 0, click: 0, vat36: 0, vat30: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerData, firstTxMap, filters.startDate, filters.endDate, filters.bank, filters.serviceType, filters.search]);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchLedger = useCallback(async (page = 1, signal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '50');
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.bank) params.append('bank', filters.bank);
      if (filters.serviceType) params.append('serviceType', filters.serviceType);
      if (filters.search) params.append('search', filters.search);

      const res = await axios.get(`${api}/api/ledger?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {})
      });

      setLedgerData(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.page || 1);
    } catch (err) {
      if (axios.isCancel(err)) return;
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [api, token, filters]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLedger(1, controller.signal);
    return () => controller.abort();
  }, [fetchLedger]);

  // โหลดประวัติการตัดเงินเมื่อเปิด modal
  useEffect(() => {
    if (!chargeModal) {
      setChargeHistory(null);
      return;
    }
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${api}/api/cards/charge-history/${chargeModal._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChargeHistory(res.data);
      } catch (err) {
        setChargeHistory(null);
      }
    };
    fetchHistory();
  }, [chargeModal, api, token]);

  // โหลดรายการบัตร
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await axios.get(`${api}/api/cards`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCards((res.data || []).filter(c => c.status === 'active'));
      } catch (err) {
        // cards fetch failed silently
      }
    };
    fetchCards();
  }, [api, token]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLedger(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.bank) params.append('bank', filters.bank);
      if (filters.serviceType) params.append('serviceType', filters.serviceType);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString();

      const res = await axios.get(`${api}/api/ledger/export${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('ส่งออกไฟล์ไม่สำเร็จ');
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      bank: '',
      serviceType: '',
      search: ''
    });
  };

  // ฟังก์ชันสำหรับ inline editing
  const handleCellClick = (id, field, currentValue) => {
    setEditingCell({ id, field });
    setEditValue(currentValue === '-' ? '' : currentValue || '');
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;
    
    try {
      await axios.patch(
        `${api}/api/ledger/${editingCell.id}`,
        { [editingCell.field]: editValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // อัพเดต local state
      const numericFields = ['prepaid', 'coupon', 'invGG', 'invFB'];
      const newValue = numericFields.includes(editingCell.field)
        ? (editValue === '' ? null : Number(editValue))
        : (editValue || '-');
      setLedgerData(prev => prev.map(item => 
        item._id === editingCell.id 
          ? { ...item, [editingCell.field]: newValue }
          : item
      ));
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ');
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  // ตัดเงินจากบัตร
  const handleChargeConfirm = () => {
    if (!chargeCardId) {
      toast.warning('กรุณาเลือกบัตร');
      return;
    }
    if (!chargeTime) {
      toast.warning('กรุณาระบุเวลาที่ตัดเงิน');
      return;
    }
    const numAmount = Number(chargeAmount);
    if (!numAmount || numAmount <= 0) {
      toast.warning('กรุณาระบุจำนวนเงินที่ต้องการตัด');
      return;
    }
    const selectedCard = cards.find(c => c._id === chargeCardId);
    const cardName = selectedCard ? `${selectedCard.displayName} (${selectedCard.last4})` : '';
    const ok = window.confirm(
      `ยืนยันตัดเงินจากบัตร?\n\n` +
      `บัญชี: ${chargeModal.accountName}\n` +
      `บริการ: ${chargeModal.serviceType || '-'}\n` +
      `จำนวนเงิน: ${formatNumber(numAmount)} บาท\n` +
      `บัตร: ${cardName}\n` +
      `เวลาตัด: ${chargeTime}`
    );
    if (ok) handleCharge();
  };

  const handleCharge = async () => {
    const item = chargeModal;
    if (!item) return;
    try {
      setChargingId(item._id);
      await axios.post(`${api}/api/cards/charge`, {
        cardId: chargeCardId,
        amount: Number(chargeAmount),
        channel: item.serviceType || 'Other',
        reference: item._id,
        note: chargeNote || `ตัดเงินจาก Ledger: ${item.accountName}`,
        chargeTime: chargeTime,
        serviceId: item.serviceId,
        breakdowns: item.breakdowns || []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ตัดเงินจากบัตรสำเร็จ');
      setChargeModal(null);
      setChargeCardId('');
      setChargeTime('');
      setChargeAmount('');
      setChargeNote('');
      fetchLedger(currentPage);
    } catch (err) {
      const msg = err?.response?.data?.error || 'ตัดเงินไม่สำเร็จ';
      toast.error(msg);
    } finally {
      setChargingId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === 0) return '-';
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'none': { label: 'รอดำเนินการ', class: 'status-none' },
      'submitted': { label: 'ส่งแล้ว', class: 'status-submitted' },
      'approved': { label: 'อนุมัติ', class: 'status-approved' },
      'rejected': { label: 'ปฏิเสธ', class: 'status-rejected' },
      'completed': { label: 'เสร็จสิ้น', class: 'status-completed' }
    };
    const s = statusMap[status] || statusMap['none'];
    return <span className={`status-badge ${s.class}`}>{s.label}</span>;
  };

  // Quick date filters
  const setQuickDateFilter = (type) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (type) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        startDate = last7.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 29);
        startDate = last30.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      default:
        break;
    }

    setFilters({ ...filters, startDate, endDate });
  };

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="ledger-header">
        <div className="ledger-header-title">
          <FileEarmarkSpreadsheet className="ledger-icon" />
          <div>
            <h2>ยอดเดินบัญชี</h2>
            <p className="ledger-subtitle">รายงานการเงินและธุรกรรมทั้งหมด</p>
          </div>
        </div>
        <div className="ledger-header-actions">
          <button className="btn-filter" onClick={() => setShowFilters(!showFilters)}>
            <Funnel /> ตัวกรอง
          </button>
          <button className="btn-export" onClick={handleExport} aria-label="ส่งออกไฟล์ CSV">
            <Download /> ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="ledger-filters">
          {/* Quick Date Filters */}
          <div className="quick-date-filters">
            <label className="quick-filter-label">ช่วงเวลา:</label>
            <div className="quick-filter-buttons">
              <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('today')}>
                วันนี้
              </button>
              <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('yesterday')}>
                เมื่อวาน
              </button>
              <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('last7days')}>
                7 วันล่าสุด
              </button>
              <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('last30days')}>
                30 วันล่าสุด
              </button>
              <button type="button" className="btn-quick-filter" onClick={() => setQuickDateFilter('thisMonth')}>
                เดือนนี้
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="filters-form">
            <div className="filter-row">
              <div className="filter-group">
                <label>วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>ธนาคาร</label>
                <select
                  value={filters.bank}
                  onChange={(e) => setFilters({ ...filters, bank: e.target.value })}
                >
                  <option value="">ทั้งหมด</option>
                  {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>ประเภทบริการ</label>
                <select
                  value={filters.serviceType}
                  onChange={(e) => setFilters({ ...filters, serviceType: e.target.value })}
                >
                  <option value="">ทั้งหมด</option>
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>ค้นหา</label>
                <input
                  type="text"
                  placeholder="ชื่อลูกค้า, URL..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn-clear" onClick={clearFilters}>
                <X /> ล้างตัวกรอง
              </button>
              <button type="submit" className="btn-search">
                <Search /> ค้นหา
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="ledger-table-container">
        {loading ? (
          <div className="ledger-loading">กำลังโหลดข้อมูล...</div>
        ) : ledgerData.length === 0 ? (
          <div className="ledger-empty">
            <FileEarmarkSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontWeight: '600', marginBottom: '4px' }}>ไม่พบข้อมูล</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-placeholder)' }}>
              {(filters.startDate || filters.endDate || filters.bank || filters.serviceType || filters.search) ? 'ลองเปลี่ยนเงื่อนไขการค้นหา หรือล้างตัวกรอง' : 'ยังไม่มีรายการยอดเดินบัญชี'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th className="col-index" scope="col">#</th>
                  <th className="col-txid" scope="col">Transaction ID</th>
                  <th className="col-account" scope="col">บัญชี</th>
                  <th className="col-service" scope="col">บริการ</th>
                  <th className="col-code" scope="col">รหัส cid</th>
                  <th className="col-bank" scope="col">ธนาคาร</th>
                  <th className="col-date" scope="col">วันที่โอน</th>
                  <th className="col-time" scope="col">เวลาโอน</th>
                  <th className="col-amount" scope="col">ยอดเงินที่โอน</th>
                  <th className="col-status" scope="col">status</th>
                  <th className="col-card" scope="col">บัตรเลขที่</th>
                  <th className="col-cardtime" scope="col">เวลาที่ตัดบัตร</th>
                  <th className="col-gg" scope="col">ลูกค้าใหม่ GG</th>
                  <th className="col-gg" scope="col">ต่ออายุ GG</th>
                  <th className="col-fb" scope="col">ลูกค้าใหม่ FB</th>
                  <th className="col-fb" scope="col">ต่ออายุ FB</th>
                  <th className="col-hosting" scope="col">Hosting Domain</th>
                  <th className="col-click" scope="col">ค่าคลิก</th>
                  <th className="col-prepaid" scope="col">สำรอง</th>
                  <th className="col-coupon" scope="col">คูปอง</th>
                  <th className="col-inv" scope="col">Inv. Gg</th>
                  <th className="col-inv" scope="col">Inv. Fb</th>
                  <th className="col-vat" scope="col">Vat 36</th>
                  <th className="col-vat" scope="col">Vat 30</th>
                  <th className="col-charge" scope="col">ตัดเงิน</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.map((item) => (
                  <tr key={item._id} data-service={item.serviceType}>
                    <td className="col-index">{item.index}</td>
                    <td className="col-txid">{item._id}</td>
                    <td className="col-account" title={item.accountName}>{item.accountName}</td>
                    <td className="col-service">
                      {item.serviceType === 'Google Ads' && <span className="service-tag google">Google</span>}
                      {item.serviceType === 'Facebook Ads' && <span className="service-tag facebook">Facebook</span>}
                      {item.serviceType !== 'Google Ads' && item.serviceType !== 'Facebook Ads' && <span className="service-tag">{item.serviceType || '-'}</span>}
                    </td>
                    <td className="col-code">{item.customerCode}</td>
                    <td className="col-bank">{item.bank}</td>
                    <td className="col-date">{formatDate(item.transactionDate)}</td>
                    <td className="col-time">{item.transactionTime}</td>
                    <td className="col-amount">{formatNumber(item.amount)}</td>
                    <td className="col-status">{getStatusBadge(item.status)}</td>
                    <td className="col-card editable-cell" onClick={() => handleCellClick(item._id, 'cardNumber', item.cardNumber)}>
                      {editingCell?.id === item._id && editingCell?.field === 'cardNumber' ? (
                        <input type="text" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{item.cardNumber}</span>
                      )}
                    </td>
                    <td className="col-cardtime editable-cell" onClick={() => handleCellClick(item._id, 'cardTime', item.cardTime)}>
                      {editingCell?.id === item._id && editingCell?.field === 'cardTime' ? (
                        <input type="text" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus maxLength={5} placeholder="00:00" />
                      ) : (
                        <span className="editable-text">{item.cardTime}</span>
                      )}
                    </td>
                    {/* ลูกค้าใหม่ GG */}
                    <td className="col-gg">{formatNumber(getFirstTransactionAmount(item, 14, firstTxMap))}</td>
                    {/* ต่ออายุ GG */}
                    <td className="col-gg">{formatNumber(getRenewTransactionAmount(item, 14, firstTxMap))}</td>
                    {/* ลูกค้าใหม่ FB */}
                    <td className="col-fb">{formatNumber(getFirstTransactionAmount(item, 18, firstTxMap))}</td>
                    {/* ต่ออายุ FB */}
                    <td className="col-fb">{formatNumber(getRenewTransactionAmount(item, 18, firstTxMap))}</td>
                    {/* Hosting Domain */}
                    <td className="col-hosting">{formatNumber(getBreakdownAmount(item, 20))}</td>
                    {/* ค่าคลิก */}
                    <td className="col-click">{formatNumber(getBreakdownAmount(item, 11))}</td>
                    <td className="col-prepaid editable-cell" onClick={() => handleCellClick(item._id, 'prepaid', item.prepaid)}>
                      {editingCell?.id === item._id && editingCell?.field === 'prepaid' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{formatNumber(item.prepaid)}</span>
                      )}
                    </td>
                    <td className="col-coupon editable-cell" onClick={() => handleCellClick(item._id, 'coupon', item.coupon)}>
                      {editingCell?.id === item._id && editingCell?.field === 'coupon' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{formatNumber(item.coupon)}</span>
                      )}
                    </td>
                    <td className="col-inv editable-cell" onClick={() => handleCellClick(item._id, 'invGG', item.invGG)}>
                      {editingCell?.id === item._id && editingCell?.field === 'invGG' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{formatNumber(item.invGG)}</span>
                      )}
                    </td>
                    <td className="col-inv editable-cell" onClick={() => handleCellClick(item._id, 'invFB', item.invFB)}>
                      {editingCell?.id === item._id && editingCell?.field === 'invFB' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{formatNumber(item.invFB)}</span>
                      )}
                    </td>
                    {/* Vat 36 */}
                    <td className="col-vat">{formatNumber(getBreakdownAmount(item, 12))}</td>
                    {/* Vat 30: รวม 13, 17, 19 */}
                    <td className="col-vat">{formatNumber(getBreakdownAmount(item, 13) + getBreakdownAmount(item, 17) + getBreakdownAmount(item, 19))}</td>
                    <td className="col-charge">
                      {getBreakdownAmount(item, 11) > 0 ? (
                        item.cardCharged ? (
                          <span className="charge-done"><CheckCircleFill size={14} /> ตัดแล้ว</span>
                        ) : (
                          <button
                            className="btn-charge"
                            onClick={() => { setChargeModal(item); setChargeCardId(''); setChargeTime(''); setChargeAmount(String(item.amount || '')); setChargeNote(''); }}
                            disabled={chargingId === item._id}
                          >
                            {chargingId === item._id ? '...' : <><CreditCard2Back size={12} /> ตัดเงิน</>}
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              {pageSummary && (
                <tfoot>
                  <tr style={{ background: '#f0f4ff', fontWeight: 700, borderTop: '2px solid #c7d2fe', fontSize: 12 }}>
                    <td className="col-index" colSpan="8" style={{ padding: '8px 10px', color: '#3730a3' }}>รวม {ledgerData.length} รายการ (หน้านี้)</td>
                    <td className="col-amount" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.amount)}</td>
                    <td className="col-status"></td>
                    <td className="col-card"></td>
                    <td className="col-cardtime"></td>
                    <td className="col-gg" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.newGG)}</td>
                    <td className="col-gg" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.renewGG)}</td>
                    <td className="col-fb" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.newFB)}</td>
                    <td className="col-fb" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.renewFB)}</td>
                    <td className="col-hosting" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.hosting)}</td>
                    <td className="col-click" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.click)}</td>
                    <td className="col-prepaid"></td>
                    <td className="col-coupon"></td>
                    <td className="col-inv"></td>
                    <td className="col-inv"></td>
                    <td className="col-vat" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.vat36)}</td>
                    <td className="col-vat" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.vat30)}</td>
                    <td className="col-charge"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ledger-pagination">
          <button
            className="pagination-btn"
            onClick={() => fetchLedger(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft /> ก่อนหน้า
          </button>
          <span className="pagination-info">
            หน้า {currentPage} / {totalPages} (ทั้งหมด {total} รายการ)
          </span>
          <button
            className="pagination-btn"
            onClick={() => fetchLedger(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            ถัดไป <ChevronRight />
          </button>
        </div>
      )}

      {/* Charge Modal */}
      {chargeModal && (
        <div className="charge-modal-backdrop" onClick={() => setChargeModal(null)}>
          <div className="charge-modal" onClick={e => e.stopPropagation()}>
            <div className="charge-modal-header">
              <h3>ตัดเงินจากบัตร</h3>
              <button className="charge-modal-close" onClick={() => setChargeModal(null)}><X size={18} /></button>
            </div>
            <div className="charge-modal-body">
              <div className="charge-info-row">
                <span className="charge-info-label">บัญชี</span>
                <span className="charge-info-value">{chargeModal.accountName}</span>
              </div>
              <div className="charge-info-row">
                <span className="charge-info-label">บริการ</span>
                <span className="charge-info-value">{chargeModal.serviceType || '-'}</span>
              </div>
              <div className="charge-info-row">
                <span className="charge-info-label">CID</span>
                <span className="charge-info-value" style={{ fontFamily: 'monospace' }}>{chargeModal.customerCode || '-'}</span>
              </div>
              <div className="charge-info-row">
                <span className="charge-info-label">Transaction ID</span>
                <span className="charge-info-value" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{chargeModal._id}</span>
              </div>
              {chargeHistory && chargeHistory.count > 0 && (
                <div className="charge-history-info">
                  <span>ตัดเงินไปแล้ว <strong>{chargeHistory.count}</strong> ครั้ง</span>
                  {chargeHistory.last && (
                    <span style={{ marginLeft: 8, color: '#737373' }}>
                      ล่าสุด: {new Date(chargeHistory.last.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {chargeHistory.last.chargeTime ? ` เวลา ${chargeHistory.last.chargeTime} น.` : ''}
                      {chargeHistory.last.cardId ? ` (${chargeHistory.last.cardId.displayName})` : ''}
                    </span>
                  )}
                </div>
              )}
              <div className="charge-form-group">
                <label>จำนวนเงินที่ตัด (บาท)</label>
                <input
                  type="number"
                  className="charge-time-input"
                  placeholder="0.00"
                  value={chargeAmount}
                  onChange={e => setChargeAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="charge-form-group">
                <label>เวลาที่ตัดเงิน</label>
                <input
                  type="text"
                  className="charge-time-input"
                  placeholder="เช่น 14:30"
                  value={chargeTime}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9:]/g, '');
                    setChargeTime(v);
                  }}
                  maxLength={5}
                />
              </div>
              <div className="charge-form-group">
                <label>เลือกบัตร</label>
                <select value={chargeCardId} onChange={e => setChargeCardId(e.target.value)}>
                  <option value="">-- เลือกบัตร --</option>
                  {cards.map(c => (
                    <option key={c._id} value={c._id}>{c.displayName} ({c.last4})</option>
                  ))}
                </select>
              </div>
              <div className="charge-form-group">
                <label>หมายเหตุ (ถ้ามี)</label>
                <textarea
                  className="charge-note-input"
                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  value={chargeNote}
                  onChange={e => setChargeNote(e.target.value)}
                  rows={2}
                />
              </div>
              {chargeCardId && (() => {
                const selectedCard = cards.find(c => c._id === chargeCardId);
                if (!selectedCard) return null;
                const remaining = (selectedCard.balance || 0) - (Number(chargeAmount) || 0);
                return (
                  <div className="charge-card-balance">
                    <div className="balance-row">
                      <span>ยอดคงเหลือปัจจุบัน</span>
                      <span className="balance-current">{selectedCard.balance?.toLocaleString()} บาท</span>
                    </div>
                    <div className="balance-row">
                      <span>หลังตัดจะเหลือ</span>
                      <span className={remaining < 0 ? 'balance-negative' : 'balance-after'}>{remaining.toLocaleString()} บาท</span>
                    </div>
                    {remaining < 0 && <div className="balance-warning">⚠️ ยอดเงินไม่พอ</div>}
                  </div>
                );
              })()}
            </div>
            <div className="charge-modal-footer">
              <button className="btn-charge-cancel" onClick={() => setChargeModal(null)}>ยกเลิก</button>
              <button className="btn-charge-confirm" onClick={handleChargeConfirm} disabled={!chargeCardId || !chargeTime || !chargeAmount || chargingId}>
                {chargingId ? 'กำลังดำเนินการ...' : 'ยืนยันตัดเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
