import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PeopleFill, Search, EyeFill, TrashFill, ExclamationTriangleFill, PersonCircle, ThreeDotsVertical, XCircle, ChevronDown, ChevronRight } from 'react-bootstrap-icons';
import { getImageUrl } from '../../utils/imageHelper';
import './CustomerListPage.css';

export default function CustomerListPage() {
  const navigate = useNavigate();

  // decode role
  let userRole = null;
  try {
    const _b64 = (localStorage.getItem('token') || '').split('.')[1] || '';
    const _norm = _b64.replace(/-/g, '+').replace(/_/g, '/');
    const _pl = JSON.parse(decodeURIComponent(atob(_norm).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    userRole = _pl.role || null;
  } catch {}

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [customerServices, setCustomerServices] = useState({});
  const [loadingServices, setLoadingServices] = useState(new Set());
  const api = process.env.REACT_APP_API_URL;

  const fetchCustomers = async (searchValue = '') => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.REACT_APP_API_URL}/api/customers?search=${encodeURIComponent(searchValue)}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDeleteClick = (id) => {
    setCustomerToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/customers/${customerToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
      fetchCustomers(search); // Refresh list
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchServices = async (customerId) => {
    if (customerServices[customerId] !== undefined) return;
    setLoadingServices(prev => { const s = new Set(prev); s.add(customerId); return s; });
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/api/customers/${customerId}/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomerServices(prev => ({ ...prev, [customerId]: res.data || [] }));
    } catch {
      setCustomerServices(prev => ({ ...prev, [customerId]: [] }));
    } finally {
      setLoadingServices(prev => { const s = new Set(prev); s.delete(customerId); return s; });
    }
  };

  const toggleCustomer = (customerId) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null);
    } else {
      setExpandedCustomer(customerId);
      fetchServices(customerId);
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'อยู่ระหว่างบริการ') return { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' };
    if (status === 'ครบกำหนด') return { background: '#fff7ed', color: '#92400e', border: '1px solid #fcd34d' };
    if (status?.includes('เกินกำหนด')) return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  };

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <ExclamationTriangleFill />
          <h3>ยืนยันการลบ</h3>
        </div>
        <div className="modal-body">
          คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้ารายนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="customer-list-page fade-up">
      {showDeleteConfirm && <DeleteConfirmModal />}
      <div className="list-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <PeopleFill />
              </div>
              <div>
                <h1>รายชื่อลูกค้า</h1>
                <p className="subtitle">จัดการและดูข้อมูลลูกค้าทั้งหมด</p>
              </div>
            </div>
            <div className="header-buttons">
              <div className="search-box">
            <Search className="search-icon" />
            <input
              type="text"
              className="form-control search-elevated"
              placeholder="ค้นหาลูกค้า"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                aria-label="ล้างคำค้นหา"
                title="ล้างคำค้นหา"
                onClick={() => setSearch('')}
              >
                <XCircle size={18} />
              </button>
            )}
          </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="customer-table">
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>รหัสลูกค้า</th>
                <th>สินค้า/บริการ</th>
                <th>ผู้ติดต่อ</th>
                <th>เบอร์โทรศัพท์</th>
                <th>วันที่เพิ่ม</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center p-5">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((cust) => (
                  <React.Fragment key={cust._id}>
                    <tr
                      className="customer-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleCustomer(cust._id)}
                    >
                      <td>
                        <div className="customer-info">
                          {expandedCustomer === cust._id
                            ? <ChevronDown size={13} style={{ marginRight: 5, color: '#1976d2', flexShrink: 0 }} />
                            : <ChevronRight size={13} style={{ marginRight: 5, color: '#adb5bd', flexShrink: 0 }} />
                          }
                          {cust.avatarUrl ? (
                            <img src={getImageUrl(cust.avatarUrl, api)} alt={cust.name} className="customer-avatar" />
                          ) : (
                            <div className="customer-avatar placeholder">
                              <PersonCircle size={32} />
                            </div>
                          )}
                          <span className="customer-name">{cust.name}</span>
                        </div>
                      </td>
                      <td>{cust._id?.slice(-5).toUpperCase() || '-'}</td>
                      <td>
                        {cust.productService ? (
                          <span className="badge badge-product" title={cust.productService}>
                            {cust.productService.length > 40 ? `${cust.productService.slice(0, 40)}…` : cust.productService}
                          </span>
                        ) : (
                          <span className="badge badge-product">-</span>
                        )}
                      </td>
                      <td>{cust.contactPerson || '-'}</td>
                      <td>{cust.phone}</td>
                      <td>{new Date(cust.createdAt).toLocaleDateString('th-TH')}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="dropdown-container">
                          <button
                            className="btn-dropdown-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdown((prev) => (prev === cust._id ? null : cust._id));
                            }}
                          >
                            <ThreeDotsVertical />
                          </button>
                          {openDropdown === cust._id && (
                            <div className="dropdown-menu-custom">
                              <button className="dropdown-item" onClick={() => { navigate(`/dashboard/customer/${cust._id}`); setOpenDropdown(null); }}>
                                <EyeFill /> ดูรายละเอียด
                              </button>
                              <button className="dropdown-item" onClick={() => { navigate(`/dashboard/customer/${cust._id}/services`); setOpenDropdown(null); }}>
                                <EyeFill /> บริการ
                              </button>
                              {['admin', 'google_manager', 'facebook_manager'].includes(userRole) && (
                                <button className="dropdown-item danger" onClick={() => { handleDeleteClick(cust._id); setOpenDropdown(null); }}>
                                  <TrashFill /> ลบ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedCustomer === cust._id && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: '#f8faff', borderLeft: '3px solid #1976d2', borderBottom: '2px solid #dbeafe' }}>
                          {loadingServices.has(cust._id) ? (
                            <div style={{ padding: '14px 24px', color: '#6c757d', fontSize: 13 }}>กำลังโหลดบริการ...</div>
                          ) : !customerServices[cust._id] || customerServices[cust._id].length === 0 ? (
                            <div style={{ padding: '14px 24px', color: '#adb5bd', fontSize: 13 }}>ไม่พบบริการ</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: '#eef4ff', borderBottom: '1px solid #dbeafe' }}>
                                  <th style={{ padding: '7px 12px 7px 24px', fontWeight: 600, color: '#1e40af', textAlign: 'left' }}>ประเภทบริการ</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'left' }}>CID</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'left' }}>เริ่มโฆษณา</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'left' }}>ครบกำหนด</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'center' }}>ระยะเวลา</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'left' }}>สถานะ</th>
                                  <th style={{ padding: '7px 12px', fontWeight: 600, color: '#1e40af', textAlign: 'right' }}>ค่าบริการ (฿)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {customerServices[cust._id].map((svc) => {
                                  const svcColor = svc.serviceType === 'Google Ads' ? '#4285F4' : svc.serviceType === 'Facebook Ads' ? '#1877f2' : '#6c757d';
                                  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                                  const calcMonths = () => {
                                    if (!svc.startDate || !svc.dueDate) return '-';
                                    const ms = new Date(svc.dueDate) - new Date(svc.startDate);
                                    if (ms <= 0) return '-';
                                    const months = Math.ceil(ms / (1000 * 60 * 60 * 24 * 30));
                                    return `${months} เดือน`;
                                  };
                                  return (
                                    <tr
                                      key={svc._id}
                                      style={{ borderBottom: '1px solid #e8edf8', cursor: 'pointer' }}
                                      onClick={() => navigate(`/dashboard/customer/${cust._id}/services`)}
                                    >
                                      <td style={{ padding: '8px 12px 8px 24px' }}>
                                        <span style={{
                                          background: svcColor, color: '#fff',
                                          borderRadius: 5, padding: '2px 9px', fontSize: 11.5, fontWeight: 600,
                                        }}>
                                          {svc.serviceType || svc.name || '-'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', color: '#374151', fontFamily: 'monospace' }}>
                                        {svc.cid || svc.customerIdField || '-'}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: '#6c757d' }}>
                                        {fmtDate(svc.startDate)}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: '#6c757d' }}>
                                        {fmtDate(svc.dueDate)}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#374151' }}>
                                        {calcMonths()}
                                      </td>
                                      <td style={{ padding: '8px 12px' }}>
                                        <span style={{
                                          ...getStatusStyle(svc.status),
                                          borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 500,
                                        }}>
                                          {svc.status || '-'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#1e40af' }}>
                                        {svc.price ? svc.price.toLocaleString('th-TH') : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center p-5">ไม่พบข้อมูลลูกค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
