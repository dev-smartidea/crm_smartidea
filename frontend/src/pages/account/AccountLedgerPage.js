import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  FileEarmarkSpreadsheet, Search, Download, 
  ChevronLeft, ChevronRight, Funnel, X,
  Google, Facebook
} from 'react-bootstrap-icons';
import './AccountLedgerPage.css';

const BANK_OPTIONS = ['KBANK', 'SCB', 'BBL', 'BAY-4396', 'BAY-7146', 'Cr.-8508', 'BBL-ส่วนตัว'];
const SERVICE_TYPES = ['Google Ads', 'Facebook Ads'];

export default function AccountLedgerPage() {
  const [ledgerData, setLedgerData] = useState([]);
  const [summary, setSummary] = useState({});
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

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchLedger = useCallback(async (page = 1) => {
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
        headers: { Authorization: `Bearer ${token}` }
      });

      setLedgerData(res.data.items || []);
      setSummary(res.data.summary || {});
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.page || 1);
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    } finally {
      setLoading(false);
    }
  }, [api, token, filters]);

  useEffect(() => {
    fetchLedger(1);
  }, [fetchLedger]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLedger(1);
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${api}/api/ledger/export`, {
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
      console.error('Export failed:', err);
      alert('Export ไม่สำเร็จ');
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
      setLedgerData(prev => prev.map(item => 
        item._id === editingCell.id 
          ? { ...item, [editingCell.field]: editValue || '-' }
          : item
      ));
    } catch (err) {
      console.error('Update failed:', err);
      alert('บันทึกไม่สำเร็จ');
    }
    
    setEditingCell(null);
    setEditValue('');
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
          <button className="btn-export" onClick={handleExport}>
            <Download /> Export CSV
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
          <div className="ledger-empty">ไม่พบข้อมูล</div>
        ) : (
          <div className="table-wrapper">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th className="col-index">#</th>
                  <th className="col-account">บัญชี</th>
                  <th className="col-code">รหัส</th>
                  <th className="col-bank">ธนาคาร</th>
                  <th className="col-date">วันที่</th>
                  <th className="col-time">เวลา</th>
                  <th className="col-amount">ยอดเงิน</th>
                  <th className="col-status">สถานะ</th>
                  <th className="col-card">บัตรเลขที่</th>
                  <th className="col-cardtime">เวลาที่ตัดบัตร</th>
                  <th className="col-gg">ลูกค้าใหม่ GG</th>
                  <th className="col-gg">ต่ออายุ GG</th>
                  <th className="col-fb">ลูกค้าใหม่ FB</th>
                  <th className="col-fb">ต่ออายุ FB</th>
                  <th className="col-click">ค่าคลิก</th>
                  <th className="col-prepaid">เบิกล่วงหน้า</th>
                  <th className="col-coupon">คูปอง</th>
                  <th className="col-inv">Inv. Gg</th>
                  <th className="col-inv">Inv. Fb</th>
                  <th className="col-vat">Vat 36</th>
                  <th className="col-vat">Vat 30</th>
                  <th className="col-net">ยอดสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.map((item) => (
                  <tr key={item._id} data-service={item.serviceType}>
                    <td className="col-index">{item.index}</td>
                    <td className="col-account" title={item.accountName}>{item.accountName}</td>
                    <td className="col-code">{item.customerCode}</td>
                    <td className="col-bank">{item.bank}</td>
                    <td className="col-date">{formatDate(item.transactionDate)}</td>
                    <td className="col-time">{item.transactionTime}</td>
                    <td className="col-amount">{formatNumber(item.amount)}</td>
                    <td className="col-status">{getStatusBadge(item.status)}</td>
                    <td 
                      className="col-card editable-cell"
                      onClick={() => handleCellClick(item._id, 'cardNumber', item.cardNumber)}
                    >
                      {editingCell?.id === item._id && editingCell?.field === 'cardNumber' ? (
                        <input
                          type="text"
                          className="inline-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                        />
                      ) : (
                        <span className="editable-text">{item.cardNumber}</span>
                      )}
                    </td>
                    <td 
                      className="col-cardtime editable-cell"
                      onClick={() => handleCellClick(item._id, 'cardTime', item.cardTime)}
                    >
                      {editingCell?.id === item._id && editingCell?.field === 'cardTime' ? (
                        <input
                          type="text"
                          className="inline-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          maxLength={5}
                          placeholder="00:00"
                        />
                      ) : (
                        <span className="editable-text">{item.cardTime}</span>
                      )}
                    </td>
                    <td className="col-gg">{formatNumber(item.newCustomerGG)}</td>
                    <td className="col-gg">{formatNumber(item.renewGG)}</td>
                    <td className="col-fb">{formatNumber(item.newCustomerFB)}</td>
                    <td className="col-fb">{formatNumber(item.renewFB)}</td>
                    <td className="col-click">{formatNumber(item.clickCost)}</td>
                    <td className="col-prepaid">{formatNumber(item.prepaid)}</td>
                    <td className="col-coupon">{formatNumber(item.coupon)}</td>
                    <td className="col-inv">{formatNumber(item.invGG)}</td>
                    <td className="col-inv">{formatNumber(item.invFB)}</td>
                    <td className="col-vat">{formatNumber(item.vat36)}</td>
                    <td className="col-vat">{formatNumber(item.vat30)}</td>
                    <td className="col-net">{formatNumber(item.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
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
    </div>
  );
}
