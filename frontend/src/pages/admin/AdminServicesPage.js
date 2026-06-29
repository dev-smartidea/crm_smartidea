import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FaTools, FaPlus, FaTrashAlt, FaPencilAlt, FaEye, FaTimesCircle, FaExclamationTriangle, FaArrowLeft, FaListAlt } from 'react-icons/fa';
import './AdminServicesPage.css';

export default function AdminServicesPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // Get current user role from token
  const [userRole, setUserRole] = useState('');
  useEffect(() => {
    try {
      if (token) {
        const base64 = token.split('.')[1];
        const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(
          atob(normalized).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        ));
        setUserRole(payload.role || '');
      }
    } catch {
      setUserRole('');
    }
  }, [token]);

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const PAGE_SIZE = 20;

  const safeDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateThai = (val) => {
    const d = safeDate(val);
    return d ? d.toLocaleDateString('th-TH') : '-';
  };

  const toISOFormat = (val) => {
    const d = safeDate(val);
    return d ? d.toISOString().slice(0, 10) : '';
  };

  const monthDiff = (start, end) => {
    const s = safeDate(start);
    const e = safeDate(end);
    if (!s || !e) return null;
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    return months >= 0 ? months : null;
  };

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    serviceType: 'Google Ads',
    status: 'อยู่ระหว่างบริการ',
    acquisitionRole: 'sale',
    acquisitionPerson: 'จิมมี่',
    caretaker: '',
    ownership: 'ลูกค้า',
    price: '',
    notes: '',
    pageUrl: '',
    startDate: '',
    dueDate: '',
    cid: '',
    domain: '',
    hosting: '',
    customerId: ''
  });
  const [customers, setCustomers] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ serviceType: '', status: 'อยู่ระหว่างบริการ', notes: '', startDate: '', dueDate: '', price: '' });

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [isEditingInDetail, setIsEditingInDetail] = useState(false);
  const [detailForm, setDetailForm] = useState({});
  const [detailDaysDiff, setDetailDaysDiff] = useState('');

  // Calculate days diff for create form
  const [daysDiff, setDaysDiff] = useState('');
  useEffect(() => {
    if (form.startDate && form.dueDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.dueDate);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      setDaysDiff(diff >= 0 ? diff : '');
    } else {
      setDaysDiff('');
    }
  }, [form.startDate, form.dueDate]);

  // Calculate days diff for detail edit form
  useEffect(() => {
    if (detailForm.startDate && detailForm.dueDate) {
      const start = new Date(detailForm.startDate);
      const end = new Date(detailForm.dueDate);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      setDetailDaysDiff(diff >= 0 ? diff : '');
    } else {
      setDetailDaysDiff('');
    }
  }, [detailForm.startDate, detailForm.dueDate]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [servicesRes, customersRes, usersRes] = await Promise.all([
        axios.get(`${api}/api/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${api}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${api}/api/auth/users/list`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);
      setServices(servicesRes.data || []);
      setCustomers(customersRes.data || []);
      setUsersList(usersRes.data || []);
      setLoading(false);
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => { setPage(1); }, [search]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      // Filter based on userRole
      const type = s.serviceType || s.name || '';
      if (userRole === 'google_manager' && type !== 'Google Ads') {
        return false;
      }
      if (userRole === 'facebook_manager' && type !== 'Facebook Ads') {
        return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      const customerName = s.customerId?.name || '';
      const customerCode = s.customerId?.customerCode || '';
      const serviceType = s.serviceType || s.name || '';
      const cid = s.cid || s.customerIdField || '';
      const caretaker = s.caretaker || '';
      return customerName.toLowerCase().includes(q) ||
             customerCode.toLowerCase().includes(q) ||
             serviceType.toLowerCase().includes(q) ||
             cid.toLowerCase().includes(q) ||
             caretaker.toLowerCase().includes(q);
    });
  }, [services, search, userRole]);

  const sortedServices = useMemo(() => {
    if (!sortColumn) return filteredServices;
    
    return [...filteredServices].sort((a, b) => {
      let aVal, bVal;
      
      if (sortColumn === 'startDate') {
        aVal = safeDate(a.startDate)?.getTime() ?? 0;
        bVal = safeDate(b.startDate)?.getTime() ?? 0;
      } else if (sortColumn === 'dueDate') {
        aVal = safeDate(a.dueDate)?.getTime() ?? 0;
        bVal = safeDate(b.dueDate)?.getTime() ?? 0;
      } else {
        return 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }, [filteredServices, sortColumn, sortDirection]);
  const totalPages = Math.max(1, Math.ceil(sortedServices.length / PAGE_SIZE));
  const pagedServices = sortedServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async (e) => {
    e.preventDefault();
    const isWebsite = form.serviceType === 'เว็บไซต์';
    if (!form.customerId || !form.serviceType || !form.caretaker || !form.pageUrl || form.price === '' || !form.startDate || !form.dueDate || !form.cid) {
      alert('กรุณากรอกข้อมูลให้ครบทุกช่อง (ยกเว้น note)');
      return;
    }
    if (isWebsite && (!form.domain || !form.hosting)) {
      alert('กรุณากรอก Domain และ Hosting ให้ครบ');
      return;
    }

    try {
      const selectedUser = usersList.find(u => u.name === form.caretaker);
      const payload = {
        ...form,
        status: typeof form.status === 'string' ? form.status.trim() : form.status,
        name: form.serviceType,
        serviceType: form.serviceType,
        customerIdField: form.cid,
        cid: form.cid,
        price: form.price !== '' ? Number(form.price) : undefined,
        caretaker: form.caretaker || '',
        userId: selectedUser ? selectedUser._id : undefined,
      };
      const res = await axios.post(`${api}/api/customers/${form.customerId}/services`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices([res.data, ...services]);
      setShowCreate(false);
      setForm({
        serviceType: 'Google Ads',
        status: 'อยู่ระหว่างบริการ',
        acquisitionRole: 'sale',
        acquisitionPerson: 'จิมมี่',
        caretaker: '',
        ownership: 'ลูกค้า',
        price: '',
        notes: '',
        pageUrl: '',
        startDate: '',
        dueDate: '',
        cid: '',
        domain: '',
        hosting: '',
        customerId: ''
      });
    } catch (err) {
      const detail = err?.response?.data?.error || err?.response?.data?.detail || err?.message || '';
      alert(`เพิ่มบริการไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  };

  const saveEdit = async (svcId) => {
    try {
      const payload = { ...editForm };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.dueDate) delete payload.dueDate;
      if (payload.price === '' || payload.price === null) {
        delete payload.price;
      } else {
        payload.price = Number(payload.price);
      }
      const res = await axios.put(`${api}/api/services/${svcId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices(services.map(s => s._id === svcId ? res.data : s));
      setEditingId(null);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const askDelete = (svcId) => {
    setServiceToDelete(svcId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${api}/api/services/${serviceToDelete}`, { headers: { Authorization: `Bearer ${token}` } });
      setServices(services.filter(s => s._id !== serviceToDelete));
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    } catch (err) {
      alert('ลบไม่สำเร็จ');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDetail = (svc) => {
    setSelectedService(svc);
    setShowDetail(true);
    setIsEditingInDetail(false);
  };

  const startDetailEdit = () => {
    const role = selectedService.acquisitionRole || 'sale';
    const defaultPerson = role === 'admin' ? 'บิว' : 'จิมมี่';
    setDetailForm({
      serviceType: selectedService.serviceType || selectedService.name,
      pageUrl: selectedService.pageUrl || '',
      cid: selectedService.cid || selectedService.customerIdField || '',
      acquisitionRole: role,
      acquisitionPerson: selectedService.acquisitionPerson || defaultPerson,
      caretaker: selectedService.caretaker || '',
      ownership: selectedService.ownership || 'ลูกค้า',
      price: typeof selectedService.price === 'number' ? selectedService.price : '',
      status: selectedService.status,
      startDate: toISOFormat(selectedService.startDate),
      dueDate: toISOFormat(selectedService.dueDate),
      notes: selectedService.notes || ''
    });
    setIsEditingInDetail(true);
  };

  const saveDetailEdit = async () => {
    try {
      const payload = { ...detailForm };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.dueDate) delete payload.dueDate;
      if (payload.price === '' || payload.price === null) {
        delete payload.price;
      } else {
        payload.price = Number(payload.price);
      }
      const selectedUser = usersList.find(u => u.name === detailForm.caretaker);
      if (selectedUser) {
        payload.userId = selectedUser._id;
      }
      const res = await axios.put(`${api}/api/services/${selectedService._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices(services.map(s => s._id === selectedService._id ? res.data : s));
      setSelectedService(res.data);
      setIsEditingInDetail(false);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const getCustomerName = (customerId) => {
    const cust = customers.find(c => c._id === customerId);
    return cust ? `${cust.name} (${cust.customerCode})` : '-';
  };

  return (
    <div className="admin-services-page fade-up">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title-group">
            <div>
              <h1>บริการทั้งหมด</h1>
            </div>
          </div>
          <div className="header-buttons">
            <button className="btn-back" onClick={() => navigate('/dashboard/admin')}>
              <FaArrowLeft /> กลับ
            </button>
            <button className="btn-add-service" onClick={() => setShowCreate(true)}>
              <FaPlus /> เพิ่มบริการ
            </button>
          </div>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-section-card">
        <div className="table-toolbar">
          <input
            className="table-search-input"
            type="text"
            placeholder="ค้นหาลูกค้า, ประเภทบริการ, CID, ผู้ดูแล..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="table-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        <div className="admin-section-body">
          {loading ? (
            <div className="admin-loading">กำลังโหลด...</div>
          ) : filteredServices.length === 0 ? (
            <div className="table-empty">ยังไม่มีบริการ</div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ลูกค้า</th>
                    <th>ประเภทบริการ</th>
                    <th>CID</th>
                    <th>สถานะ</th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('startDate')}
                    >
                      เริ่ม {sortColumn === 'startDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="sortable-header"
                      onClick={() => handleSort('dueDate')}
                    >
                      ครบกำหนด {sortColumn === 'dueDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>จำนวนเดือน</th>
                    <th>ผู้ดูแล</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedServices.map((svc) => {
                    const dueD = safeDate(svc.dueDate);
                    const isExpired = dueD && dueD < new Date();
                    return (
                      <tr key={svc._id} className={isExpired ? 'expired-service' : ''}>
                        <td>
                          <Link to={`/dashboard/admin/customer/${svc.customerId?._id}`} className="customer-link">
                            {svc.customerId?.name || '-'}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{svc.customerId?.customerCode || ''}</div>
                        </td>
                        <td>
                          <span className={`badge badge-service ${
                            (svc.serviceType || svc.name) === 'Google Ads' ? 'badge-google' :
                            (svc.serviceType || svc.name) === 'Facebook Ads' ? 'badge-facebook' :
                            (svc.serviceType || svc.name) === 'เว็บไซต์' ? 'badge-website' :
                            'badge-other'
                          }`}>
                            {svc.serviceType || svc.name}
                          </span>
                        </td>
                        <td>{svc.cid || svc.customerIdField || '-'}</td>
                        <td>
                          <span className={`badge-status ${
                            svc.status === 'อยู่ระหว่างบริการ' ? 'inprogress' :
                            svc.status === 'เกินกำหนดมากกว่า 30 วัน' ? 'overdue30' :
                            svc.status === 'ครบกำหนด' ? 'due' : ''
                          }`}>
                            {svc.status}
                          </span>
                        </td>
                        <td>{formatDateThai(svc.startDate)}</td>
                        <td>{formatDateThai(svc.dueDate)}</td>
                        <td>
                          {monthDiff(svc.startDate, svc.dueDate) !== null ? `${monthDiff(svc.startDate, svc.dueDate)} เดือน` : '-'}
                        </td>
                        <td>{svc.caretaker || '-'}</td>
                        <td>
                          <div className="action-btn-group">
                            <button className="action-btn action-btn-blue" onClick={() => openDetail(svc)}>
                              <FaEye /> รายละเอียด
                            </button>
                            <button className="action-btn action-btn-amber" onClick={() => {
                              setEditForm({
                                serviceType: svc.serviceType || svc.name,
                                status: svc.status,
                                notes: svc.notes || '',
                                startDate: toISOFormat(svc.startDate),
                                dueDate: toISOFormat(svc.dueDate),
                                price: typeof svc.price === 'number' ? svc.price : ''
                              });
                              setEditingId(svc._id);
                            }}>
                              <FaPencilAlt /> แก้ไข
                            </button>
                            <button className="action-btn action-btn-red" onClick={() => askDelete(svc._id)}>
                              <FaTrashAlt /> ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="admin-pagination">
                  <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                  <span className="page-info">หน้า {page}/{totalPages}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Inline Edit Row */}
      {editingId && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon amber"><FaPencilAlt /></div>
              <h3 className="admin-modal-title">แก้ไขบริการ</h3>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingId); }}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-form-label">ประเภทบริการ</label>
                  <input className="admin-form-input" type="text" value={editForm.serviceType} onChange={e => setEditForm({ ...editForm, serviceType: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">สถานะ</label>
                  <select className="admin-form-select" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="อยู่ระหว่างบริการ">อยู่ระหว่างบริการ</option>
                    <option value="เกินกำหนดมากกว่า 30 วัน">เกินกำหนดมากกว่า 30 วัน</option>
                    <option value="ครบกำหนด">ครบกำหนด</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">วันที่เริ่มต้น</label>
                  <input className="admin-form-input" type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">วันที่ครบกำหนด</label>
                  <input className="admin-form-input" type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">ราคาบริการ (บาท)</label>
                  <input className="admin-form-input" type="number" min="0" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Note</label>
                  <textarea className="admin-form-input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="modal-btn modal-btn-cancel" onClick={() => setEditingId(null)}>
                  <FaTimesCircle /> ยกเลิก
                </button>
                <button type="submit" className="modal-btn modal-btn-primary">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Service Modal */}
      {showCreate && (
        <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>เพิ่มบริการใหม่</h3>
            <form onSubmit={handleCreate} className="svc-form">
              <label>
                ลูกค้า
                <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">เลือกลูกค้า</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.customerCode})</option>
                  ))}
                </select>
              </label>
              <label>
                ประเภทบริการ
                <select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value, domain: '', hosting: '' })} required>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Facebook Ads">Facebook Ads</option>
                  <option value="เว็บไซต์">เว็บไซต์</option>
                </select>
              </label>
              {form.serviceType === 'เว็บไซต์' && (
                <div className="svc-row-2">
                  <label>
                    Domain
                    <input type="text" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="เช่น example.com" required />
                  </label>
                  <label>
                    Hosting
                    <input type="text" value={form.hosting} onChange={e => setForm({ ...form, hosting: e.target.value })} placeholder="เช่น SiteGround" required />
                  </label>
                </div>
              )}
              <div className="svc-row-2">
                <label>
                  ช่องทางการได้มา
                  <select value={form.acquisitionRole} onChange={e => {
                    const newRole = e.target.value;
                    const defaultPerson = newRole === 'admin' ? 'บิว' : 'จิมมี่';
                    setForm({ ...form, acquisitionRole: newRole, acquisitionPerson: defaultPerson });
                  }}>
                    <option value="sale">ขายโดย sale</option>
                    <option value="admin">ขายโดย admin</option>
                  </select>
                </label>
                <label>
                  ผู้ขาย
                  <select value={form.acquisitionPerson} onChange={e => setForm({ ...form, acquisitionPerson: e.target.value })}>
                    {form.acquisitionRole === 'admin' ? (
                      <>
                        <option value="บิว">บิว</option>
                        <option value="น้ำ">น้ำ</option>
                        <option value="ครีม">ครีม</option>
                        <option value="มิกซ์">มิกซ์</option>
                        <option value="ปาน">ปาน</option>
                        <option value="อุ้ม">อุ้ม</option>
                      </>
                    ) : (
                      <>
                        <option value="จิมมี่">จิมมี่</option>
                        <option value="นุช">นุช</option>
                        <option value="โบ">โบ</option>
                        <option value="นุก">นุก</option>
                        <option value="ก้อย">ก้อย</option>
                        <option value="เอ๋">เอ๋</option>
                      </>
                    )}
                  </select>
                </label>
              </div>
              <label>
                ผู้ดูแล
                <select value={form.caretaker || ''} onChange={e => setForm({ ...form, caretaker: e.target.value })} required>
                  <option value="">เลือกผู้ดูแล</option>
                  {usersList.map(u => (
                    <option key={u._id} value={u.name}>{u.name} ({u.role}) - {u.username}</option>
                  ))}
                  {form.caretaker && !usersList.find(u => u.name === form.caretaker) && (
                    <option value={form.caretaker}>{form.caretaker} (ข้อมูลเดิม)</option>
                  )}
                </select>
              </label>
              <label>
                Website / Facebook Page
                <input type="text" value={form.pageUrl} onChange={e => setForm({ ...form, pageUrl: e.target.value })} placeholder="" required />
              </label>
              <div className="svc-row-2">
                <label>
                  สิทธิการเป็นเจ้าของ
                  <select value={form.ownership} onChange={e => setForm({ ...form, ownership: e.target.value })}>
                    <option value="ลูกค้า">ลูกค้า</option>
                    <option value="website ภายใต้บริษัท">website ภายใต้บริษัท</option>
                  </select>
                </label>
                <label>
                  ราคาบริการ (บาท)
                  <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </label>
              </div>
              <div className="svc-row-2">
                <label>
                  วันที่เริ่มต้น
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
                </label>
                <label>
                  วันที่ครบกำหนด
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
                  {form.startDate && form.dueDate && daysDiff !== '' && (
                    <div style={{ fontSize: '0.95em', color: '#1a7f37', marginTop: 4 }}>
                      รวม {daysDiff} วัน
                    </div>
                  )}
                </label>
              </div>
              <label>
                CID
                <input type="text" value={form.cid} onChange={e => setForm({ ...form, cid: e.target.value })} placeholder="" required />
              </label>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>สถานะ</label>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="radio" name="status" value="อยู่ระหว่างบริการ" checked={form.status === 'อยู่ระหว่างบริการ'} onChange={e => setForm({ ...form, status: e.target.value })} />
                    <span>อยู่ระหว่างบริการ</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="radio" name="status" value="เกินกำหนดมากกว่า 30 วัน" checked={form.status === 'เกินกำหนดมากกว่า 30 วัน'} onChange={e => setForm({ ...form, status: e.target.value })} />
                    <span>เกินกำหนดมากกว่า 30 วัน</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="radio" name="status" value="ครบกำหนด" checked={form.status === 'ครบกำหนด'} onChange={e => setForm({ ...form, status: e.target.value })} />
                    <span>ครบกำหนด</span>
                  </label>
                </div>
              </div>
              <label>
                note
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
              </label>
              <div className="svc-actions">
                <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreate(false)}>
                  <FaTimesCircle /> ยกเลิก
                </button>
                <button type="submit" className="btn-modal btn-modal-save" disabled={createLoading}>
                  {createLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Detail Modal */}
      {showDetail && selectedService && (
        <div className="svc-modal-overlay" onClick={() => { if (!isEditingInDetail) setShowDetail(false); }}>
          <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>รายละเอียดบริการ</h3>
            {!isEditingInDetail ? (
              <>
                <div style={{ marginBottom: 12 }}><strong>ลูกค้า:</strong> {getCustomerName(selectedService.customerId?._id)}</div>
                <div style={{ marginBottom: 12 }}><strong>ประเภทบริการ:</strong> {selectedService.serviceType || selectedService.name}</div>
                <div style={{ marginBottom: 12 }}><strong>ช่องทางการได้มา:</strong> {selectedService.acquisitionRole === 'admin' ? 'ขายโดย admin' : 'ขายโดย sale'}</div>
                <div style={{ marginBottom: 12 }}><strong>ผู้ขาย:</strong> {selectedService.acquisitionPerson || '-'}</div>
                <div style={{ marginBottom: 12 }}><strong>ผู้ดูแล:</strong> {selectedService.caretaker || '-'}</div>
                <div style={{ marginBottom: 12 }}><strong>สิทธิการเป็นเจ้าของ:</strong> {selectedService.ownership || '-'}</div>
                <div style={{ marginBottom: 12 }}><strong>Website / Facebook Page:</strong> {selectedService.pageUrl || '-'}</div>
                <div style={{ marginBottom: 12 }}><strong>CID:</strong> {selectedService.cid || selectedService.customerIdField || '-'}</div>
                <div style={{ marginBottom: 12 }}><strong>ราคาบริการ (บาท):</strong> {(
                  typeof selectedService.price === 'number' || selectedService.price === 0
                ) ? Number(selectedService.price).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '-'}</div>
                <div style={{ marginBottom: 12 }}>
                  <strong>สถานะ:</strong>{' '}
                  <span className={`badge-status ${
                    selectedService.status === 'อยู่ระหว่างบริการ' ? 'inprogress' :
                    selectedService.status === 'เกินกำหนดมากกว่า 30 วัน' ? 'overdue30' :
                    selectedService.status === 'ครบกำหนด' ? 'due' : ''
                  }`}>
                    {selectedService.status}
                  </span>
                </div>
                <div style={{ marginBottom: 12 }}><strong>วันที่เริ่มต้น:</strong> {formatDateThai(selectedService.startDate)}</div>
                <div style={{ marginBottom: 12 }}><strong>วันที่ครบกำหนด:</strong> {formatDateThai(selectedService.dueDate)}</div>
                <div style={{ marginBottom: 12 }}>
                  <strong>จำนวนเดือน:</strong> {monthDiff(selectedService.startDate, selectedService.dueDate) !== null ? (() => {
                    if (typeof selectedService.months === 'number') return `${selectedService.months} เดือน`;
                    return `${monthDiff(selectedService.startDate, selectedService.dueDate)} เดือน`;
                  })() : '-'}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong>จำนวนวัน:</strong> {(() => {
                    const s = safeDate(selectedService.startDate);
                    const e = safeDate(selectedService.dueDate);
                    if (!s || !e) return '-';
                    const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
                    return days >= 0 ? `${days} วัน` : '-';
                  })()}
                </div>
                <div style={{ marginBottom: 12 }}><strong>note:</strong> {selectedService.notes || '-'}</div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-modal btn-modal-save" onClick={startDetailEdit}>
                    <FaPencilAlt /> แก้ไข
                  </button>
                  <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowDetail(false)}>
                    ปิด
                  </button>
                </div>
              </>
            ) : (
              <form className="svc-form" onSubmit={(e) => { e.preventDefault(); saveDetailEdit(); }}>
                <label>
                  ประเภทบริการ
                  <input type="text" value={detailForm.serviceType} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                </label>
                <label>
                  Website / Facebook Page
                  <input type="text" value={detailForm.pageUrl} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                </label>
                <label>
                  CID
                  <input type="text" value={detailForm.cid} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                </label>
                <div className="svc-row-2">
                  <label>
                    ช่องทางการได้มา
                    <select value={detailForm.acquisitionRole} onChange={e => {
                      const newRole = e.target.value;
                      const defaultPerson = newRole === 'admin' ? 'บิว' : 'จิมมี่';
                      setDetailForm({ ...detailForm, acquisitionRole: newRole, acquisitionPerson: defaultPerson });
                    }}>
                      <option value="sale">ขายโดย sale</option>
                      <option value="admin">ขายโดย admin</option>
                    </select>
                  </label>
                  <label>
                    ผู้ขาย
                    <select value={detailForm.acquisitionPerson} onChange={e => setDetailForm({ ...detailForm, acquisitionPerson: e.target.value })}>
                      {detailForm.acquisitionRole === 'admin' ? (
                        <>
                          <option value="บิว">บิว</option>
                          <option value="น้ำ">น้ำ</option>
                          <option value="ครีม">ครีม</option>
                          <option value="มิกซ์">มิกซ์</option>
                          <option value="ปาน">ปาน</option>
                          <option value="อุ้ม">อุ้ม</option>
                        </>
                      ) : (
                        <>
                          <option value="จิมมี่">จิมมี่</option>
                          <option value="นุช">นุช</option>
                          <option value="โบ">โบ</option>
                          <option value="นุก">นุก</option>
                          <option value="ก้อย">ก้อย</option>
                          <option value="เอ๋">เอ๋</option>
                        </>
                      )}
                    </select>
                  </label>
                </div>
                <label>
                  ผู้ดูแล
                  <select value={detailForm.caretaker || ''} onChange={e => setDetailForm({ ...detailForm, caretaker: e.target.value })}>
                    <option value="">เลือกผู้ดูแล</option>
                    {usersList.map(u => (
                      <option key={u._id} value={u.name}>{u.name} ({u.role}) - {u.username}</option>
                    ))}
                    {detailForm.caretaker && !usersList.find(u => u.name === detailForm.caretaker) && (
                      <option value={detailForm.caretaker}>{detailForm.caretaker} (ข้อมูลเดิม)</option>
                    )}
                  </select>
                </label>
                <div className="svc-row-2">
                  <label>
                    สิทธิการเป็นเจ้าของ
                    <select value={detailForm.ownership} onChange={e => setDetailForm({ ...detailForm, ownership: e.target.value })}>
                      <option value="ลูกค้า">ลูกค้า</option>
                      <option value="website ภายใต้บริษัท">website ภายใต้บริษัท</option>
                    </select>
                  </label>
                  <label>
                    ราคาบริการ (บาท)
                    <input type="number" min="0" step="0.01" value={detailForm.price} onChange={e => setDetailForm({ ...detailForm, price: e.target.value })} />
                  </label>
                </div>
                <div className="svc-row-2">
                  <label>
                    วันที่เริ่มต้น
                    <input type="date" value={detailForm.startDate} onChange={e => setDetailForm({ ...detailForm, startDate: e.target.value })} />
                  </label>
                  <label>
                    วันที่ครบกำหนด
                    <input type="date" value={detailForm.dueDate} onChange={e => setDetailForm({ ...detailForm, dueDate: e.target.value })} />
                    {detailForm.startDate && detailForm.dueDate && detailDaysDiff !== '' && (
                      <div style={{ fontSize: '0.95em', color: '#1a7f37', marginTop: 4 }}>
                        รวม {detailDaysDiff} วัน
                      </div>
                    )}
                  </label>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>สถานะ</label>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="radio" name="detailStatus" value="อยู่ระหว่างบริการ" checked={detailForm.status === 'อยู่ระหว่างบริการ'} onChange={e => setDetailForm({ ...detailForm, status: e.target.value })} />
                      <span>อยู่ระหว่างบริการ</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="radio" name="detailStatus" value="เกินกำหนดมากกว่า 30 วัน" checked={detailForm.status === 'เกินกำหนดมากกว่า 30 วัน'} onChange={e => setDetailForm({ ...detailForm, status: e.target.value })} />
                      <span>เกินกำหนดมากกว่า 30 วัน</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="radio" name="detailStatus" value="ครบกำหนด" checked={detailForm.status === 'ครบกำหนด'} onChange={e => setDetailForm({ ...detailForm, status: e.target.value })} />
                      <span>ครบกำหนด</span>
                    </label>
                  </div>
                </div>
                <label>
                  note
                  <textarea value={detailForm.notes} onChange={e => setDetailForm({ ...detailForm, notes: e.target.value })} rows={3} />
                </label>
                <div className="svc-actions">
                  <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setIsEditingInDetail(false)}>
                    <FaTimesCircle /> ยกเลิก
                  </button>
                  <button type="submit" className="btn-modal btn-modal-save">
                    บันทึก
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-sm">
            <div className="admin-modal-header">
              <div className="admin-modal-header-icon red"><FaExclamationTriangle /></div>
              <h3 className="admin-modal-title">ยืนยันการลบบริการ</h3>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: '#374151', fontWeight: 600 }}>คุณแน่ใจหรือไม่ว่าต้องการลบบริการนี้?</p>
              <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                การกระทำนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                <FaTimesCircle /> ยกเลิก
              </button>
              <button className="modal-btn modal-btn-danger" onClick={confirmDelete} disabled={isDeleting}>
                <FaTrashAlt /> {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}