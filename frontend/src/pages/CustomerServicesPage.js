import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PeopleFill, Plus, TrashFill, PencilSquare, ArrowLeftCircle, EyeFill, ThreeDotsVertical, XCircle, ExclamationTriangleFill } from 'react-bootstrap-icons';
import './CustomerListPage.css'; // reuse table styles
import './CustomerServicesPage.css';
import './ImageGalleryPage.css'; // reuse btn-header-upload style for gradient blue button

export default function CustomerServicesPage() {
  const { id } = useParams(); // customer id
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [services, setServices] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  // form popup สำหรับสร้าง
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ 
    serviceType: 'Google Ads', 
    status: 'อยู่ระหว่างบริการ', 
    acquisitionRole: 'sale',
    acquisitionPerson: 'นายก',
    ownership: 'ลูกค้า',
    price: '',
    notes: '', 
    pageUrl: '', 
    startDate: '', 
    dueDate: '',
    cid: ''
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
  const [editForm, setEditForm] = useState({ serviceType: '', status: 'อยู่ระหว่างบริการ', notes: '', startDate: '', dueDate: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
      // ดึงกิจกรรมทั้งหมดของ customer
      const activitiesRes = await axios.get(`${api}/api/customers/${id}/activities`, { headers: { Authorization: `Bearer ${token}` } });
      setActivities(activitiesRes.data || []);
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
    if (!form.serviceType) return;
    
    try {
      const payload = {
        ...form,
        status: typeof form.status === 'string' ? form.status.trim() : form.status,
        // เข้ากันได้ย้อนหลัง
        name: form.serviceType,
        serviceType: form.serviceType,
        customerIdField: form.cid,
        cid: form.cid,
        price: form.price !== '' ? Number(form.price) : undefined,
      };
      const res = await axios.post(`${api}/api/customers/${id}/services`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setServices([res.data, ...services]);
      setShowCreate(false);
      setForm({ 
        serviceType: 'Google Ads',
        status: 'อยู่ระหว่างบริการ',
        acquisitionRole: 'sale',
        acquisitionPerson: 'นายก',
        ownership: 'ลูกค้า',
        price: '',
        notes: '',
        pageUrl: '',
        startDate: '',
        dueDate: '',
        cid: ''
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '';
      alert(`เพิ่มบริการไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  };

  // (removed unused startEdit function to satisfy linter)

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

  const startDetailEdit = () => {
    setDetailForm({
      serviceType: selectedService.serviceType || selectedService.name,
      pageUrl: selectedService.pageUrl || '',
      cid: selectedService.cid || selectedService.customerIdField || '',
      acquisitionRole: selectedService.acquisitionRole || 'sale',
      acquisitionPerson: selectedService.acquisitionPerson || 'นายก',
      ownership: selectedService.ownership || 'ลูกค้า',
      price: typeof selectedService.price === 'number' ? selectedService.price : '',
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
      if (payload.price === '' || payload.price === null) {
        delete payload.price;
      } else {
        payload.price = Number(payload.price);
      }
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
        <div className="modal-header">
          <ExclamationTriangleFill />
          <h3>ยืนยันการลบ</h3>
        </div>
        <div className="modal-body">
          คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้ารายนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" type="button" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div> 
  );

  return (
    <div className="customer-list-page fade-up">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <PeopleFill />
              </div>
              <div>
                <h1>{customer ? customer.name : '...'}</h1>
                <p className="subtitle">จัดการบริการและกิจกรรมของลูกค้า</p>
              </div>
            </div>
            <div className="header-buttons">
              <Link to="/dashboard/list" className="btn btn-sm btn-back"><ArrowLeftCircle /> กลับ</Link>
              <button 
                className="btn-manage-activity" 
                onClick={() => navigate(`/dashboard/customers/${id}/activities`)}
              >
                จัดการกิจกรรม
              </button>
              <button 
                className="btn-add-service" 
                onClick={() => {
                  if (activities.length === 0) {
                    alert('กรุณาเพิ่มกิจกรรมก่อนเพิ่มบริการ');
                    return;
                  }
                  setShowCreate(true);
                }}
                disabled={activities.length === 0}
                style={{ opacity: activities.length === 0 ? 0.5 : 1 }}
              >
                <Plus /> เพิ่มบริการ
              </button>
            </div>
          </div>
        </div>
        {customer && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f7fa', borderRadius: 8 }}>
            <strong>โทร:</strong> {customer.phone} {customer.service && <em style={{ marginLeft: 8, color: '#888' }}>(บริการเดิม: {customer.service})</em>}
          </div>
        )}
        {activities.length === 0 && (
          <div style={{ marginBottom: '15px', padding: '15px', background: '#fff3cd', borderRadius: 8, color: '#856404' }}>
            ⚠️ กรุณาเพิ่มกิจกรรมก่อนเพิ่มบริการ กดปุ่ม "จัดการกิจกรรม" เพื่อเริ่มเพิ่มกิจกรรม
          </div>
        )}
        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
        {showCreate && (
          <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>เพิ่มบริการใหม่</h3>
              <form onSubmit={handleCreate} className="svc-form">
                <label>
                  ประเภทบริการ
                  <select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} required>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Facebook Ads">Facebook Ads</option>
                  </select>
                </label>
                <div className="svc-row-2">
                  <label>
                    ช่องทางการได้มา
                    <select value={form.acquisitionRole} onChange={e => setForm({ ...form, acquisitionRole: e.target.value })}>
                      <option value="sale">ขายโดย sale</option>
                      <option value="admin">ขายโดย admin</option>
                    </select>
                  </label>
                  <label>
                    ผู้ขาย/ผู้ดูแล
                    <select value={form.acquisitionPerson} onChange={e => setForm({ ...form, acquisitionPerson: e.target.value })}>
                      <option value="นายก">นายก</option>
                      <option value="นายข">นายข</option>
                    </select>
                  </label>
                </div>
                <label>
                  Website / Facebook Page
                  <input type="text" value={form.pageUrl} onChange={e => setForm({ ...form, pageUrl: e.target.value })} placeholder="" />
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
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                  </label>
                </div>
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
                  CID
                  <input type="text" value={form.cid} onChange={e => setForm({ ...form, cid: e.target.value })} placeholder="" />
                </label>
                  <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>สถานะ</label>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="อยู่ระหว่างบริการ"
                        checked={form.status === 'อยู่ระหว่างบริการ'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
                      <span>อยู่ระหว่างบริการ</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="เกินกำหนดมากกว่า 30 วัน"
                        checked={form.status === 'เกินกำหนดมากกว่า 30 วัน'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
                      <span>เกินกำหนดมากกว่า 30 วัน</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input 
                        type="radio" 
                        name="status" 
                        value="ครบกำหนด"
                        checked={form.status === 'ครบกำหนด'}
                        onChange={e => setForm({ ...form, status: e.target.value })}
                      />
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
                  <div style={{ marginBottom: 12 }}><strong>ประเภทบริการ:</strong> {selectedService.serviceType || selectedService.name}</div>
                  <div style={{ marginBottom: 12 }}><strong>ช่องทางการได้มา:</strong> {selectedService.acquisitionRole === 'admin' ? 'ขายโดย admin' : 'ขายโดย sale'}</div>
                  <div style={{ marginBottom: 12 }}><strong>ผู้ขาย/ผู้ดูแล:</strong> {selectedService.acquisitionPerson || '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>สิทธิการเป็นเจ้าของ:</strong> {selectedService.ownership || '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>Website / Facebook Page:</strong> {selectedService.pageUrl || '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>CID:</strong> {selectedService.cid || selectedService.customerIdField || '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>ราคาบริการ (บาท):</strong> {(
                    typeof selectedService.price === 'number' || selectedService.price === 0
                  ) ? Number(selectedService.price).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '-'}</div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>สถานะ:</strong>{' '}
                    <span className={
                      `badge-status ` + (
                        selectedService.status === 'อยู่ระหว่างบริการ' ? 'inprogress' :
                        selectedService.status === 'เกินกำหนดมากกว่า 30 วัน' ? 'overdue30' :
                        selectedService.status === 'ครบกำหนด' ? 'due' :
                        ''
                      )
                    }>
                      {selectedService.status}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}><strong>วันที่เริ่มต้น:</strong> {selectedService.startDate ? new Date(selectedService.startDate).toLocaleDateString('th-TH') : '-'}</div>
                  <div style={{ marginBottom: 12 }}><strong>วันที่ครบกำหนด:</strong> {selectedService.dueDate ? new Date(selectedService.dueDate).toLocaleDateString('th-TH') : '-'}</div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>จำนวนเดือน:</strong> {selectedService.startDate && selectedService.dueDate ? (() => {
                      if (typeof selectedService.months === 'number') return `${selectedService.months} เดือน`;
                      const s = new Date(selectedService.startDate);
                      const e = new Date(selectedService.dueDate);
                      const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
                      return months >= 0 ? `${months} เดือน` : '-';
                    })() : '-'}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>จำนวนวัน:</strong> {selectedService.startDate && selectedService.dueDate ? (() => {
                      const s = new Date(selectedService.startDate);
                      const e = new Date(selectedService.dueDate);
                      const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
                      return days >= 0 ? `${days} วัน` : '-';
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
                      <select value={detailForm.acquisitionRole} onChange={e => setDetailForm({ ...detailForm, acquisitionRole: e.target.value })}>
                        <option value="sale">ขายโดย sale</option>
                        <option value="admin">ขายโดย admin</option>
                      </select>
                    </label>
                    <label>
                      ผู้ขาย/ผู้ดูแล
                      <select value={detailForm.acquisitionPerson} onChange={e => setDetailForm({ ...detailForm, acquisitionPerson: e.target.value })}>
                        <option value="นายก">นายก</option>
                        <option value="นายข">นายข</option>
                      </select>
                    </label>
                  </div>
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
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="อยู่ระหว่างบริการ"
                          checked={detailForm.status === 'อยู่ระหว่างบริการ'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>อยู่ระหว่างบริการ</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="เกินกำหนดมากกว่า 30 วัน"
                          checked={detailForm.status === 'เกินกำหนดมากกว่า 30 วัน'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>เกินกำหนดมากกว่า 30 วัน</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input 
                          type="radio" 
                          name="detailStatus" 
                          value="ครบกำหนด"
                          checked={detailForm.status === 'ครบกำหนด'}
                          onChange={e => setDetailForm({ ...detailForm, status: e.target.value })}
                        />
                        <span>ครบกำหนด</span>
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
                <th>ประเภทบริการ</th>
                <th>CID</th>
                <th>สถานะ</th>
                <th>เริ่ม</th>
                <th>ครบกำหนด</th>
                <th>จำนวนเดือน</th>
                <th>Website / Facebook Page</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center p-5">กำลังโหลด...</td></tr>
              ) : services.length > 0 ? (
                services.map((svc) => {
                  // ตรวจสอบว่าบริการหมดอายุหรือไม่
                  const isExpired = svc.dueDate && new Date(svc.dueDate) < new Date();
                  
                  return (
                    <tr key={svc._id} className={isExpired ? 'expired-service' : ''}>
                      <td>{svc.serviceType || svc.name}</td>
                    <td>{svc.cid || svc.customerIdField || '-'}</td>
                    <td>
                      <span className={
                        `badge-status ` + (
                          svc.status === 'อยู่ระหว่างบริการ' ? 'inprogress' :
                          svc.status === 'เกินกำหนดมากกว่า 30 วัน' ? 'overdue30' :
                          svc.status === 'ครบกำหนด' ? 'due' :
                          ''
                        )
                      }>
                        {svc.status}
                      </span>
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
                          if (typeof svc.months === 'number') return `${svc.months} เดือน`;
                          const s = new Date(svc.startDate);
                          const e = new Date(svc.dueDate);
                          const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
                          return months >= 0 ? `${months} เดือน` : '-';
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
                              e.stopPropagation();
                              setOpenDropdown((prev) => (prev === svc._id ? null : svc._id));
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
                <tr><td colSpan="8" className="text-center p-5">ยังไม่มีบริการ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
