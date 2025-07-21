// src/pages/CustomerListPage.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function CustomerListPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);


  const fetchCustomers = async (searchValue = '') => {
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${process.env.REACT_APP_API_URL}/api/customers`;
      if (searchValue.trim() !== '') {
        url += `?search=${encodeURIComponent(searchValue)}`;
      }
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCustomers(res.data);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า', error);
      setCustomers([]);
    } finally {
      setSearchLoading(false);
    }
  };


  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers(search);
    }, 500); // debounce 500ms
    return () => clearTimeout(delayDebounce);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDeleteClick = (id) => {
    setCustomerToDelete(id);
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/customers/${customerToDelete}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Popup Confirm Modal for Delete */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.15)', minWidth: 320, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 18 }}>ยืนยันการลบข้อมูลลูกค้า</h3>
            <div style={{ marginBottom: 24, color: '#555' }}>คุณต้องการลบข้อมูลลูกค้าคนนี้ใช่หรือไม่?</div>
            <button style={{ marginRight: 16, padding: '8px 24px', borderRadius: 6, border: 'none', background: '#888', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>ยกเลิก</button>
            <button style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#dc3545', color: '#fff', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }} onClick={handleConfirmDelete} disabled={deleteLoading}>{deleteLoading ? 'กำลังลบ...' : 'ยืนยัน'}</button>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 32px', maxWidth: 900, width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#007bff', fontWeight: 700 }}>รายชื่อลูกค้า</h2>
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            className="form-control"
            placeholder="ค้นหาชื่อลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 44, fontSize: 16, borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          />
          {searchLoading && <div className="text-muted mt-1">กำลังค้นหา...</div>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <thead style={{ background: '#f2f6fc' }}>
              <tr>
                <th style={{ fontWeight: 600, fontSize: 16, padding: '14px 8px' }}>ชื่อ</th>
                <th style={{ fontWeight: 600, fontSize: 16, padding: '14px 8px' }}>บริการ</th>
                <th style={{ fontWeight: 600, fontSize: 16, padding: '14px 8px' }}>เบอร์โทร</th>
                <th style={{ fontWeight: 600, fontSize: 16, padding: '14px 8px' }}>วันที่เพิ่ม</th>
                <th style={{ fontWeight: 600, fontSize: 16, padding: '14px 8px' }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => (
                <tr key={cust._id} style={{ fontSize: 15 }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{cust.name}</td>
                  <td style={{ padding: '12px 8px', color: '#007bff' }}>{cust.service}</td>
                  <td style={{ padding: '12px 8px', color: '#888' }}>{cust.phone}</td>
                  <td style={{ padding: '12px 8px' }}>{new Date(cust.createdAt).toLocaleDateString('th-TH')}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <Link to={`/dashboard/customer/${cust._id}`} className="btn btn-info btn-sm me-2" style={{ borderRadius: 6, fontWeight: 500, fontSize: 15 }}>ดูรายละเอียด</Link>
                    <button className="btn btn-danger btn-sm" style={{ borderRadius: 6, fontWeight: 500, fontSize: 15 }} onClick={() => handleDeleteClick(cust._id)}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
