// นำเข้า React และ Hook ที่จำเป็น
// นำเข้า React และ Hook ที่จำเป็นสำหรับการจัดการ state และ lifecycle
import React, { useEffect, useState } from 'react';
// นำเข้า axios สำหรับเรียก API
// นำเข้า axios สำหรับเรียกข้อมูลจาก backend API
import axios from 'axios';
// นำเข้า useNavigate สำหรับเปลี่ยนหน้า
// นำเข้า useNavigate สำหรับเปลี่ยนเส้นทาง (routing) ในแอป
import { useNavigate } from 'react-router-dom';

// สร้างคอมโพเนนต์ DashboardPage
// คอมโพเนนต์หลักสำหรับหน้า Dashboard ของผู้ใช้
export default function DashboardPage() {
  // สร้าง state สำหรับเก็บจำนวนลูกค้า (customerCount) และสถานะ loading
  // customerCount: จำนวนลูกค้าทั้งหมด
  // loading: สถานะกำลังโหลดข้อมูล
  const [customerCount, setCustomerCount] = useState(null);
  const [loading, setLoading] = useState(true);

  // สร้างตัวแปร navigate สำหรับเปลี่ยนหน้า
  // ใช้สำหรับเปลี่ยนเส้นทางไปยังหน้าต่างๆ
  const navigate = useNavigate();

  // ใช้ useEffect เพื่อทำงานเมื่อ component โหลดครั้งแรก
  // ตรวจสอบ token และ role ของผู้ใช้ และดึงข้อมูลจำนวนลูกค้าทั้งหมดเมื่อ component โหลด
  useEffect(() => {
    // ดึง token จาก localStorage เพื่อใช้ยืนยันตัวตน
    // ดึง token เพื่อใช้ในการยืนยันตัวตนกับ API
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // ถอดรหัส token เพื่อดู role ของผู้ใช้
        // ถอดรหัส JWT token เพื่อดู role ของผู้ใช้
        const payload = JSON.parse(atob(token.split('.')[1]));
        // ถ้า role เป็น admin ให้เปลี่ยนหน้าไป dashboard ของ admin
        // ถ้า role เป็น admin ให้เปลี่ยนไปหน้า dashboard ของ admin
        if (payload.role === 'admin') {
          navigate('/dashboard/admin');
          return;
        }
      } catch (e) {}
    }
    // ฟังก์ชันสำหรับดึงจำนวนลูกค้าทั้งหมดจาก API
    // ฟังก์ชันเรียก API เพื่อดึงข้อมูลลูกค้าทั้งหมด
    const fetchCustomerCount = async () => {
      try {
        // เรียก API เพื่อดึงข้อมูลลูกค้า
        // ส่ง request ไปยัง API เพื่อดึงข้อมูลลูกค้าทั้งหมด
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // เซ็ตจำนวนลูกค้าจากข้อมูลที่ได้
        // กำหนดจำนวนลูกค้าจากข้อมูลที่ได้รับ
        setCustomerCount(res.data.length);
      } catch (err) {
        // ถ้าเกิด error ให้เซ็ตจำนวนลูกค้าเป็น null
        // ถ้าเกิด error ในการดึงข้อมูล ให้แสดงเป็น null
        setCustomerCount(null);
      } finally {
        // ปิดสถานะ loading ไม่ว่าจะสำเร็จหรือ error
        // ปิดสถานะ loading หลังจากดึงข้อมูลเสร็จ
        setLoading(false);
      }
    };
    // เรียกฟังก์ชันดึงข้อมูลลูกค้า
    // เรียกฟังก์ชันเพื่อดึงข้อมูลลูกค้าทั้งหมด
    fetchCustomerCount();
  }, [navigate]);

  // ส่วนแสดงผลหน้าจอ Dashboard
  // ส่วนแสดงผล UI ของหน้า Dashboard
  return (
    <div className="container mt-4">
      {/* ส่วนหัว Dashboard */}
      {/* ส่วนหัวของหน้า Dashboard */}
      <h2>Dashboard</h2>
      <hr />
      <div className="row mb-4">
        <div className="col-md-4">
          {/* Card แสดงจำนวนลูกค้าทั้งหมด คลิกเพื่อไปหน้ารายชื่อลูกค้า */}
          {/* Card สำหรับแสดงจำนวนลูกค้าทั้งหมด สามารถคลิกเพื่อไปหน้ารายชื่อลูกค้า */}
          <div
            className="card text-center shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/dashboard/list')}
            title="ดูรายชื่อลูกค้า"
          >
            <div className="card-body">
              <h5 className="card-title">จำนวนลูกค้าทั้งหมด</h5>
              {/* แสดงจำนวนลูกค้า ถ้า loading ให้แสดง ... ถ้า error ให้แสดง - */}
              {/* แสดงจำนวนลูกค้า ถ้ากำลังโหลดให้แสดง ... ถ้า error ให้แสดง - */}
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