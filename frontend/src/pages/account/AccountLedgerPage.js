import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from '../../utils/toast';
import { 
  FileEarmarkSpreadsheet, Search, Download, 
  ChevronLeft, ChevronRight, Funnel, X, CreditCard2Back, CheckCircleFill,
  WalletFill, PencilSquare, BoxArrowInDown
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
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(true); // ปรับเป็น true เสมอเพื่อให้เห็นตัวเลือกชัดเจน
  const todayStr = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    startDate: todayStr,
    endDate: todayStr,
    bank: '',
    serviceType: '',
    search: ''
  });

  const firstTxMap = useMemo(() => buildFirstTxMap(ledgerData), [ledgerData]);
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

  // Inline editing
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');

  // Card charging
  const [cards, setCards] = useState([]);
  const [chargingId, setChargingId] = useState(null);
  const [chargeAsInvGG, setChargeAsInvGG] = useState(false);
  const [chargeModal, setChargeModal] = useState(null); // item to charge
  const [chargeCardId, setChargeCardId] = useState('');
  const [chargeTime, setChargeTime] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNote, setChargeNote] = useState('');
  const [chargeDate, setChargeDate] = useState('');
  const [chargeHistory, setChargeHistory] = useState(null);

  // Facebook Ads: topup modal
  const [topupModal, setTopupModal] = useState(null);
  const [topupCardId, setTopupCardId] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDate, setTopupDate] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  // Facebook Ads: record modal
  const [fbRecordModal, setFbRecordModal] = useState(null);
  const [fbRecordCardId, setFbRecordCardId] = useState('');
  const [fbRecordDate, setFbRecordDate] = useState('');
  const [fbRecordTime, setFbRecordTime] = useState('');
  const [fbRecordAmount, setFbRecordAmount] = useState('');
  const [fbRecordNote, setFbRecordNote] = useState('');
  const [fbRecordLoading, setFbRecordLoading] = useState(false);

  // ── Google Ads: เปิด record modal สำหรับรายการที่ติด invoice (Inv.Gg) ──
  const [ggRecordModal, setGgRecordModal] = useState(null);
  const [ggRecordCardId, setGgRecordCardId] = useState('');
  const [ggRecordDate, setGgRecordDate] = useState('');
  const [ggRecordTime, setGgRecordTime] = useState('');
  const [ggRecordLoading, setGgRecordLoading] = useState(false);

  const openGgRecordModal = (item) => {
    setGgRecordModal(item);
    setGgRecordCardId('');
    setGgRecordDate(new Date().toISOString().split('T')[0]);
    setGgRecordTime('');
  };
  const api = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem('token');

  // สร้าง/บันทึก Invoice Google (ไม่ตัดบัตร)
  const handleCreateInvGG = async (amount, date) => {
    const item = chargeModal;
    if (!item) return;
    try {
      setChargingId(item._id);
      await axios.patch(`${api}/api/ledger/${item._id}`, {
        invGG: Number(amount || 0),
        invGGDate: date || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('บันทึก Invoice สำเร็จ');
      setChargeModal(null);
      setChargeAsInvGG(false);
      fetchLedger(currentPage);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
    } finally {
      setChargingId(null);
    }
  };

  const fetchLedger = useCallback(async (page = 1, signal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '300');
      
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
      startDate: todayStr,
      endDate: todayStr,
      bank: '',
      serviceType: '',
      search: ''
    });
  };

  // ฟังก์ชันสำหรับ inline editing
  const handleCellClick = (id, field, currentValue) => {
    setEditingCell({ id, field });
    // normalize currentValue: if number -> format with 2 decimals, if null/undefined or '-' -> empty
    let v = '';
    // date fields: normalize to YYYY-MM-DD for date input
    const dateFields = ['cardDate', 'fbTopupDate', 'invGGDate', 'fbChargedDate'];
    if (currentValue === '-' || currentValue === null || currentValue === undefined) v = '';
    else if (dateFields.includes(field)) {
      try {
        v = new Date(currentValue).toISOString().split('T')[0];
      } catch (e) {
        v = '';
      }
    } else if (typeof currentValue === 'number') v = currentValue.toFixed(2);
    else v = String(currentValue);
    setEditValue(v);
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;
    
    try {
      // Prepare payload: numeric fields sent as numbers with 2 decimals
      const numericFields = [
        'prepaid', 'coupon', 'invGG', 'invFB', 'amount', 'fbClickAmount',
        'wht3click', 'wht2svc', 'wht2click', 'wht3svc', 'vat36', 'vat30'
      ];
      const payload = {};
      if (numericFields.includes(editingCell.field)) {
        const num = editValue === '' ? null : Number(parseFloat(editValue || 0).toFixed(2));
        payload[editingCell.field] = num;
      } else {
        payload[editingCell.field] = editValue === '' ? null : editValue;
      }

      await axios.patch(
        `${api}/api/ledger/${editingCell.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // อัพเดต local state
      const newValue = (payload[editingCell.field] === null) ? null : payload[editingCell.field];
      setLedgerData(prev => prev.map(item => {
        if (item._id !== editingCell.id) return item;
        
        // If updating breakdowns, map the corresponding code
        const codeMap = {
          fbClickAmount: '11',
          wht3click: '7',
          wht2svc: '8',
          wht2click: '9',
          wht3svc: '10',
          vat36: '12'
        };

        if (codeMap[editingCell.field]) {
          const code = codeMap[editingCell.field];
          const bd = Array.isArray(item.breakdowns) ? [...item.breakdowns] : [];
          const idx = bd.findIndex(b => String(b.code) === code);
          if (idx >= 0) {
            if (newValue === null || newValue === 0) {
              bd.splice(idx, 1);
            } else {
              bd[idx] = { ...bd[idx], amount: newValue };
            }
          } else if (newValue !== null && newValue !== 0) {
            bd.push({ code, amount: newValue, statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
          }
          return { ...item, breakdowns: bd };
        }

        // special handling for vat30 (which maps to 13, 17, or 19)
        if (editingCell.field === 'vat30') {
          const isFb = /facebook/i.test(item.serviceType || '');
          const code = isFb ? '17' : '13'; // default fallback code
          const bd = Array.isArray(item.breakdowns) ? [...item.breakdowns] : [];
          // find any of 13, 17, 19
          const idx = bd.findIndex(b => ['13', '17', '19'].includes(String(b.code)));
          if (idx >= 0) {
            if (newValue === null || newValue === 0) {
              bd.splice(idx, 1);
            } else {
              bd[idx] = { ...bd[idx], amount: newValue };
            }
          } else if (newValue !== null && newValue !== 0) {
            bd.push({ code, amount: newValue, statusNote: 'รอบันทึกบัญชี', isAutoVat: false });
          }
          return { ...item, breakdowns: bd };
        }

        // If updating amount, set item.amount
        if (editingCell.field === 'amount') {
          return { ...item, amount: newValue };
        }
        return { ...item, [editingCell.field]: newValue };
      }));
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ');
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  // ตัดเงินจากบัตร (หรือบันทึกเป็น Invoice Google ถ้าเลือก)
  const handleChargeConfirm = () => {
    if (chargeAsInvGG) {
      const item = chargeModal;
      if (!item) { toast.warning('ไม่มีรายการที่เลือก'); return; }
      const totalGG = (getBreakdownAmount(item, 14) || 0) + (getBreakdownAmount(item, 11) || 0);
      const ok = window.confirm(`จะบันทึกเป็น Invoice (Inv.Gg) จำนวน ${formatNumber(totalGG)} บาท ?`);
      if (ok) handleCreateInvGG(totalGG, chargeDate);
      return;
    }

    if (!chargeCardId) {
      toast.warning('กรุณาเลือกบัตร');
      return;
    }
    if (!chargeDate) {
      toast.warning('กรุณาระบุวันที่ตัดบัตร');
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
      `วันที่ตัด: ${chargeDate}\n` +
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
        chargeDate: chargeDate,
        serviceId: item.serviceId,
        breakdowns: item.breakdowns || []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('ตัดเงินจากบัตรสำเร็จ');
      setChargeModal(null);
      setChargeCardId('');
      setChargeDate('');
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

  // ── Facebook Ads: เปิด topup modal ──
  const openTopupModal = (item) => {
    setTopupModal(item);
    setTopupCardId('');
    setTopupAmount(String(getBreakdownAmount(item, 11) || ''));
    setTopupDate(new Date().toISOString().split('T')[0]);
  };

  // ── Facebook Ads: เปิด record modal ──
  const openFbRecordModal = (item) => {
    setFbRecordModal(item);
    setFbRecordCardId(item.fbTopupCardId || '');
    setFbRecordDate(new Date().toISOString().split('T')[0]);
    setFbRecordTime('');
    setFbRecordAmount(String(getBreakdownAmount(item, 11) || ''));
    setFbRecordNote('');
  };

  // ── Facebook Ads: ยืนยันเติมเงิน ──
  const handleTopupConfirm = async () => {
    if (!topupCardId || !topupAmount) {
      toast.warning('กรุณาเลือกบัตรและระบุยอดเงิน');
      return;
    }
    try {
      setTopupLoading(true);
      // บันทึกสถานะเติมเงินเท่านั้น — ไม่หักบัตร (หักจริงเมื่อ FB ตัดแล้ว)
      await axios.patch(`${api}/api/ledger/${topupModal._id}`, {
        fbToppedUp: true,
        fbTopupCardId: topupCardId,
        fbTopupAmount: Number(topupAmount || 0),
        fbTopupDate: topupDate || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('บันทึกการเติมเงินสำเร็จ');
      setTopupModal(null);
      fetchLedger(currentPage);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'บันทึกการเติมเงินไม่สำเร็จ');
    } finally {
      setTopupLoading(false);
    }
  };

  // ── Facebook Ads: ยืนยันบันทึกการตัด ──
  const handleFbRecordConfirm = async () => {
    if (!fbRecordCardId || !fbRecordDate || !fbRecordTime || !fbRecordAmount) {
      toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    try {
      setFbRecordLoading(true);
      const selectedCard = cards.find(c => c._id === fbRecordCardId);
      // 1. ตัดยอดบัตรจริง (FB ตัดเงินแล้ว) → สร้าง CardLedger -amount
      await axios.post(`${api}/api/cards/charge`, {
        cardId: fbRecordCardId,
        amount: Number(fbRecordAmount),
        channel: 'Facebook Ads',
        note: `FB ตัดเงิน: ${fbRecordModal.accountName}`,
        serviceId: fbRecordModal.serviceId,
      }, { headers: { Authorization: `Bearer ${token}` } });
      // 2. บันทึก cardCharged บน Transaction
      await axios.patch(`${api}/api/ledger/${fbRecordModal._id}`, {
        cardCharged: true,
        cardNumber: selectedCard?.last4 || '',
        cardTime: fbRecordTime,
        fbChargedDate: fbRecordDate,
        fbChargedAmount: Number(fbRecordAmount),
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('บันทึกการตัดเงินของ Facebook สำเร็จ');
      setFbRecordModal(null);
      fetchLedger(currentPage);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
    } finally {
      setFbRecordLoading(false);
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
      case 'all':
        startDate = '';
        endDate = '';
        break;
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
          <div className="quick-date-filters" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <label className="quick-filter-label">ช่วงเวลา:</label>
            <div className="quick-filter-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button 
                type="button" 
                className={`btn-quick-filter ${!filters.startDate && !filters.endDate ? 'active' : ''}`} 
                onClick={() => setQuickDateFilter('all')}
              >
                ทั้งหมด
              </button>
              <button 
                type="button" 
                className={`btn-quick-filter ${filters.startDate === todayStr && filters.endDate === todayStr ? 'active' : ''}`} 
                onClick={() => setQuickDateFilter('today')}
              >
                วันนี้
              </button>
              <button 
                type="button" 
                className={`btn-quick-filter ${filters.startDate && filters.startDate === filters.endDate && filters.startDate === new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0] ? 'active' : ''}`} 
                onClick={() => setQuickDateFilter('yesterday')}
              >
                เมื่อวาน
              </button>
              <button 
                type="button" 
                className="btn-quick-filter" 
                onClick={() => setQuickDateFilter('last7days')}
              >
                7 วันล่าสุด
              </button>
              <button 
                type="button" 
                className="btn-quick-filter" 
                onClick={() => setQuickDateFilter('last30days')}
              >
                30 วันล่าสุด
              </button>
              <button 
                type="button" 
                className="btn-quick-filter" 
                onClick={() => setQuickDateFilter('thisMonth')}
              >
                เดือนนี้
              </button>
            </div>
            
            <div className="custom-single-date" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>เลือกวันที่เจาะจง:</span>
              <input 
                type="date" 
                value={filters.startDate === filters.endDate ? filters.startDate : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setFilters({ ...filters, startDate: val, endDate: val });
                  }
                }}
                style={{
                  padding: '6px 12px',
                  border: '1.5px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  color: '#1f2937',
                  outline: 'none'
                }}
              />
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
                  <th className="col-index sticky-col sticky-col-1" scope="col">#</th>
                  <th className="col-txid sticky-col sticky-col-2" scope="col">Transaction ID</th>
                  <th className="col-account sticky-col sticky-col-3" scope="col">บัญชี</th>
                  <th className="col-customer sticky-col sticky-col-4" scope="col">ชื่อลูกค้า</th>
                  <th className="col-service sticky-col sticky-col-5" scope="col">บริการ</th>
                  <th className="col-code sticky-col sticky-col-6" scope="col">รหัส cid</th>
                  <th className="col-bank sticky-col sticky-col-7" scope="col">ธนาคาร</th>
                  <th className="col-date sticky-col sticky-col-8" scope="col">วันที่โอน</th>
                  <th className="col-time" scope="col">เวลาโอน</th>
                  <th className="col-amount" scope="col">ยอดเงินที่โอน</th>
                  <th className="col-status" scope="col">status</th>
                  <th className="col-card" scope="col">บัตรเลขที่</th>
                  <th className="col-carddate" scope="col">วันที่ตัดบัตร</th>
                  <th className="col-cardtime" scope="col">เวลาที่ตัดบัตร</th>
                  <th className="col-gg" scope="col">ลูกค้าใหม่ GG</th>
                  <th className="col-gg" scope="col">ต่ออายุ GG</th>
                  <th className="col-fb" scope="col">ลูกค้าใหม่ FB</th>
                  <th className="col-fb" scope="col">ต่ออายุ FB</th>
                  <th className="col-hosting" scope="col">Hosting Domain</th>
                  <th className="col-click" scope="col">ค่าคลิก</th>
                  <th className="col-wht3click" scope="col">หัก ณ ที่จ่าย 3% ค่าคลิก</th>
                  <th className="col-wht2svc" scope="col">หัก ณ ที่จ่าย 2% ค่าบริการ</th>
                  <th className="col-wht2click" scope="col">หัก ณ ที่จ่าย 2% ค่าคลิก</th>
                  <th className="col-wht3svc" scope="col">หัก ณ ที่จ่าย 3% ค่าบริการ</th>
                  <th className="col-prepaid" scope="col">สำรอง</th>
                  <th className="col-coupon" scope="col">คูปอง</th>
                  <th className="col-inv" scope="col">Inv. Gg</th>
                  <th className="col-inv" scope="col">Inv. Fb</th>
                  <th className="col-vat" scope="col">Vat 36</th>
                  <th className="col-vat" scope="col">Vat 30</th>
                  <th className="col-topupDate" scope="col">วันที่เติม/Inv</th>
                  <th className="col-charge" scope="col">ตัดเงิน</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.map((item) => (
                  <tr key={item._id} data-service={item.serviceType}>
                    <td className="col-index sticky-col sticky-col-1">{item.index}</td>
                    <td className="col-txid sticky-col sticky-col-2">{item._id}</td>
                    <td className="col-account sticky-col sticky-col-3" title={item.accountName}>{item.accountName}</td>
                    <td className="col-customer sticky-col sticky-col-4" title={item.customerName}>{item.customerName}</td>
                    <td className="col-service sticky-col sticky-col-5">
                      {item.serviceType === 'Google Ads' && <span className="service-tag google">Google</span>}
                      {item.serviceType === 'Facebook Ads' && <span className="service-tag facebook">Facebook</span>}
                      {item.serviceType !== 'Google Ads' && item.serviceType !== 'Facebook Ads' && <span className="service-tag">{item.serviceType || '-'}</span>}
                    </td>
                    <td className="col-code sticky-col sticky-col-6">{item.customerCode}</td>
                    <td className="col-bank sticky-col sticky-col-7">{item.bank}</td>
                    <td className="col-date sticky-col sticky-col-8">{formatDate(item.transactionDate)}</td>
                    <td className="col-time">{item.transactionTime}</td>
                    <td className="col-amount editable-cell" onClick={() => handleCellClick(item._id, 'amount', item.amount)}>
                      {editingCell?.id === item._id && editingCell?.field === 'amount' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(item.amount)}</span>
                      )}
                    </td>
                    <td className="col-status">{getStatusBadge(item.status)}</td>
                    <td className="col-card editable-cell" onClick={() => handleCellClick(item._id, 'cardNumber', item.cardNumber)}>
                      {editingCell?.id === item._id && editingCell?.field === 'cardNumber' ? (
                        <input type="text" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">{item.cardNumber}</span>
                      )}
                    </td>
                    <td className="col-carddate editable-cell" onClick={() => handleCellClick(item._id, 'cardDate', item.cardDate)}>
                      {editingCell?.id === item._id && editingCell?.field === 'cardDate' ? (
                        <input type="date" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        <span className="editable-text">
                          {item.cardDate ? formatDate(item.cardDate) : (item.fbChargedDate ? formatDate(item.fbChargedDate) : (item.cardChargedAt ? formatDate(item.cardChargedAt) : ''))}
                        </span>
                      )}
                    </td>
                    <td className="col-cardtime editable-cell" onClick={() => handleCellClick(item._id, 'cardTime', item.cardTime)}>
                      {editingCell?.id === item._id && editingCell?.field === 'cardTime' ? (
                        <input type="text" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value.replace(/[^0-9:.]/g, '').replace(/\./g, ':'))} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus maxLength={5} placeholder="00:00" />
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
                    <td className="col-click editable-cell" onClick={() => handleCellClick(item._id, 'fbClickAmount', getBreakdownAmount(item, 11))}>
                      {editingCell?.id === item._id && editingCell?.field === 'fbClickAmount' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 11))}</span>
                      )}
                    </td>
                    {/* หัก ณ ที่จ่าย 3% ค่าคลิก (code 7) */}
                    <td className="col-wht3click editable-cell" onClick={() => handleCellClick(item._id, 'wht3click', getBreakdownAmount(item, 7))}>
                      {editingCell?.id === item._id && editingCell?.field === 'wht3click' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 7))}</span>
                      )}
                    </td>
                    {/* หัก ณ ที่จ่าย 2% ค่าบริการ (code 8) */}
                    <td className="col-wht2svc editable-cell" onClick={() => handleCellClick(item._id, 'wht2svc', getBreakdownAmount(item, 8))}>
                      {editingCell?.id === item._id && editingCell?.field === 'wht2svc' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 8))}</span>
                      )}
                    </td>
                    {/* หัก ณ ที่จ่าย 2% ค่าคลิก (code 9) */}
                    <td className="col-wht2click editable-cell" onClick={() => handleCellClick(item._id, 'wht2click', getBreakdownAmount(item, 9))}>
                      {editingCell?.id === item._id && editingCell?.field === 'wht2click' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 9))}</span>
                      )}
                    </td>
                    {/* หัก ณ ที่จ่าย 3% ค่าบริการ (code 10) */}
                    <td className="col-wht3svc editable-cell" onClick={() => handleCellClick(item._id, 'wht3svc', getBreakdownAmount(item, 10))}>
                      {editingCell?.id === item._id && editingCell?.field === 'wht3svc' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 10))}</span>
                      )}
                    </td>
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
                        <span className="editable-text">{item.invGG ? 'invoice' : '-'}</span>
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
                    <td className="col-vat editable-cell" onClick={() => handleCellClick(item._id, 'vat36', getBreakdownAmount(item, 12))}>
                      {editingCell?.id === item._id && editingCell?.field === 'vat36' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 12))}</span>
                      )}
                    </td>
                    {/* Vat 30: รวม 13, 17, 19 */}
                    <td className="col-vat editable-cell" onClick={() => handleCellClick(item._id, 'vat30', getBreakdownAmount(item, 13) + getBreakdownAmount(item, 17) + getBreakdownAmount(item, 19))}>
                      {editingCell?.id === item._id && editingCell?.field === 'vat30' ? (
                        <input type="number" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus step="0.01" />
                      ) : (
                        <span className="editable-text">{formatNumber(getBreakdownAmount(item, 13) + getBreakdownAmount(item, 17) + getBreakdownAmount(item, 19))}</span>
                      )}
                    </td>
                    <td className="col-topupDate editable-cell" onClick={() => {
                      if (item.serviceType === 'Facebook Ads') return handleCellClick(item._id, 'fbTopupDate', item.fbTopupDate);
                      return handleCellClick(item._id, 'invGGDate', item.invGGDate);
                    }}>
                      {editingCell?.id === item._id && (editingCell?.field === 'fbTopupDate' || editingCell?.field === 'invGGDate') ? (
                        <input type="date" className="inline-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellBlur} onKeyDown={handleKeyDown} autoFocus />
                      ) : (
                        item.serviceType === 'Facebook Ads' ? (
                          item.fbChargedDate ? formatDate(item.fbChargedDate) : (item.fbTopupDate ? formatDate(item.fbTopupDate) : (item.fbToppedUp || item.cardCharged ? formatDate(item.transactionDate) : '-'))
                        ) : (
                          item.invGG ? (item.cardDate ? formatDate(item.cardDate) : (item.invGGDate ? formatDate(item.invGGDate) : formatDate(item.transactionDate))) : '-'
                        )
                      )}
                    </td>
                    <td className="col-charge">
                      {item.cardCharged ? (
                        <span className="charge-done">
                          <CheckCircleFill size={14} />
                          {item.serviceType === 'Facebook Ads' ? ' FB ตัดแล้ว' : ' ตัดแล้ว'}
                        </span>
                      ) : item.serviceType === 'Facebook Ads' && getBreakdownAmount(item, 11) > 0 ? (
                        item.fbToppedUp ? (
                          // เติมแล้ว รอ FB ตัด
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 8px', borderRadius: 3,
                              background: '#fff8e1', color: '#e65100',
                              fontSize: '0.7rem', fontWeight: 600,
                              border: '1px solid #ffe082', whiteSpace: 'nowrap'
                            }}>
                              ⏳ รอ FB ตัด
                            </span>
                            <button
                              onClick={() => openFbRecordModal(item)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600,
                                background: '#fff', color: '#1877f2',
                                border: '1px solid #1877f2', borderRadius: 3,
                                cursor: 'pointer', whiteSpace: 'nowrap'
                              }}
                            >
                              <PencilSquare size={11} /> บันทึกการตัด
                            </button>
                          </div>
                        ) : (
                          // ยังไม่เติมเงิน
                          <div style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => openTopupModal(item)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                                background: '#1877f2', color: '#fff',
                                border: 'none', borderRadius: 4,
                                cursor: 'pointer', whiteSpace: 'nowrap'
                              }}
                            >
                              <WalletFill size={12} /> เติมเงิน
                            </button>
                          </div>
                        )
                      ) : getBreakdownAmount(item, 11) > 0 ? (
                        // Google Ads — ตัดเงินเอง หรือ บันทึกเป็น Invoice (invGG)
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          {item.invGG ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: 'column' }}>
                              <span style={{ background: '#fff8f0', color: '#a63d00', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                                Inv.Gg
                              </span>
                              <button
                                onClick={() => openGgRecordModal(item)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, background: '#fff', color: '#198754', border: '1px solid #198754', cursor: 'pointer' }}
                              >
                                <PencilSquare size={12} /> บันทึกการตัด
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn-charge"
                              onClick={() => { setChargeModal(item); setChargeCardId(''); setChargeTime(''); setChargeAmount(String(getBreakdownAmount(item, 11) || '')); setChargeNote(''); setChargeAsInvGG(false); }}
                              disabled={chargingId === item._id}
                            >
                              {chargingId === item._id ? '...' : <><CreditCard2Back size={12} /> ตัดเงิน</>}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              {pageSummary && (
                <tfoot>
                  <tr style={{ background: '#f0f4ff', fontWeight: 700, borderTop: '2px solid #c7d2fe', fontSize: 12 }}>
                    <td className="col-index" colSpan="9" style={{ padding: '8px 10px', color: '#3730a3' }}>รวม {ledgerData.length} รายการ (หน้านี้)</td>
                    <td className="col-amount" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.amount)}</td>
                    <td className="col-status"></td>
                    <td className="col-card"></td>
                    <td className="col-carddate"></td>
                    <td className="col-cardtime"></td>
                    <td className="col-gg" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.newGG)}</td>
                    <td className="col-gg" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.renewGG)}</td>
                    <td className="col-fb" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.newFB)}</td>
                    <td className="col-fb" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.renewFB)}</td>
                    <td className="col-hosting" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.hosting)}</td>
                    <td className="col-click" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(pageSummary.click)}</td>
                    <td className="col-wht3click" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(getBreakdownAmount({ breakdowns: ledgerData.flatMap(i => i.breakdowns || []) }, 7))}</td>
                    <td className="col-wht2svc" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(getBreakdownAmount({ breakdowns: ledgerData.flatMap(i => i.breakdowns || []) }, 8))}</td>
                    <td className="col-wht2click" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(getBreakdownAmount({ breakdowns: ledgerData.flatMap(i => i.breakdowns || []) }, 9))}</td>
                    <td className="col-wht3svc" style={{ padding: '8px 10px', color: '#3730a3' }}>{formatNumber(getBreakdownAmount({ breakdowns: ledgerData.flatMap(i => i.breakdowns || []) }, 10))}</td>
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

      {/* ══ Modal: Facebook Ads — เติมเงินเข้าบัตร ══ */}
      {topupModal && (
        <div className="charge-modal-backdrop" onClick={() => setTopupModal(null)}>
          <div className="charge-modal" onClick={e => e.stopPropagation()}>
            <div className="charge-modal-header" style={{ borderBottom: '3px solid #1877f2' }}>
              <h3 style={{ color: '#1877f2' }}>
                <WalletFill size={14} style={{ marginRight: 6 }} />
                เติมเงินเข้าบัตร — Facebook Ads
              </h3>
              <button className="charge-modal-close" onClick={() => setTopupModal(null)}><X size={18} /></button>
            </div>
            <div className="charge-modal-body">
              <div className="charge-info-row"><span className="charge-info-label">บัญชี</span><span className="charge-info-value">{topupModal.accountName}</span></div>
              <div className="charge-info-row"><span className="charge-info-label">CID</span><span className="charge-info-value">{topupModal.customerCode}</span></div>
              <div className="charge-info-row">
                <span className="charge-info-label">ค่าคลิก (code 11)</span>
                <span className="charge-info-value"><strong style={{ color: '#1877f2' }}>{formatNumber(getBreakdownAmount(topupModal, 11))} บาท</strong></span>
              </div>
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#e8f0fe', borderRadius: 4, fontSize: '0.78rem', color: '#1967d2', lineHeight: 1.6 }}>
                💳 เติมเงินเข้าบัตรเพื่อรอให้ Facebook ตัดเงินเอง
              </div>
              <div className="charge-form-group">
                <label>เลือกบัตรที่เติมเงิน</label>
                <select value={topupCardId} onChange={e => setTopupCardId(e.target.value)}>
                  <option value="">— เลือกบัตร —</option>
                  {cards.map(c => (
                    <option key={c._id} value={c._id}>{c.displayName} ({c.last4}) — เหลือ {c.balance?.toLocaleString()} ฿</option>
                  ))}
                </select>
              </div>
              <div className="charge-form-group">
                <label>วันที่เติมเงิน</label>
                <input type="date" className="charge-time-input" value={topupDate} onChange={e => setTopupDate(e.target.value)} />
              </div>
              <div className="charge-form-group">
                <label>จำนวนเงินที่เติม (บาท)</label>
                <input type="number" className="charge-time-input" value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div className="charge-modal-footer">
              <button className="btn-charge-cancel" onClick={() => setTopupModal(null)}>ยกเลิก</button>
              <button
                style={{ padding: '8px 20px', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: (!topupCardId || !topupAmount || topupLoading) ? 'not-allowed' : 'pointer', background: (!topupCardId || !topupAmount || topupLoading) ? '#bdbdbd' : '#1877f2' }}
                onClick={handleTopupConfirm}
                disabled={!topupCardId || !topupAmount || topupLoading}
              >
                {topupLoading ? 'กำลังบันทึก...' : 'ยืนยันเติมเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Facebook Ads — บันทึกว่า FB ตัดแล้ว ══ */}
      {fbRecordModal && (
        <div className="charge-modal-backdrop" onClick={() => setFbRecordModal(null)}>
          <div className="charge-modal" onClick={e => e.stopPropagation()}>
            <div className="charge-modal-header" style={{ borderBottom: '3px solid #1877f2' }}>
              <h3 style={{ color: '#1877f2' }}>
                <BoxArrowInDown size={15} style={{ marginRight: 6 }} />
                บันทึกการตัดเงิน — Facebook Ads
              </h3>
              <button className="charge-modal-close" onClick={() => setFbRecordModal(null)}><X size={18} /></button>
            </div>
            <div className="charge-modal-body">
              <div className="charge-info-row"><span className="charge-info-label">บัญชี</span><span className="charge-info-value">{fbRecordModal.accountName}</span></div>
              <div className="charge-info-row"><span className="charge-info-label">CID</span><span className="charge-info-value">{fbRecordModal.customerCode}</span></div>
              <div className="charge-info-row">
                <span className="charge-info-label">ค่าคลิก</span>
                <span className="charge-info-value"><strong style={{ color: '#1877f2' }}>{formatNumber(getBreakdownAmount(fbRecordModal, 11))} บาท</strong></span>
              </div>
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff8e1', borderRadius: 4, fontSize: '0.78rem', color: '#6d4c00', lineHeight: 1.6 }}>
                📋 ถ้า Facebook ตัดเงินจากบัตรไปแล้ว กรอกรายละเอียดเพื่อบันทึก
              </div>
              <div className="charge-form-group">
                <label>บัตรที่ Facebook ตัดเงิน</label>
                <select value={fbRecordCardId} onChange={e => setFbRecordCardId(e.target.value)}>
                  <option value="">— เลือกบัตร —</option>
                  {cards.map(c => (
                    <option key={c._id} value={c._id}>{c.displayName} (ท้าย {c.last4})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>วันที่ Facebook ตัด</label>
                  <input type="date" className="charge-time-input" value={fbRecordDate} onChange={e => setFbRecordDate(e.target.value)} />
                </div>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>เวลาที่ตัด</label>
                  <input type="text" className="charge-time-input" placeholder="เช่น 08:00" value={fbRecordTime}
                    onChange={e => setFbRecordTime(e.target.value.replace(/[^0-9:.]/g, '').replace(/\./g, ':'))} maxLength={5} />
                </div>
              </div>
              <div className="charge-form-group">
                <label>ยอดเงินที่ Facebook ตัดจริง (บาท)</label>
                <input type="number" className="charge-time-input" value={fbRecordAmount}
                  onChange={e => setFbRecordAmount(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="charge-form-group">
                <label>หมายเหตุ (ถ้ามี)</label>
                <textarea className="charge-note-input" rows={2} value={fbRecordNote}
                  onChange={e => setFbRecordNote(e.target.value)} placeholder="เช่น ตัดจาก Facebook Dashboard" />
              </div>
            </div>
            <div className="charge-modal-footer">
              <button className="btn-charge-cancel" onClick={() => setFbRecordModal(null)}>ยกเลิก</button>
              <button
                style={{ padding: '8px 20px', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: (!fbRecordCardId || !fbRecordDate || !fbRecordTime || !fbRecordAmount || fbRecordLoading) ? 'not-allowed' : 'pointer', background: (!fbRecordCardId || !fbRecordDate || !fbRecordTime || !fbRecordAmount || fbRecordLoading) ? '#bdbdbd' : '#1877f2' }}
                onClick={handleFbRecordConfirm}
                disabled={!fbRecordCardId || !fbRecordDate || !fbRecordTime || !fbRecordAmount || fbRecordLoading}
              >
                {fbRecordLoading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══ Modal: Google Ads — บันทึกการตัดสำหรับรายการที่เป็น Inv.Gg ══ */}
      {ggRecordModal && (
        <div className="charge-modal-backdrop" onClick={() => setGgRecordModal(null)}>
          <div className="charge-modal" onClick={e => e.stopPropagation()}>
            <div className="charge-modal-header" style={{ borderBottom: '3px solid #DB4437' }}>
              <h3 style={{ color: '#DB4437' }}>
                <PencilSquare size={14} style={{ marginRight: 6 }} />
                บันทึกการตัดเงิน — Invoice Google
              </h3>
              <button className="charge-modal-close" onClick={() => setGgRecordModal(null)}><X size={18} /></button>
            </div>
            <div className="charge-modal-body">
              <div className="charge-info-row"><span className="charge-info-label">บัญชี</span><span className="charge-info-value">{ggRecordModal.accountName}</span></div>
              <div className="charge-info-row"><span className="charge-info-label">CID</span><span className="charge-info-value">{ggRecordModal.customerCode}</span></div>
              <div className="charge-info-row">
                <span className="charge-info-label">ยอด Invoice</span>
                <span className="charge-info-value"><strong style={{ color: '#DB4437' }}>{formatNumber(ggRecordModal.invGG || (getBreakdownAmount(ggRecordModal, 14) + getBreakdownAmount(ggRecordModal, 11)))} บาท</strong></span>
              </div>
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff8f0', borderRadius: 4, fontSize: '0.78rem', color: '#6d4c00', lineHeight: 1.6 }}>
                📋 รายการนี้ถูกบันทึกเป็น Invoice แล้ว — บันทึกการตัดเพื่อระบุว่าบริษัทได้ตัดบัตรเรียบร้อย
              </div>
              <div className="charge-form-group">
                <label>บัตรที่ Google ตัด</label>
                <select value={ggRecordCardId} onChange={e => setGgRecordCardId(e.target.value)}>
                  <option value="">— เลือกบัตร —</option>
                  {cards.map(c => (
                    <option key={c._id} value={c._id}>{c.displayName} (ท้าย {c.last4})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>วันที่ Google ตัด</label>
                  <input type="date" className="charge-time-input" value={ggRecordDate} onChange={e => setGgRecordDate(e.target.value)} />
                </div>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>เวลาที่ตัด</label>
                  <input type="text" className="charge-time-input" placeholder="เช่น 08:00" value={ggRecordTime}
                    onChange={e => setGgRecordTime(e.target.value.replace(/[^0-9:.]/g, '').replace(/\./g, ':'))} maxLength={5} />
                </div>
              </div>
            </div>
            <div className="charge-modal-footer">
              <button className="btn-charge-cancel" onClick={() => setGgRecordModal(null)}>ยกเลิก</button>
              <button
                style={{ padding: '8px 20px', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: (!ggRecordCardId || !ggRecordDate || !ggRecordTime || ggRecordLoading) ? 'not-allowed' : 'pointer', background: (!ggRecordCardId || !ggRecordDate || !ggRecordTime || ggRecordLoading) ? '#bdbdbd' : '#DB4437' }}
                onClick={async () => {
                  if (!ggRecordCardId || !ggRecordDate || !ggRecordTime) { toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน'); return; }
                  try {
                    setGgRecordLoading(true);
                    const selectedCard = cards.find(c => c._id === ggRecordCardId);
                    const amount = Number(ggRecordModal.invGG || getBreakdownAmount(ggRecordModal, 14) + getBreakdownAmount(ggRecordModal, 11) || 0);
                    // 1. สร้าง Card charge record
                    await axios.post(`${api}/api/cards/charge`, {
                      cardId: ggRecordCardId,
                      amount: amount,
                      channel: 'Google Ads',
                      note: `Invoice Google ตัดเงิน: ${ggRecordModal.accountName}`,
                      serviceId: ggRecordModal.serviceId,
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    // 2. อัพเดต Transaction ว่าเป็น cardCharged
                    await axios.patch(`${api}/api/ledger/${ggRecordModal._id}`, {
                      cardCharged: true,
                      cardNumber: selectedCard?.last4 || '',
                      cardTime: ggRecordTime,
                      cardDate: ggRecordDate,
                    }, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success('บันทึกการตัดของ Google สำเร็จ');
                    setGgRecordModal(null);
                    fetchLedger(currentPage);
                  } catch (err) {
                    toast.error(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
                  } finally { setGgRecordLoading(false); }
                }}
                disabled={!ggRecordCardId || !ggRecordDate || !ggRecordTime || ggRecordLoading}
              >
                {ggRecordLoading ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={chargeAsInvGG} onChange={e => setChargeAsInvGG(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>inv.Gg (บันทึกเป็น Invoice แทนการตัดบัตร)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>วันที่ตัดบัตร</label>
                  <input
                    type="date"
                    className="charge-time-input"
                    value={chargeDate}
                    onChange={e => setChargeDate(e.target.value)}
                  />
                </div>
                <div className="charge-form-group" style={{ flex: 1 }}>
                  <label>เวลาที่ตัดเงิน</label>
                  <input
                    type="text"
                    className="charge-time-input"
                    placeholder="เช่น 14:30"
                    value={chargeTime}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9:.]/g, '').replace(/\./g, ':');
                      setChargeTime(v);
                    }}
                    maxLength={5}
                  />
                </div>
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
              <button className="btn-charge-confirm" onClick={handleChargeConfirm} disabled={!chargeCardId || !chargeDate || !chargeTime || !chargeAmount || chargingId}>
                {chargingId ? 'กำลังดำเนินการ...' : 'ยืนยันตัดเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
