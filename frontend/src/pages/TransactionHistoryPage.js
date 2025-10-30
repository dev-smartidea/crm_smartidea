import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CashCoin, Plus, TrashFill, PencilSquare, ArrowLeftCircleFill, Bank2, ThreeDotsVertical, XCircle, Eye, Upload } from 'react-bootstrap-icons';
import '../pages/CustomerListPage.css'; // reuse table styles
import '../pages/CustomerServicesPage.css';
import './ImageGalleryPage.css'; // reuse gradient blue button (.btn-header-upload)

export default function TransactionHistoryPage() {
  const { serviceId } = useParams(); // service id from URL
  const [service, setService] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    transactionDate: '',
    notes: '',
    bank: 'KBANK',
    slipImage: null // เก็บ File object
  });
  const [slipPreview, setSlipPreview] = useState(null); // แสดงตัวอย่างรูป
  const [viewSlip, setViewSlip] = useState(null); // สำหรับ modal แสดงสลิปขนาดใหญ่
  const [uploadingId, setUploadingId] = useState(null); // อัปโหลดสลิปรายแถว
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    transactionDate: '',
    notes: '',
    bank: 'KBANK'
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [svcRes, txRes] = await Promise.all([
        axios.get(`${api}/api/services/${serviceId}`, authHeaders),
        axios.get(`${api}/api/services/${serviceId}/transactions`, authHeaders)
      ]);
      setService(svcRes.data);
      console.log('Transactions loaded:', txRes.data);
      txRes.data.forEach(tx => {
        console.log(`Transaction ${tx._id}: slipImage =`, tx.slipImage);
      });
      setTransactions(txRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, serviceId, token]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.transactionDate) return;
    try {
      // ใช้ FormData สำหรับอัปโหลดไฟล์
      const formData = new FormData();
      formData.append('amount', parseFloat(form.amount));
      formData.append('transactionDate', form.transactionDate);
      formData.append('notes', form.notes || '');
      formData.append('bank', form.bank);
      if (form.slipImage) {
        formData.append('slipImage', form.slipImage);
      }

      // Debug: ดูข้อมูลใน FormData
      console.log('=== Frontend FormData Debug ===');
      console.log('amount:', form.amount);
      console.log('transactionDate:', form.transactionDate);
      console.log('bank:', form.bank);
      console.log('notes:', form.notes);
      console.log('slipImage:', form.slipImage);
      console.log('FormData entries:');
      for (let pair of formData.entries()) {
        console.log(pair[0] + ':', pair[1]);
      }

      const res = await axios.post(`${api}/api/services/${serviceId}/transactions`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
          // ไม่ต้องระบุ Content-Type เพราะ FormData จะตั้งค่าเองพร้อม boundary
        }
      });
      console.log('Response:', res.data);
      setTransactions([res.data, ...transactions]);
      setShowCreate(false);
      setForm({
        amount: '',
        transactionDate: '',
        notes: '',
        bank: 'KBANK',
        slipImage: null
      });
      setSlipPreview(null);
    } catch (err) {
      console.error('=== Frontend Error ===');
      console.error('Error:', err);
      console.error('Response data:', err?.response?.data);
      const detail = err?.response?.data?.detail || err?.message || '';
      alert(`เพิ่มรายการไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  };

  const startEdit = (tx) => {
    setEditingId(tx._id);
    setEditForm({
      amount: tx.amount,
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 10) : '',
      notes: tx.notes || '',
      bank: tx.bank || ''
    });
  };

  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, slipImage: file });
      // แสดงตัวอย่างรูป
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSlipPreview = () => {
    setForm({ ...form, slipImage: null });
    setSlipPreview(null);
  };

  // อัปโหลดสลิปให้รายการที่ไม่มีสลิป
  const triggerUploadFor = (txId) => {
    const el = document.getElementById(`slip-input-${txId}`);
    if (el) el.click();
  };

  const handleInlineSlipChange = async (txId, file) => {
    if (!file) return;
    // ตรวจสอบขนาดไฟล์ไม่เกิน 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }
    try {
      setUploadingId(txId);
      const formData = new FormData();
      formData.append('slipImage', file);

      const res = await axios.put(`${api}/api/transactions/${txId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactions.map(t => (t._id === txId ? res.data : t)));
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'อัปโหลดสลิปไม่สำเร็จ';
      alert(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const saveEdit = async (txId) => {
    try {
      const payload = { ...editForm, amount: parseFloat(editForm.amount) };
      if (!payload.transactionDate) delete payload.transactionDate;
      const res = await axios.put(`${api}/api/transactions/${txId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactions.map(t => (t._id === txId ? res.data : t)));
      setEditingId(null);
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const askDelete = (txId) => {
    setTransactionToDelete(txId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await axios.delete(`${api}/api/transactions/${transactionToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(transactions.filter(t => t._id !== transactionToDelete));
      setShowDeleteConfirm(false);
      setTransactionToDelete(null);
    } catch (err) {
      alert('ลบไม่สำเร็จ');
    }
  };

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header" style={{ color: '#dc3545' }}>
          <h3 style={{ margin: 0 }}>ยืนยันการลบรายการโอนเงิน</h3>
        </div>
        <div className="modal-body">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={() => setShowDeleteConfirm(false)}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" type="button" onClick={confirmDelete}>
            ยืนยันลบ
          </button>
        </div>
      </div>
    </div>
  );

  const SlipViewModal = () => (
    <div className="modal-backdrop" onClick={() => setViewSlip(null)}>
      <div className="modal-content" style={{ maxWidth: '800px', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>สลิปโอนเงิน</h3>
          <button onClick={() => setViewSlip(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
            <XCircle />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <img src={`${api}${viewSlip}`} alt="สลิปโอนเงิน" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </div>
    </div>
  );

  // คำนวณยอดรวมทั้งหมด
  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div className="customer-list-page fade-up">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
        {viewSlip && <SlipViewModal />}
        <div className="list-header">
          <div className="list-header-title-group">
            <CashCoin className="list-header-icon" />
            <h2 className="list-header-title">
              ประวัติการโอนเงิน: {service ? `${service.name} / ${service.customerId?.name || '...'}` : '...'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to={`/dashboard/customer/${service?.customerId?._id || service?.customerId}/services`} className="btn btn-sm btn-back">
              <ArrowLeftCircleFill /> กลับ
            </Link>
            <button className="btn-header-upload" onClick={() => setShowCreate(true)}>
              <Plus /> เพิ่มรายการโอนเงิน
            </button>
          </div>
        </div>
        {service && (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f7fa', borderRadius: 8 }}>
            <strong>บริการ:</strong> {service.name} | <strong>สถานะ:</strong> {service.status}
            {service.pageUrl && (
              <>
                {' '}| <strong>Website/Page:</strong> {service.pageUrl}
              </>
            )}
          </div>
        )}

        {/* แสดงยอดรวม */}
        <div style={{ marginBottom: '15px', padding: '12px', background: '#e7f3ff', borderRadius: 8, fontWeight: 'bold' }}>
          ยอดรวมทั้งหมด: {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
        </div>

        {showCreate && (
          <div className="svc-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="svc-modal-card" onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>เพิ่มรายการโอนเงินใหม่</h3>
              <form onSubmit={handleCreate} className="svc-form">
                <label>
                  จำนวนเงิน (บาท)
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }}
                  />
                </label>
                <label>
                  วันที่โอน
                  <input
                    type="date"
                    value={form.transactionDate}
                    onChange={e => setForm({ ...form, transactionDate: e.target.value })}
                    required
                  />
                </label>
                <label>
                  บัญชีธนาคาร
                  <select
                    value={form.bank}
                    onChange={e => setForm({ ...form, bank: e.target.value })}
                  >
                    <option value="KBANK">KBANK (กสิกรไทย)</option>
                    <option value="SCB">SCB (ไทยพาณิชย์)</option>
                    <option value="BBL">BBL (กรุงเทพ)</option>
                  </select>
                </label>
                <label>
                  หมายเหตุ
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="เช่น เลขที่อ้างอิง, หมายเหตุเพิ่มเติม"
                  />
                </label>
                <label>
                  อัปโหลดสลิปโอนเงิน
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlipChange}
                    style={{ marginTop: '8px' }}
                  />
                  {slipPreview && (
                    <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                      <img src={slipPreview} alt="ตัวอย่างสลิป" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ddd' }} />
                      <button
                        type="button"
                        onClick={removeSlipPreview}
                        style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255,0,0,0.8)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px' }}
                      >
                        ×
                      </button>
                    </div>
                  )}
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

        <div className="table-responsive">
          <table className="customer-table">
            <thead>
              <tr>
                    <th>วันที่โอน</th>
                    <th>จำนวนเงิน (บาท)</th>
                    <th>บัญชีธนาคาร</th>
                    <th>สลิป</th>
                    <th>หมายเหตุ</th>
                    <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center p-5">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map(tx => (
                  <tr key={tx._id}>
                    <td>
                      {editingId === tx._id ? (
                        <input
                          type="date"
                          value={editForm.transactionDate || ''}
                          onChange={e => setEditForm({ ...editForm, transactionDate: e.target.value })}
                        />
                      ) : tx.transactionDate ? (
                        new Date(tx.transactionDate).toLocaleDateString('th-TH')
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {editingId === tx._id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                        />
                      ) : (
                        tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                      )}
                    </td>
                    <td>
                      {editingId === tx._id ? (
                        <select
                          value={editForm.bank}
                          onChange={e => setEditForm({ ...editForm, bank: e.target.value })}
                        >
                          <option value="">-- เลือกธนาคาร --</option>
                          <option value="KBANK">KBANK (กสิกรไทย)</option>
                          <option value="SCB">SCB (ไทยพาณิชย์)</option>
                          <option value="BBL">BBL (กรุงเทพ)</option>
                        </select>
                      ) : (
                        <span className="badge-status web"><Bank2 /> {tx.bank || '-'}</span>
                      )}
                    </td>
                    <td>
                      {tx.slipImage ? (
                        <button
                          className="btn btn-sm btn-outline-info"
                          onClick={() => setViewSlip(tx.slipImage)}
                        >
                          <Eye /> ดูสลิป
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => triggerUploadFor(tx._id)}
                            disabled={uploadingId === tx._id}
                          >
                            <Upload /> {uploadingId === tx._id ? 'กำลังอัปโหลด...' : 'เพิ่มสลิป'}
                          </button>
                          <input
                            id={`slip-input-${tx._id}`}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleInlineSlipChange(tx._id, e.target.files?.[0])}
                          />
                        </>
                      )}
                    </td>
                    <td>
                      {editingId === tx._id ? (
                        <input
                          value={editForm.notes}
                          onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        />
                      ) : (
                        tx.notes || '-'
                      )}
                    </td>
                    <td>
                      {editingId === tx._id ? (
                        <>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => saveEdit(tx._id)}>
                            บันทึก
                          </button>{' '}
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>
                            <XCircle /> ยกเลิก
                          </button>
                        </>
                      ) : (
                        <div className="dropdown-container">
                          <button 
                            className="btn-dropdown-toggle" 
                            onClick={(e) => {
                              setOpenDropdown(openDropdown === tx._id ? null : tx._id);
                            }}
                          >
                            <ThreeDotsVertical />
                          </button>
                          {openDropdown === tx._id && (
                            <div className="dropdown-menu-custom">
                              <button className="dropdown-item" onClick={() => { startEdit(tx); setOpenDropdown(null); }}>
                                <PencilSquare /> แก้ไข
                              </button>
                              <button className="dropdown-item danger" onClick={() => { askDelete(tx._id); setOpenDropdown(null); }}>
                                <TrashFill /> ลบ
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center p-5">
                    ยังไม่มีรายการโอนเงิน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
