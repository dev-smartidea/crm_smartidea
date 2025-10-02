import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { PersonVcardFill, TelephoneFill, Line, Facebook, Globe, BoxSeam, CalendarPlus, ArrowLeftCircleFill } from 'react-bootstrap-icons';
import './CustomerDetailPage.css';

export default function CustomerDetailPage() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
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

  const DetailItem = ({ icon, label, value, className = '', placeholder = '-' }) => (
    <div className="detail-item">
      <div className="detail-item-icon">{icon}</div>
      <div className="detail-item-content">
        <span className="detail-item-label">{label}</span>
        <span className={`detail-item-value ${className} ${!value && 'placeholder'}`}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="customer-detail-page">
        <div className="loading-container">กำลังโหลดข้อมูลลูกค้า...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-detail-page">
        <div className="error-container">{error}</div>
      </div>
    );
  }

  return (
    <div className="customer-detail-page">
      <div className="detail-container">
        {customer ? (
          <>
            <div className="detail-header">
              <PersonVcardFill className="detail-header-icon" />
              <h2 className="detail-header-title">รายละเอียดลูกค้า</h2>
            </div>
            <div className="detail-grid">
              <DetailItem icon={<PersonVcardFill />} label="ชื่อ-นามสกุล" value={customer.name} />
              <DetailItem icon={<TelephoneFill />} label="เบอร์โทรศัพท์" value={customer.phone} />
              <DetailItem icon={<Line />} label="LINE ID" value={customer.lineId} />
              <DetailItem icon={<Facebook />} label="Facebook" value={customer.facebook} />
              <DetailItem icon={<Globe />} label="เว็บไซต์" value={customer.website} />
              <DetailItem icon={<BoxSeam />} label="สินค้า / บริการที่สนใจ" value={customer.service} className="service" />
              <DetailItem 
                icon={<CalendarPlus />} 
                label="วันที่เพิ่มข้อมูล" 
                value={new Date(customer.createdAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })} 
                className="detail-full-width"
              />
            </div>
          </>
        ) : (
          <div className="error-container">ไม่พบข้อมูลลูกค้า</div>
        )}
        <div className="back-button-container">
          <Link to="/dashboard/list" className="btn btn-back">
            <ArrowLeftCircleFill />
            กลับไปที่หน้ารายชื่อ
          </Link>
        </div>
      </div>
    </div>
  );
}