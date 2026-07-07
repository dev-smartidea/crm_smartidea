import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { CalendarCheck, ChevronLeft, ChevronRight, Funnel, X } from 'react-bootstrap-icons';
import './DueCustomersPage.css';

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTH_SHORT = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()}-${THAI_MONTH_SHORT[d.getMonth() + 1]}-${d.getFullYear() + 543}`;
}

function formatPrice(num) {
  if (num == null || num === '') return '-';
  return 'B' + Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function durationLabel(months) {
  if (!months) return null;
  return `${months} เดือน`;
}

function getBankClass(bank) {
  if (!bank) return 'bank-default';
  if (bank.includes('KBANK')) return 'bank-KBANK';
  if (bank.includes('SCB'))   return 'bank-SCB';
  if (bank.includes('BBL'))   return 'bank-BBL';
  if (bank.includes('KTB'))   return 'bank-KTB';
  if (bank.includes('TTB'))   return 'bank-TTB';
  if (bank.includes('BAY'))   return 'bank-BAY';
  return 'bank-default';
}

function getSvcClass(serviceType) {
  if (!serviceType) return 'svc-default';
  const t = serviceType.toLowerCase();
  if (t.includes('google'))   return 'svc-google';
  if (t.includes('facebook')) return 'svc-facebook';
  return 'svc-default';
}

export default function DueCustomersPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const token = localStorage.getItem('token');
  const api   = process.env.REACT_APP_API_URL;

  // decode role จาก token
  const currentRole = (() => {
    try {
      const base64 = token.split('.')[1];
      const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(
        atob(normalized).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      ));
      return payload.role || null;
    } catch { return null; }
  })();
  const isAdmin = ['admin', 'google_manager', 'facebook_manager', 'account'].includes(currentRole);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${api}/api/services/due-monthly`, {
        params: { month, year },
        headers: { Authorization: `Bearer ${token}` }
      });
      setServices(res.data || []);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [api, token, month, year]);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const [page, setPage] = useState(1);
  const [ownerFilter, setOwnerFilter]         = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const PAGE_SIZE = 20;

  // reset page เมื่อเปลี่ยนเดือนหรือ filter
  useEffect(() => { setPage(1); }, [month, year, ownerFilter, serviceTypeFilter, payStatusFilter]);

  // รายชื่อผู้ดูแลทั้งหมด (เพื่อสร้าง dropdown)
  // กรองตามบทบาทผู้จัดการตั้งแต่แรกเพื่อนำไปใช้งานต่อ
  const roleFilteredServices = useMemo(() => {
    return services.filter(s => {
      const type = s.serviceType || '';
      const owner = s.ownerName || '';
      
      if (currentRole === 'google_manager') {
        if (!type.toLowerCase().includes('google')) return false;
        const isGoogleUser = ['ครีม', 'น้ำ', 'บิว'].some(u => owner.includes(u));
        if (!isGoogleUser) return false;
      }
      if (currentRole === 'facebook_manager') {
        if (!type.toLowerCase().includes('facebook')) return false;
        const isFacebookUser = ['ปาน', 'มิกซ์', 'อุ้ม'].some(u => owner.includes(u));
        if (!isFacebookUser) return false;
      }
      return true;
    });
  }, [services, currentRole]);

  // รายชื่อผู้ดูแลทั้งหมด (เพื่อสร้าง dropdown)
  const ownerOptions = isAdmin
    ? [...new Map(roleFilteredServices.filter(s => s.ownerName).map(s => [s.ownerName, s.ownerName])).values()].sort()
    : [];

  // ประเภทบริการทั้งหมด
  const serviceTypeOptions = [...new Set(roleFilteredServices.map(s => s.serviceType).filter(Boolean))].sort();

  // กรองทั้ง 3 เงื่อนไข
  const filteredServices = roleFilteredServices
    .filter(s => !ownerFilter       || s.ownerName   === ownerFilter)
    .filter(s => !serviceTypeFilter || s.serviceType === serviceTypeFilter)
    .filter(s => {
      if (!payStatusFilter) return true;
      if (payStatusFilter === 'paid')   return !!s.lastTransaction;
      if (payStatusFilter === 'unpaid') return !s.lastTransaction;
      return true;
    });

  const totalCount      = filteredServices.length;
  const paidCount       = filteredServices.filter(s => s.lastTransaction).length;
  const unpaidCount     = totalCount - paidCount;
  const collectRate     = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const totalPages    = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagedServices = filteredServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // คำนวณเปอร์เซ็นต์เก็บค่าบริการแยกตามผู้ดูแล
  const caretakerStats = useMemo(() => {
    if (!isAdmin) return [];
    const statsMap = {};
    roleFilteredServices.forEach(s => {
      const owner = s.ownerName || 'ไม่มีผู้ดูแล';
      if (!statsMap[owner]) {
        statsMap[owner] = {
          ownerName: owner,
          totalCount: 0,
          paidCount: 0,
          totalAmount: 0,
          paidAmount: 0
        };
      }
      statsMap[owner].totalCount += 1;
      const price = Number(s.price) || 0;
      statsMap[owner].totalAmount += price;
      if (s.lastTransaction) {
        statsMap[owner].paidCount += 1;
        statsMap[owner].paidAmount += Number(s.lastTransaction.amount) || price;
      }
    });

    return Object.values(statsMap).map(stat => {
      const rate = stat.totalCount > 0 ? Math.round((stat.paidCount / stat.totalCount) * 100) : 0;
      return {
        ...stat,
        rate
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [roleFilteredServices, isAdmin]);

  return (
    <div className="due-customers-page">
      <div className="due-container">

        {/* ── Header ── */}
        <div className="due-page-header">
          <div className="due-header-left">
            <div className="due-page-header-icon">
              <CalendarCheck />
            </div>
            <div>
              <div className="due-month-title">{THAI_MONTHS[month]}</div>
              <h1>ลูกค้าครบกำหนด</h1>
              <p className="due-subtitle">
                บริการที่ครบกำหนดในเดือน {THAI_MONTHS[month]} {year + 543}
              </p>
            </div>
          </div>

          {/* Month navigator + filter btn */}
          <div className="month-nav-right">
            {isAdmin && (
              <button
                className={`due-btn-filter${showFilters ? ' active' : ''}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Funnel /> ตัวกรอง
              </button>
            )}
            <div className="month-nav">
              <button className="month-nav-btn" onClick={prevMonth} title="เดือนก่อนหน้า">
                <ChevronLeft />
              </button>
              <span className="month-nav-label">
                {THAI_MONTHS[month]} {year + 543}
              </span>
              <button className="month-nav-btn" onClick={nextMonth} title="เดือนถัดไป">
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>

        {/* ── Filter Panel (admin/account only) ── */}
        {isAdmin && showFilters && (
          <div className="due-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label>ผู้ดูแล</label>
                <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {ownerOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>ประเภทบริการ</label>
                <select value={serviceTypeFilter} onChange={e => setServiceTypeFilter(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {serviceTypeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>สถานะการชำระ</label>
                <select value={payStatusFilter} onChange={e => setPayStatusFilter(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  <option value="paid">ชำระแล้ว</option>
                  <option value="unpaid">ยังไม่ชำระ</option>
                </select>
              </div>
            </div>
            <div className="filter-actions">
              <button
                type="button"
                className="due-btn-clear"
                onClick={() => {
                  setOwnerFilter('');
                  setServiceTypeFilter('');
                  setPayStatusFilter('');
                  setShowFilters(false);
                }}
              >
                <X /> ล้างตัวกรอง
              </button>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="due-stats-row">
          <div className="due-stat-card s-total">
            <span className="stat-label">ทั้งหมด</span>
            <span className="stat-value">{totalCount}</span>
          </div>
          <div className="due-stat-card s-paid">
            <span className="stat-label">ชำระแล้ว</span>
            <span className="stat-value">{paidCount}</span>
          </div>
          <div className="due-stat-card s-unpaid">
            <span className="stat-label">ยังไม่ชำระ</span>
            <span className="stat-value">{unpaidCount}</span>
          </div>
          <div className="due-stat-card s-rate">
            <span className="stat-label">% การเก็บเงิน</span>
            <span className="stat-value">{collectRate}%</span>
          </div>
        </div>

        {/* ── Caretaker Collection Rate Summary (Admin Only) ── */}
        {isAdmin && caretakerStats.length > 0 && (
          <div className="caretaker-stats-card">
            <h3>📊 สรุปยอดเก็บค่าบริการรายบุคคล (ประจำเดือน)</h3>
            <div className="caretaker-stats-grid">
              {caretakerStats.map(stat => (
                <div className="caretaker-stat-item" key={stat.ownerName}>
                  <div className="caretaker-stat-header">
                    <span className="caretaker-name">{stat.ownerName}</span>
                    <span className="caretaker-rate">{stat.rate}%</span>
                  </div>
                  <div className="caretaker-progress-bar-bg">
                    <div 
                      className={`caretaker-progress-bar ${stat.rate >= 80 ? 'high' : stat.rate >= 50 ? 'medium' : 'low'}`} 
                      style={{ width: `${stat.rate}%` }}
                    />
                  </div>
                  <div className="caretaker-stat-details">
                    <span>เก็บแล้ว: {stat.paidCount}/{stat.totalCount} รายการ</span>
                    <span>ยอดเงิน: {formatPrice(stat.paidAmount)} / {formatPrice(stat.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="due-table-wrapper">
          {loading ? (
            <div className="due-loading">กำลังโหลดข้อมูล...</div>
          ) : error ? (
            <div className="due-empty">
              <span className="empty-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : services.length === 0 ? (
            <div className="due-empty">
              <span className="empty-icon">📅</span>
              <p>ไม่มีบริการที่ครบกำหนดในเดือน {THAI_MONTHS[month]} {year + 543}</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="due-empty">
              <span className="empty-icon">🔍</span>
              <p>ไม่พบรายการที่ตรงกับตัวกรองที่เลือก</p>
            </div>
          ) : (
            <table className="due-table">
              <thead>
                <tr>
                  <th className="col-center" style={{ width: 50 }}>ลำดับที่</th>
                  {isAdmin && <th>ผู้ดูแล</th>}
                  <th>บัญชี</th>
                  <th>รหัส</th>
                  <th>วันที่</th>
                  <th>ค่าบริการ</th>
                  <th>ระยะเวลา</th>
                  <th>วันที่ชำระค่าบริการ</th>
                  <th>ธนาคาร</th>
                  <th>ยอดชำระ</th>
                  <th>ค่าบริการ</th>
                  <th>ระยะเวลา</th>
                  <th>สถานะ</th>
                  <th className="col-pink">หมายเหตุ</th>
                  <th className="col-pink">หมายเหตุ -1</th>
                </tr>
              </thead>
              <tbody>
                {pagedServices.map((svc, idx) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + idx;
                  const tx      = svc.lastTransaction;
                  const renewed = !svc.isDueThisMonth;
                  // ระยะเวลา #1 = ถ้าต่ออายุแล้วและมี previousDurationMonths ให้แสดงของเดิม ไม่งั้นแสดงของปัจจุบัน
                  const dur1    = durationLabel(
                    renewed && svc.previousDurationMonths
                      ? svc.previousDurationMonths
                      : svc.durationMonths
                  );
                  // ระยะเวลา #2 = ระยะเวลาของการต่ออายุ (durationMonths ปัจจุบัน หลังต่ออายุ)
                  const dur2    = durationLabel(svc.durationMonths);
                  return (
                    <tr key={svc._id} className={renewed ? 'row-renewed' : ''}>
                      <td className="col-center row-num">{globalIdx + 1}</td>

                      {/* ผู้ดูแล — แสดงเฉพาะ admin */}
                      {isAdmin && (
                        <td>
                          <span className="owner-name">{svc.ownerName || '-'}</span>
                        </td>
                      )}

                      {/* บัญชี */}
                      <td>
                        <div className="cust-name-wrap">
                          <span className="cust-name" title={svc.customerName}>
                            {svc.customerName || '-'}
                          </span>
                          {renewed && <span className="renewed-badge">ต่ออายุแล้ว</span>}
                        </div>
                      </td>

                      {/* รหัส */}
                      <td>
                        <span className="cust-code">
                          {svc.cid || svc.customerCode || '-'}
                        </span>
                      </td>

                      {/* วันที่ (dueDate) */}
                      <td className="date-cell">{formatThaiDate(svc.dueDate)}</td>

                      {/* ค่าบริการ (contract) */}
                      <td className="price-cell">{formatPrice(svc.price)}</td>

                      {/* ระยะเวลา #1 — ระยะเวลาสัญญาเดิมก่อนต่ออายุ */}
                      <td>
                        {dur1
                          ? <span className="duration-badge">{dur1}</span>
                          : <span className="no-data">-</span>}
                      </td>

                      {/* วันที่ชำระล่าสุด */}
                      <td className="date-cell">
                        {tx
                          ? formatThaiDate(tx.transactionDate)
                          : <span className="no-data">-</span>}
                      </td>

                      {/* ธนาคาร */}
                      <td>
                        {tx
                          ? <span className={`bank-badge ${getBankClass(tx.bank)}`}>{tx.bank || '-'}</span>
                          : <span className="no-data">-</span>}
                      </td>

                      {/* ยอดชำระ */}
                      <td className="price-cell">
                        {tx
                          ? formatPrice(tx.amount)
                          : <span className="no-data">-</span>}
                      </td>

                      {/* ค่าบริการ #2 (repeated — ราคาต่ออายุ) */}
                      <td className="price-cell">
                        {tx ? formatPrice(svc.price) : <span className="no-data">-</span>}
                      </td>

                      {/* ระยะเวลา #2 — ระยะเวลาต่ออายุใหม่ */}
                      <td>
                        {tx && dur2
                          ? <span className="duration-badge">{dur2}</span>
                          : <span className="no-data">-</span>}
                      </td>

                      {/* สถานะ */}
                      <td>{svc.status || ''}</td>

                      {/* หมายเหตุ — serviceType */}
                      <td>
                        {svc.serviceType
                          ? <span className={`svc-type-badge ${getSvcClass(svc.serviceType)}`}>
                              {svc.serviceType}
                            </span>
                          : '-'}
                      </td>

                      {/* หมายเหตุ -1 — notes */}
                      <td className="notes-cell" title={svc.notes || ''}>
                        {svc.notes || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="due-pagination">
            <button
              className="page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >&laquo; ก่อนหน้า</button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => setPage(p)}
              >{p}</button>
            ))}

            <button
              className="page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >ถัดไป &raquo;</button>

            <span className="page-info">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} จาก {totalCount} รายการ
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

