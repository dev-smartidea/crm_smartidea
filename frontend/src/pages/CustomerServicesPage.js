import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PeopleFill, Plus, TrashFill, PencilSquare, ArrowLeftCircleFill } from 'react-bootstrap-icons';
import './CustomerListPage.css'; // reuse table styles
import './CustomerServicesPage.css';

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
  const [editForm, setEditForm] = useState({ name: '', status: 'active', notes: '', startDate: '', dueDate: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const api = process.env.REACT_APP_API_URL;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [custRes, svcRes] = await Promise.all([
        axios.get(`${api}/api/customers/${id}`, authHeaders),
        axios.get(`${api}/api/customers/${id}/services`, authHeaders)
      ]);
      setCustomer(custRes.data);
      setServices(svcRes.data);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [api, id, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header" style={{ color: '#dc3545' }}>
          <h3 style={{ margin: 0 }}>ยืนยันการลบบริการ</h3>
        </div>
        <div className="modal-body">คุณแน่ใจหรือไม่ว่าต้องการลบบริการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</button>
          <button className="btn btn-danger" type="button" onClick={confirmDelete}>ยืนยันลบ</button>
        </div>
      </div>
    </div> 
  );

  return (
    <div className="customer-list-page">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
        <div className="list-header">
          <div className="list-header-title-group">
            <PeopleFill className="list-header-icon" />
            <h2 className="list-header-title">{customer ? customer.name : '...'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/dashboard/list" className="btn btn-sm btn-secondary"><ArrowLeftCircleFill /> กลับ</Link>
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}><Plus /> เพิ่มบริการ</button>
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
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowCreate(false)}>ยกเลิก</button>
                  <button type="submit" className="btn btn-sm btn-success">บันทึก</button>
                </div>
              </form>
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
                <th>บันทึก</th>
                <th>Website / Facebook Page</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center p-5">กำลังโหลด...</td></tr>
              ) : services.length > 0 ? (
                services.map(svc => (
                  <tr key={svc._id}>
                    <td>
                      {editingId === svc._id ? (
                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      ) : svc.name}
                    </td>
                    <td>{svc.customerIdField || '-'}</td>
                    <td>
                      {editingId === svc._id ? (
                        <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                          {/* ตัวเลือกตามฟอร์มเพิ่มบริการ */}
                          <option value="รอคิวทำเว็บ">รอคิวทำเว็บ</option>
                          <option value="รอคิวสร้างบัญชี">รอคิวสร้างบัญชี</option>
                          <option value="รอลูกค้าส่งข้อมูล">รอลูกค้าส่งข้อมูล</option>
                          {/* เผื่อกรณีข้อมูลเก่าที่เป็นค่าอังกฤษให้เลือก/แสดงได้ */}
                        </select>
                      ) : (
                        {
                          active: 'กำลังทำ',
                          paused: 'พักชั่วคราว',
                          completed: 'เสร็จสิ้น'
                        }[svc.status] || svc.status
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
                      {editingId === svc._id ? (
                        <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                      ) : (svc.notes || '-')}
                    </td>
                    <td>{svc.pageUrl || '-'}</td>
                    <td>
                      {editingId === svc._id ? (
                        <>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => saveEdit(svc._id)}>บันทึก</button>{' '}
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>ยกเลิก</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(svc)}><PencilSquare /> แก้ไข</button>{' '}
                          <button className="btn btn-sm btn-outline-danger" onClick={() => askDelete(svc._id)}><TrashFill /> ลบ</button>{' '}
                          <button className="btn btn-sm btn-outline-info" onClick={() => navigate(`/dashboard/services/${svc._id}/transactions`)}>ประวัติการโอน</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
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
