import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  // State สำหรับเก็บจำนวนลูกค้าและสถานะ loading
  const [customerCount, setCustomerCount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hook สำหรับเปลี่ยนหน้า
  const navigate = useNavigate();

  useEffect(() => {
    // ดึง token จาก localStorage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // ตรวจสอบ role ถ้าเป็น admin ให้ redirect ไปหน้า admin dashboard
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'admin') {
          navigate('/dashboard/admin');
          return;
        }
      } catch (e) {}
    }
    // ฟังก์ชันสำหรับดึงจำนวนลูกค้าทั้งหมด
    const fetchCustomerCount = async () => {
      try {
        // เรียก API เพื่อดึงข้อมูลลูกค้า
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // เซ็ตจำนวนลูกค้าจากข้อมูลที่ได้
        setCustomerCount(res.data.length);
      } catch (err) {
        // ถ้า error ให้เซ็ตเป็น null
        setCustomerCount(null);
      } finally {
        // ปิดสถานะ loading
        setLoading(false);
      }
    };
    // เรียกฟังก์ชันดึงข้อมูล
    fetchCustomerCount();
  }, [navigate]);

  return (
    <div className="container mt-4">
      {/* ส่วนหัว Dashboard */}
      <h2>Dashboard</h2>
      <hr />
      <div className="row mb-4">
        <div className="col-md-4">
          {/* Card แสดงจำนวนลูกค้าทั้งหมด คลิกเพื่อไปหน้ารายชื่อลูกค้า */}
          <div
            className="card text-center shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/dashboard/list')}
            title="ดูรายชื่อลูกค้า"
          >
            <div className="card-body">
              <h5 className="card-title">จำนวนลูกค้าทั้งหมด</h5>
              {/* แสดงจำนวนลูกค้า หรือ loading หรือ '-' ถ้า error */}
              <p className="display-4 mb-0">
                {loading ? '...' : customerCount !== null ? customerCount : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}