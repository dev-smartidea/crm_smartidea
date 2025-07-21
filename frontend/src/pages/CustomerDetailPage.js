import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function CustomerDetailPage() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setCustomer(res.data);
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า หรือไม่พบข้อมูล');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  if (loading) {
    return <p>กำลังโหลด...</p>;
  }

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 32px', maxWidth: 520, width: '100%' }}>
        {customer ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#007bff', fontWeight: 700 }}>รายละเอียดลูกค้า</h2>
            <div style={{ marginBottom: 22 }}><strong>ชื่อ:</strong> <span style={{ color: '#222', fontWeight: 600 }}>{customer.name}</span></div>
            <div style={{ marginBottom: 22 }}><strong>เบอร์โทรศัพท์:</strong> <span style={{ color: '#888' }}>{customer.phone}</span></div>
            <div style={{ marginBottom: 22 }}><strong>ไอดีไลน์:</strong> <span style={{ color: '#555' }}>{customer.lineId || '-'}</span></div>
            <div style={{ marginBottom: 22 }}><strong>เพจ Facebook:</strong> <span style={{ color: '#555' }}>{customer.facebook || '-'}</span></div>
            <div style={{ marginBottom: 22 }}><strong>เว็บไซต์:</strong> <span style={{ color: '#555' }}>{customer.website || '-'}</span></div>
            <div style={{ marginBottom: 22 }}><strong>สินค้า / บริการ:</strong> <span style={{ color: '#007bff', fontWeight: 600 }}>{customer.service}</span></div>
            <div style={{ marginBottom: 22 }}><strong>วันที่เพิ่ม:</strong> <span style={{ color: '#888' }}>{new Date(customer.createdAt).toLocaleString('th-TH')}</span></div>
          </>
        ) : (
          <p style={{ color: 'red', textAlign: 'center', fontWeight: 500 }}>ไม่พบข้อมูลลูกค้า</p>
        )}
        <Link to="/dashboard/list" className="btn btn-secondary mt-4" style={{ width: '100%', height: 44, fontSize: 17, fontWeight: 600, borderRadius: 8 }}>กลับไปที่รายชื่อ</Link>
      </div>
    </div>
  );
}