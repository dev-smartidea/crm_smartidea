import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { PeopleFill, Search, EyeFill, TrashFill, ExclamationTriangleFill } from 'react-bootstrap-icons';
import './CustomerListPage.css';

export default function CustomerListPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
            ยกเลิก
          </button>
          <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="customer-list-page">
      {showDeleteConfirm && <DeleteConfirmModal />}
      <div className="list-container">
        <div className="list-header">
          <div className="list-header-title-group">
            <PeopleFill className="list-header-icon" />
            <h2 className="list-header-title">รายชื่อลูกค้า</h2>
          </div>
          <div className="search-box">
            <Search className="search-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="ค้นหาลูกค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="customer-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>บริการที่สนใจ</th>
                <th>เบอร์โทรศัพท์</th>
                <th>วันที่เพิ่ม</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="text-center p-5">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((cust) => (
                  <tr key={cust._id}>
                    <td>{cust.name}</td>
                    <td className="service-col">{cust.service}</td>
                    <td>{cust.phone}</td>
                    <td>{new Date(cust.createdAt).toLocaleDateString('th-TH')}</td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/dashboard/customer/${cust._id}/services`} className="btn btn-sm btn-outline-primary btn-view-details">
                          <EyeFill /> บริการ
                        </Link>
                        <button className="btn btn-sm btn-outline-danger btn-delete" onClick={() => handleDeleteClick(cust._id)}>
                          <TrashFill /> ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center p-5">ไม่พบข้อมูลลูกค้า</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
