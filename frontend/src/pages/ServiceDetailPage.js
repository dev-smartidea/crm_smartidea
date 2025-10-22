import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeftCircleFill } from 'react-bootstrap-icons';

export default function ServiceDetailPage() {
  const { id } = useParams(); // service id
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const svcRes = await axios.get(`${api}/api/services/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setService(svcRes.data);
        if (svcRes.data.customer) {
          const custRes = await axios.get(`${api}/api/customers/${svcRes.data.customer}`, { headers: { Authorization: `Bearer ${token}` } });
          setCustomer(custRes.data);
        }
        setLoading(false);
      } catch (err) {
        setError('ไม่พบข้อมูลบริการนี้');
        setLoading(false);
      }
    }
    fetchData();
  }, [id, api, token]);

  if (loading) return <div style={{ padding: 32 }}>กำลังโหลด...</div>;
  if (error) return <div style={{ color: 'red', padding: 32 }}>{error}</div>;
  if (!service) return null;

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #0001', padding: 32 }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#333', fontSize: 18, marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeftCircleFill size={22} /> กลับ
      </button>
      <h2 style={{ marginTop: 0, marginBottom: 18 }}>รายละเอียดบริการ</h2>
      <div style={{ marginBottom: 12 }}><b>บริการ:</b> {service.name}</div>
      <div style={{ marginBottom: 12 }}><b>Website / Facebook Page:</b> {service.pageUrl || '-'}</div>
      <div style={{ marginBottom: 12 }}><b>Customer ID:</b> {service.customerIdField || '-'}</div>
      <div style={{ marginBottom: 12 }}><b>สถานะ:</b> {service.status}</div>
      <div style={{ marginBottom: 12 }}><b>วันที่เริ่มต้น:</b> {service.startDate ? new Date(service.startDate).toLocaleDateString('th-TH') : '-'}</div>
      <div style={{ marginBottom: 12 }}><b>วันที่ครบกำหนด:</b> {service.dueDate ? new Date(service.dueDate).toLocaleDateString('th-TH') : '-'}</div>
      <div style={{ marginBottom: 12 }}><b>จำนวนวัน:</b> {service.startDate && service.dueDate ? (() => { const start = new Date(service.startDate); const end = new Date(service.dueDate); const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); return diff >= 0 ? `${diff} วัน` : '-'; })() : '-'}</div>
      <div style={{ marginBottom: 12 }}><b>note:</b> {service.notes || '-'}</div>
      {customer && (
        <div style={{ marginTop: 18, padding: 12, background: '#f5f7fa', borderRadius: 8 }}>
          <b>ลูกค้า:</b> {customer.name}<br />
          <b>โทร:</b> {customer.phone}
        </div>
      )}
    </div>
  );
}
