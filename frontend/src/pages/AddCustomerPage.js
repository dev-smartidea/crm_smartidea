// src/pages/AddCustomerPage.js
import React, { useState } from 'react';
import axios from 'axios';

export default function AddCustomerPage() {

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    lineId: '',
    facebook: '',
    website: '',
    service: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${process.env.REACT_APP_API_URL}/api/customers`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      alert('เพิ่มลูกค้าเรียบร้อยแล้ว');
      setFormData({ name: '', phone: '', lineId: '', facebook: '', website: '', service: '' });
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการเพิ่มลูกค้า');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 32px', maxWidth: 520, width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#007bff', fontWeight: 700 }}>เพิ่มลูกค้าใหม่</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>ชื่อ <span style={{ color: 'red' }}>*</span></label>
            <input type="text" className="form-control" name="name" value={formData.name} onChange={handleChange} required style={{ height: 44, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>เบอร์โทรศัพท์ <span style={{ color: 'red' }}>*</span></label>
            <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleChange} required style={{ height: 44, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>ไอดีไลน์</label>
            <input type="text" className="form-control" name="lineId" value={formData.lineId} onChange={handleChange} style={{ height: 44, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>เพจ Facebook</label>
            <input type="text" className="form-control" name="facebook" value={formData.facebook} onChange={handleChange} style={{ height: 44, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>เว็บไซต์</label>
            <input type="text" className="form-control" name="website" value={formData.website} onChange={handleChange} style={{ height: 44, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="form-label" style={{ fontWeight: 500 }}>สินค้า / บริการ <span style={{ color: 'red' }}>*</span></label>
            <input type="text" className="form-control" name="service" value={formData.service} onChange={handleChange} required style={{ height: 44, fontSize: 16 }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 48, fontSize: 18, fontWeight: 600, borderRadius: 8, marginTop: 12 }}>บันทึกข้อมูลลูกค้า</button>
        </form>
      </div>
    </div>
  );
}
