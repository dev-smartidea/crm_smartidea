import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaArrowLeft, FaSearch, FaFilter, FaUndo } from 'react-icons/fa';
import toast from '../../utils/toast';
import './AuditLogPage.css';

const ACTION_LABELS = {
  login:              { label: 'เข้าสู่ระบบ',           color: '#16a34a' },
  logout:             { label: 'ออกจากระบบ',             color: '#6b7280' },
  create_user:        { label: 'สร้างผู้ใช้',             color: '#2563eb' },
  delete_user:        { label: 'ลบผู้ใช้',               color: '#dc2626' },
  reset_password:     { label: 'รีเซ็ตรหัสผ่าน',         color: '#d97706' },
  change_role:        { label: 'เปลี่ยน Role',            color: '#7c3aed' },
  create_customer:    { label: 'เพิ่มลูกค้า',            color: '#0891b2' },
  delete_customer:    { label: 'ลบลูกค้า',               color: '#dc2626' },
  reassign_customer:  { label: 'โยกลูกค้า',              color: '#7c3aed' },
  create_service:     { label: 'สร้างบริการ',             color: '#2563eb' },
  update_service:     { label: 'แก้ไขบริการ',             color: '#d97706' },
  delete_service:     { label: 'ลบบริการ',               color: '#dc2626' },
  create_transaction: { label: 'สร้างรายการโอน',          color: '#0891b2' },
  update_transaction: { label: 'แก้ไขรายการโอน',          color: '#d97706' },
  delete_transaction: { label: 'ลบรายการโอน',            color: '#dc2626' },
  approve_transaction:{ label: 'อนุมัติรายการ',           color: '#16a34a' },
  reject_transaction: { label: 'ปฏิเสธรายการ',           color: '#dc2626' },
  bulk_approve:       { label: 'อนุมัติหลายรายการ',       color: '#10b981' },
  rollback_approve:   { label: 'ย้อนคืนการอนุมัติกลุ่ม', color: '#ef4444' },
  impersonate:        { label: 'เข้าสู่ระบบแทนผู้ใช้',   color: '#f59e0b' },
  backup:             { label: 'สำรองข้อมูล',             color: '#8b5cf6' },
};

const PAGE_SIZE = 20;

function AuditLogPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rollbackingId, setRollbackingId] = useState(null);

  // Filters
  const [filterUsername, setFilterUsername] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: p, limit: PAGE_SIZE };
      if (filterUsername.trim()) params.username = filterUsername.trim();
      if (filterAction) params.action = filterAction;
      if (filterStart) params.startDate = filterStart;
      if (filterEnd) params.endDate = filterEnd;

      const res = await axios.get(`${api}/api/audit`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [api, token, filterUsername, filterAction, filterStart, filterEnd]);

  useEffect(() => {
    fetchLogs(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleRollback = async (log) => {
    // parse id count from detail
    let count = 0;
    try {
      const parsed = JSON.parse(log.detail);
      count = (parsed.ids || []).length;
    } catch {}
    if (!window.confirm(
      `ยืนยันย้อนกลับ (Rollback) การอนุมัติกลุ่มนี้?\n\nรายการ ${count} รายการ จะถูกเปลี่ยนกลับเป็น "รออนุมัติ" และจะกลับไปแสดงที่หน้ารายการที่ส่งมาบัญชี\n\nดำเนินการนี้ไม่สามารถยกเลิกได้`
    )) return;
    try {
      setRollbackingId(log._id);
      const res = await axios.post(`${api}/api/audit/${log._id}/rollback`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Rollback สำเร็จ: ย้อนคืน ${res.data.revertedCount} รายการ กลับเป็น "รออนุมัติ" เรียบร้อยแล้ว`);
      fetchLogs(page);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Rollback ไม่สำเร็จ';
      toast.error(msg);
    } finally {
      setRollbackingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getCountFromDetail = (detail) => {
    try {
      const parsed = JSON.parse(detail);
      return (parsed.ids || []).length;
    } catch {
      return null;
    }
  };

  return (
    <div className="audit-page">
      {/* Header */}
      <div className="audit-header">
        <button className="audit-back-btn" onClick={() => navigate('/dashboard/admin')}>
          <FaArrowLeft /> กลับ
        </button>
        <h1 className="audit-title">Audit Log</h1>
        <span className="audit-total">{total.toLocaleString()} รายการ</span>
      </div>

      {/* Filter */}
      <form className="audit-filter-bar" onSubmit={handleSearch}>
        <div className="audit-filter-group">
          <FaSearch className="audit-filter-icon" />
          <input
            type="text"
            placeholder="ชื่อผู้ใช้..."
            value={filterUsername}
            onChange={e => setFilterUsername(e.target.value)}
          />
        </div>

        <div className="audit-filter-group">
          <FaFilter className="audit-filter-icon" />
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="audit-filter-group">
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
          <span className="audit-filter-sep">–</span>
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
        </div>

        <button type="submit" className="audit-search-btn">ค้นหา</button>
        <button type="button" className="audit-clear-btn" onClick={() => {
          setFilterUsername(''); setFilterAction(''); setFilterStart(''); setFilterEnd('');
          setTimeout(() => fetchLogs(1), 0);
        }}>ล้าง</button>
      </form>

      {/* Table */}
      {error && <div className="audit-error">{error}</div>}

      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>วันที่/เวลา</th>
              <th>ผู้ใช้</th>
              <th>การกระทำ</th>
              <th>เป้าหมาย</th>
              <th>รายละเอียด</th>
              <th>IP</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="audit-empty">กำลังโหลด...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="audit-empty">ไม่มีข้อมูล</td></tr>
            ) : logs.map(log => {
              const act = ACTION_LABELS[log.action] || { label: log.action, color: '#6b7280' };
              const isBulkApprove = log.action === 'bulk_approve';
              const txCount = isBulkApprove ? getCountFromDetail(log.detail) : null;
              return (
                <tr key={log._id}>
                  <td className="audit-td-date">{formatDate(log.createdAt)}</td>
                  <td className="audit-td-user">{log.username}</td>
                  <td>
                    <span className="audit-badge" style={{ background: act.color + '18', color: act.color, borderColor: act.color + '44' }}>
                      {act.label}
                    </span>
                  </td>
                  <td>{log.target || '–'}</td>
                  <td className="audit-td-detail">
                    {isBulkApprove && txCount !== null
                      ? <span style={{ color: '#10b981', fontWeight: 600 }}>อนุมัติ {txCount} รายการพร้อมกัน</span>
                      : log.action === 'rollback_approve'
                        ? <span style={{ color: '#ef4444', fontWeight: 600 }}>{log.detail ? (() => { try { const p = JSON.parse(log.detail); return `ย้อนคืน ${p.revertedCount} รายการ`; } catch { return log.detail; } })() : '–'}</span>
                        : (log.detail || '–')
                    }
                  </td>
                  <td className="audit-td-ip">{log.ip || '–'}</td>
                  <td>
                    {isBulkApprove && (
                      <button
                        className="audit-rollback-btn"
                        onClick={() => handleRollback(log)}
                        disabled={rollbackingId === log._id}
                        title="ย้อนคืนรายการทั้งหมดในกลุ่มนี้กลับเป็น รออนุมัติ"
                      >
                        {rollbackingId === log._id
                          ? <span className="audit-spinner" />
                          : <FaUndo />
                        }
                        {rollbackingId === log._id ? ' กำลัง...' : ' Rollback'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="audit-pagination">
          <button disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>‹ ก่อนหน้า</button>
          <span>หน้า {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>ถัดไป ›</button>
        </div>
      )}
    </div>
  );
}

export default AuditLogPage;

