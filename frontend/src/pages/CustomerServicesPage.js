import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PeopleFill, Plus, TrashFill, PencilSquare, ArrowLeftCircleFill, EyeFill, ThreeDotsVertical, XCircle } from 'react-bootstrap-icons';
import './CustomerListPage.css'; // reuse table styles
import './CustomerServicesPage.css';
import './ImageGalleryPage.css'; // reuse btn-header-upload style for gradient blue button

export default function CustomerServicesPage() {
  const { id } = useParams(); // customer id
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  // form popup สำหรับสร้าง
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ 
    name: 'Google Ads', 
    status: 'รอกำเนิด', 
    notes: '', 
    pageUrl: '', 
    startDate: '', 
    dueDate: '',
    customerIdField: ''
  });
  const [editingId, setEditingId] = useState(null);
  // state สำหรับจำนวนวัน
  const [daysDiff, setDaysDiff] = useState('');
  // คำนวณจำนวนวันเมื่อวันที่เปลี่ยน
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
  const [editForm, setEditForm] = useState({ name: '', status: 'active', notes: '', startDate: '', dueDate: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null); // เก็บ ID ของ dropdown ที่เปิดอยู่
  const [showDetail, setShowDetail] = useState(false); // แสดง modal รายละเอียด
  const [selectedService, setSelectedService] = useState(null); // บริการที่เลือกดู
  const [isEditingInDetail, setIsEditingInDetail] = useState(false); // สถานะการแก้ไขใน modal รายละเอียด
  const [detailForm, setDetailForm] = useState({}); // form สำหรับแก้ไขใน modal รายละเอียด
  const [detailDaysDiff, setDetailDaysDiff] = useState(''); // จำนวนวันใน modal รายละเอียด
  const token = localStorage.getItem('token');

  const api = process.env.REACT_APP_API_URL;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      // ดึงข้อมูล customer
      const customerRes = await axios.get(`${api}/api/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setCustomer(customerRes.data);
      // ดึงบริการทั้งหมดของ customer
      const servicesRes = await axios.get(`${api}/api/customers/${id}/services`, { headers: { Authorization: `Bearer ${token}` } });
      setServices(servicesRes.data || []);
      setLoading(false);
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
      setLoading(false);
    }
  }, [api, id, token]);
  
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  // คำนวณจำนวนวันใน modal แก้ไข
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
  const payload = { ...form, status: typeof form.status === 'string' ? form.status.trim() : form.status };
      const res = await axios.post(`${api}/api/customers/${id}/services`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices([res.data, ...services]);
      setShowCreate(false);
      setForm({ 
        name: 'Google Ads', 
        status: 'รอกำเนิด', 
        notes: '', 
        pageUrl: '', 
        startDate: '', 
        dueDate: '',
        customerIdField: ''
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '';
      alert(`เพิ่มบริการไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  };

  const startEdit = (svc) => {
    setEditingId(svc._id);
    setEditForm({
      name: svc.name,
      status: svc.status,
      notes: svc.notes || '',
      startDate: svc.startDate ? new Date(svc.startDate).toISOString().slice(0,10) : '',
      dueDate: svc.dueDate ? new Date(svc.dueDate).toISOString().slice(0,10) : ''
    });
  };

  const saveEdit = async (svcId) => {
    try {
      const payload = { ...editForm };
      // ถ้าเป็นค่าว่าง ไม่ส่ง (backend จะไม่ override)
      if (!payload.startDate) delete payload.startDate;
      if (!payload.dueDate) delete payload.dueDate;
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
    try {
      await axios.delete(`${api}/api/services/${serviceToDelete}`, { headers: { Authorization: `Bearer ${token}` } });
      setServices(services.filter(s => s._id !== serviceToDelete));
      setShowDeleteConfirm(false);
      setServiceToDelete(null);
    } catch (err) {
      alert('ลบไม่สำเร็จ');
    }
  };

  const startDetailEdit = () => {
    setDetailForm({
      name: selectedService.name,
      pageUrl: selectedService.pageUrl || '',
      customerIdField: selectedService.customerIdField || '',
      status: selectedService.status,
      startDate: selectedService.startDate ? new Date(selectedService.startDate).toISOString().slice(0,10) : '',
      dueDate: selectedService.dueDate ? new Date(selectedService.dueDate).toISOString().slice(0,10) : '',
      notes: selectedService.notes || ''
    });
    setIsEditingInDetail(true);
  };

  const saveDetailEdit = async () => {
    try {
      const payload = { ...detailForm };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.dueDate) delete payload.dueDate;
      const res = await axios.put(`${api}/api/services/${selectedService._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices(services.map(s => s._id === selectedService._id ? res.data : s));
      setSelectedService(res.data);
      setIsEditingInDetail(false);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const cancelDetailEdit = () => {
    setIsEditingInDetail(false);
    setDetailForm({});
  };

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header" style={{ color: '#dc3545' }}>
          <h3 style={{ margin: 0 }}>ยืนยันการลบบริการ</h3>
        </div>
        <div className="modal-body">คุณแน่ใจหรือไม่ว่าต้องการลบบริการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteConfirm(false)}><XCircle /> ยกเลิก</button>
          <button className="btn btn-danger" type="button" onClick={confirmDelete}>ยืนยันลบ</button>
        </div>
      </div>
    </div> 
  );

  return (
    <div className="customer-list-page fade-up">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
        <div className="list-header">
          <div className="list-header-title-group">
            <PeopleFill className="list-header-icon" />
            <h2 className="list-header-title">{customer ? customer.name : '...'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/dashboard/list" className="btn btn-sm btn-back"><ArrowLeftCircleFill /> กลับ</Link>
            <button className="btn-header-upload" onClick={() => setShowCreate(true)}><Plus /> เพิ่มบริการ</button>
          </div>
        </div>
        {customer && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f7fa', borderRadius: 8 }}>
            <strong>โทร:</strong> {customer.phone} {customer.service && <em style={{ marginLeft: 8, color: '#888' }}>(บริการเดิม: {customer.service})</em>}
          </div>
        )}
        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
        {showCreate && (
          <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>เพิ่มบริการใหม่</h3>
              <form onSubmit={handleCreate} className="svc-form">
                <label>
                  บริการ
                  <select value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Facebook Ads">Facebook Ads</option>
                  </select>
                </label>
                <label>
                  Website / Facebook Page
                  <input type="text" value={form.pageUrl} onChange={e => setForm({ ...form, pageUrl: e.target.value })} placeholder="" />
                </label>
                <div className="svc-row-2">
                  <label>
                    วันที่เริ่มต้น
                    <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  </label>
                  <label>
                    วันที่ครบกำหนด
                    <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                    {form.startDate && form.dueDate && daysDiff !== '' && (
                      <div style={{ fontSize: '0.95em', color: '#1a7f37', marginTop: 4 }}>
                        รวม {daysDiff} วัน
                      </div>
                    )}
                  </label>
                </div>
                <label>
                  Customer ID
                  <input type="text" value={form.customerIdField} onChange={e => setForm({ ...form, customerIdField: e.target.value })} placeholder="" />
                </label>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>สถานะ</label>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="รอคิวทำเว็บ"
                        checked={form.status === 'รอคิวทำเว็บ'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
                      <span>รอคิวทำเว็บ</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="รอคิวสร้างบัญชี"
                        checked={form.status === 'รอคิวสร้างบัญชี'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
                      <span>รอคิวสร้างบัญชี</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="รอลูกค้าส่งข้อมูล"
                        checked={form.status === 'รอลูกค้าส่งข้อมูล'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
                      <span>รอลูกค้าส่งข้อมูล</span>
                    </label>
                  </div>
                </div>
                <label>
                  note
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
                </label>
                <div className="svc-actions">
                  <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowCreate(false)}>
                    <XCircle /> ยกเลิก
                  </button>
                  <button type="submit" className="btn-modal btn-modal-save">
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal แสดงรายละเอียดบริการ */}
        {showDetail && selectedService && (
          <div className="svc-modal-overlay" onClick={() => { if (!isEditingInDetail) setShowDetail(false); }}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h3 style={{ marginTop: 0, marginBottom: 20 }}>รายละเอียดบริการ</h3>
              
              {!isEditingInDetail ? (
                <>
                  <div style={{ marginBottom: 12 }}><strong>บริการ:</strong> {selectedService.name}</div>
                  <div style={{ marginBottom: 12 }}><strong>Website / Facebook Page:</strong> {selectedService.pageUrl || '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>Customer ID:</strong> {selectedService.customerIdField || '-'}</div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>สถานะ:</strong>{' '}
                    <span className={
                      `badge-status ` +
                      (selectedService.status === 'รอคิวทำเว็บ' ? 'web' :
                       selectedService.status === 'รอคิวสร้างบัญชี' ? 'account' :
                       selectedService.status === 'รอลูกค้าส่งข้อมูล' ? 'waitinfo' :
                       selectedService.status === 'กำลังรันโฆษณา' ? 'running' :
                       '')
                    }>
                      {selectedService.status}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}><strong>วันที่เริ่มต้น:</strong> {selectedService.startDate ? new Date(selectedService.startDate).toLocaleDateString('th-TH') : '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>วันที่ครบกำหนด:</strong> {selectedService.dueDate ? new Date(selectedService.dueDate).toLocaleDateString('th-TH') : '-'}</div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>จำนวนวัน:</strong> {selectedService.startDate && selectedService.dueDate ? (() => {
                      const start = new Date(selectedService.startDate);
                      const end = new Date(selectedService.dueDate);
                      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                      return diff >= 0 ? `${diff} วัน` : '-';
                    })() : '-'}
                  </div>
                  <div style={{ marginBottom: 12 }}><strong>note:</strong> {selectedService.notes || '-'}</div>
                  <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-modal btn-modal-save" onClick={startDetailEdit}>
                      <PencilSquare /> แก้ไข
                    </button>
                    <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowDetail(false)}>
                      ปิด
                    </button>
                  </div>
                </>
              ) : (
                <form className="svc-form" onSubmit={(e) => { e.preventDefault(); saveDetailEdit(); }}>
                  <label>
                    บริการ
                    <input type="text" value={detailForm.name} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                  </label>
                  <label>
                    Website / Facebook Page
                    <input type="text" value={detailForm.pageUrl} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                  </label>
                  <label>
                    Customer ID
                    <input type="text" value={detailForm.customerIdField} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                  </label>
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
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="รอคิวทำเว็บ"
                          checked={detailForm.status === 'รอคิวทำเว็บ'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>รอคิวทำเว็บ</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="รอคิวสร้างบัญชี"
                          checked={detailForm.status === 'รอคิวสร้างบัญชี'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>รอคิวสร้างบัญชี</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="รอลูกค้าส่งข้อมูล"
                          checked={detailForm.status === 'รอลูกค้าส่งข้อมูล'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>รอลูกค้าส่งข้อมูล</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="กำลังรันโฆษณา"
                          checked={detailForm.status === 'กำลังรันโฆษณา'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>กำลังรันโฆษณา</span>
                      </label>
                    </div>
                  </div>
                  <label>
                    note
                    <textarea value={detailForm.notes} onChange={e => setDetailForm({ ...detailForm, notes: e.target.value })} rows={3} />
                  </label>
                  <div className="svc-actions">
                    <button type="button" className="btn-modal btn-modal-cancel" onClick={cancelDetailEdit}>
                      <XCircle /> ยกเลิก
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

        <div className="table-responsive">
          <table className="customer-table">
            <thead>
              <tr>
                <th>บริการ</th>
                <th>Customer ID</th>
                <th>สถานะ</th>
                <th>เริ่ม</th>
                <th>ครบกำหนด</th>
                <th>จำนวนวัน</th>
                <th>Website / Facebook Page</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-5">กำลังโหลด...</td></tr>
              ) : services.length > 0 ? (
                services.map((svc) => {
                  // ตรวจสอบว่าบริการหมดอายุหรือไม่
                  const isExpired = svc.dueDate && new Date(svc.dueDate) < new Date();
                  
                  return (
                    <tr key={svc._id} className={isExpired ? 'expired-service' : ''}>
                      <td>
                        {editingId === svc._id ? (
                          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                        ) : svc.name}
                      </td>
                    <td>{svc.customerIdField || '-'}</td>
                    <td>
                      {editingId === svc._id ? (
                        <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                          <option value="รอคิวทำเว็บ">รอคิวทำเว็บ</option>
                          <option value="รอคิวสร้างบัญชี">รอคิวสร้างบัญชี</option>
                          <option value="รอลูกค้าส่งข้อมูล">รอลูกค้าส่งข้อมูล</option>
                        </select>
                      ) : (
                        <span className={
                          `badge-status ` +
                          (svc.status === 'รอคิวทำเว็บ' ? 'web' :
                           svc.status === 'รอคิวสร้างบัญชี' ? 'account' :
                           svc.status === 'รอลูกค้าส่งข้อมูล' ? 'waitinfo' :
                           svc.status === 'กำลังรันโฆษณา' ? 'running' :
                           '')
                        }>
                          {svc.status}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === svc._id ? (
                        <input
                          type="date"
                          value={editForm.startDate || ''}
                          onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                        />
                      ) : (
                        svc.startDate ? new Date(svc.startDate).toLocaleDateString('th-TH') : '-'
                      )}
                    </td>
                    <td>
                      {editingId === svc._id ? (
                        <input
                          type="date"
                          value={editForm.dueDate || ''}
                          onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })}
                        />
                      ) : (
                        svc.dueDate ? new Date(svc.dueDate).toLocaleDateString('th-TH') : '-'
                      )}
                    </td>
                    <td>
                      {svc.startDate && svc.dueDate ? (
                        (() => {
                          const start = new Date(svc.startDate);
                          const end = new Date(svc.dueDate);
                          const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                          return diff >= 0 ? `${diff} วัน` : '-';
                        })()
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'left' }}>{svc.pageUrl || '-'}</td>
                    <td>
                      {editingId === svc._id ? (
                        <>
                          <button className="btn btn-view-details" onClick={() => saveEdit(svc._id)}>บันทึก</button>{' '}
                          <button className="btn btn-edit" onClick={() => setEditingId(null)}><XCircle /> ยกเลิก</button>
                        </>
                      ) : (
                        <div className="dropdown-container">
                          <button 
                            className="btn-dropdown-toggle" 
                            onClick={(e) => {
                              setOpenDropdown(openDropdown === svc._id ? null : svc._id);
                            }}
                          >
                            <ThreeDotsVertical />
                          </button>
                          {openDropdown === svc._id && (
                            <div className="dropdown-menu-custom">
                              <button className="dropdown-item" onClick={() => { setSelectedService(svc); setShowDetail(true); setOpenDropdown(null); }}>
                                <EyeFill /> ดูรายละเอียด
                              </button>
                              <button className="dropdown-item" onClick={() => { navigate(`/dashboard/services/${svc._id}/transactions`); setOpenDropdown(null); }}>
                                <EyeFill style={{ opacity: 0.7 }} /> ประวัติการโอน
                              </button>
                              <button className="dropdown-item danger" onClick={() => { askDelete(svc._id); setOpenDropdown(null); }}>
                                <TrashFill /> ลบ
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr><td colSpan="7" className="text-center p-5">ยังไม่มีบริการ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
