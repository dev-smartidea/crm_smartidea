import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CashCoin, Plus, TrashFill, PencilSquare, ArrowLeftCircleFill, Bank2, ThreeDotsVertical, XCircle } from 'react-bootstrap-icons';
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
    paymentMethod: 'โอนผ่านธนาคาร',
    bank: 'KBANK',
    slipImage: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    transactionDate: '',
    notes: '',
    paymentMethod: 'โอนผ่านธนาคาร',
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
      const payload = { ...form, amount: parseFloat(form.amount) };
      const res = await axios.post(`${api}/api/services/${serviceId}/transactions`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions([res.data, ...transactions]);
      setShowCreate(false);
      setForm({
        amount: '',
        transactionDate: '',
        notes: '',
        paymentMethod: 'โอนผ่านธนาคาร',
        bank: 'KBANK',
        slipImage: ''
      });
    } catch (err) {
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
      paymentMethod: tx.paymentMethod || 'โอนผ่านธนาคาร',
      bank: tx.bank || ''
    });
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

  // คำนวณยอดรวมทั้งหมด
  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div className="customer-list-page fade-up">
      <div className="list-container">
        {showDeleteConfirm && <DeleteConfirmModal />}
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
                  วิธีการชำระเงิน
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="โอนผ่านธนาคาร">โอนผ่านธนาคาร</option>
                    <option value="เงินสด">เงินสด</option>
                    <option value="บัตรเครดิต">บัตรเครดิต</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </label>
                <label>
                  บัญชีธนาคาร
                  <select
                    value={form.bank}
                    onChange={e => setForm({ ...form, bank: e.target.value })}
                  >
                    <option value="KBANK">KBANK</option>
                    <option value="SCB">SCB</option>
                    <option value="BBL">BBL</option>
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
                    <th>วิธีการชำระ</th>
                    <th>บัญชีธนาคาร</th>
                    <th>หมายเหตุ</th>
                    <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center p-5">
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
                          value={editForm.paymentMethod}
                          onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        >
                          <option value="โอนผ่านธนาคาร">โอนผ่านธนาคาร</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="บัตรเครดิต">บัตรเครดิต</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                      ) : (
                        <span className={`badge-status ${tx.paymentMethod === 'โอนผ่านธนาคาร' ? 'web' : tx.paymentMethod === 'เงินสด' ? 'account' : tx.paymentMethod === 'บัตรเครดิต' ? 'waitinfo' : ''}`}>{tx.paymentMethod || '-'}</span>
                      )}
                    </td>
                    <td>
                      {editingId === tx._id ? (
                        <select
                          value={editForm.bank}
                          onChange={e => setEditForm({ ...editForm, bank: e.target.value })}
                        >
                          <option value="">-- เลือกธนาคาร --</option>
                          <option value="KBANK">KBANK</option>
                          <option value="SCB">SCB</option>
                          <option value="BBL">BBL</option>
                          <option value="KTB">KTB</option>
                          <option value="TMB">TMB</option>
                          <option value="GSB">GSB</option>
                          <option value="BAY">BAY</option>
                        </select>
                      ) : (
                        <span className="badge-status web"><Bank2 /> {tx.bank || '-'}</span>
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
                  <td colSpan="5" className="text-center p-5">
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
