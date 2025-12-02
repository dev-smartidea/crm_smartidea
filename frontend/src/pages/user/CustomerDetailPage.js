import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { PersonVcardFill, TelephoneFill, Globe, BoxSeam, CalendarPlus, ArrowLeftCircleFill, TagFill, Building, BriefcaseFill, EnvelopeFill, CreditCard, PencilSquare } from 'react-bootstrap-icons';
import './CustomerDetailPage.css';
import '../shared/ImageGalleryPage.css'; // reuse gradient blue button style

export default function CustomerDetailPage() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customerCode: '',
    name: '',
    customerType: '',
    businessSize: '',
    phone: '',
    email: '',
    taxId: '',
    address: '',
    productService: ''
  });

  const customerTypeOptions = ['บุคคลธรรมดา', 'บริษัทจำกัด', 'หจก.'];
  const businessSizeOptions = ['ธุรกิจขนาดเล็ก', 'ธุรกิจขนาดกลาง'];

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
    <div className="customer-detail-page fade-up">
      <div className="detail-container">
        {customer ? (
          <>
            <div className="detail-header">
              <div className="detail-header-iconwrap">
                <PersonVcardFill className="detail-header-icon" />
              </div>
              <div className="detail-header-text">
                <h2 className="detail-header-title">{customer.name || 'รายละเอียดลูกค้า'}</h2>
                <div className="detail-meta">
                  <span className="code-chip">{customer.customerCode || '-'}</span>
                  {customer.customerType && (
                    <span className="tag-badge">{customer.customerType}</span>
                  )}
                  {customer.businessSize && (
                    <span className="tag-badge alt">{customer.businessSize}</span>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn-header-upload"
                  onClick={() => {
                    setEditForm({
                      customerCode: customer.customerCode || '',
                      name: customer.name || '',
                      customerType: customer.customerType || '',
                      businessSize: customer.businessSize || '',
                      phone: customer.phone || '',
                      email: customer.email || '',
                      taxId: customer.taxId || '',
                      address: customer.address || '',
                      productService: customer.productService || ''
                    });
                    setIsEditing(true);
                  }}
                >
                  <PencilSquare /> แก้ไขข้อมูล
                </button>
              </div>
            </div>
            <div className="detail-grid">
              <DetailItem icon={<TagFill />} label="รหัสลูกค้า" value={customer.customerCode} />
              <DetailItem icon={<PersonVcardFill />} label="ชื่อลูกค้า" value={customer.name} />
              <DetailItem icon={<Building />} label="ประเภทลูกค้า" value={customer.customerType} />
              <DetailItem icon={<BriefcaseFill />} label="ขนาดธุรกิจ" value={customer.businessSize} />
              <DetailItem icon={<TelephoneFill />} label="เบอร์โทรศัพท์" value={customer.phone} />
              <DetailItem icon={<EnvelopeFill />} label="Email" value={customer.email} />
              <DetailItem icon={<CreditCard />} label="Tax ID" value={customer.taxId} />
              <DetailItem icon={<Globe />} label="ที่อยู่" value={customer.address} className="detail-full-width" />
              <DetailItem icon={<BoxSeam />} label="สินค้า / บริการของลูกค้า" value={customer.productService} className="service detail-full-width" />
              <DetailItem
                icon={<CalendarPlus />}
                label="วันที่เพิ่มข้อมูล"
                value={new Date(customer.createdAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
                className="detail-full-width"
              />
            </div>
            {isEditing && (
              <div className="cd-modal-overlay" onClick={() => setIsEditing(false)}>
                <div className="cd-modal-card" onClick={e => e.stopPropagation()}>
                  <h3 style={{ marginTop: 0, marginBottom: 16 }}>แก้ไขข้อมูลลูกค้า</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const token = localStorage.getItem('token');
                        const payload = { ...editForm };
                        const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/customers/${id}`, payload, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        setCustomer(res.data);
                        setIsEditing(false);
                      } catch (err) {
                        alert(err?.response?.data?.error || 'บันทึกไม่สำเร็จ');
                      }
                    }}
                    className="cd-form"
                  >
                    <div className="cd-row-2">
                      <label>
                        รหัสลูกค้า
                        <input
                          type="text"
                          value={editForm.customerCode}
                          readOnly
                          title="รหัสลูกค้าไม่สามารถแก้ไขได้"
                          required
                        />
                      </label>
                      <label>
                        ชื่อลูกค้า
                        <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                      </label>
                    </div>
                    <div className="cd-row-2">
                      <label>
                        ประเภทลูกค้า
                        <select value={editForm.customerType} onChange={e => setEditForm({ ...editForm, customerType: e.target.value })} required>
                          <option value="" disabled>เลือก...</option>
                          {customerTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </label>
                      <label>
                        ขนาดธุรกิจ
                        <select value={editForm.businessSize} onChange={e => setEditForm({ ...editForm, businessSize: e.target.value })} required>
                          <option value="" disabled>เลือก...</option>
                          {businessSizeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="cd-row-2">
                      <label>
                        เบอร์โทรศัพท์
                        <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} required />
                      </label>
                      <label>
                        Email
                        <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
                      </label>
                    </div>
                    <div className="cd-row-2">
                      <label>
                        Tax ID
                        <input type="text" value={editForm.taxId} onChange={e => setEditForm({ ...editForm, taxId: e.target.value })} required />
                      </label>
                    </div>
                    <label>
                      ที่อยู่
                      <textarea rows={3} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} required />
                    </label>
                    <label>
                      สินค้า / บริการของลูกค้า
                      <textarea rows={3} value={editForm.productService} onChange={e => setEditForm({ ...editForm, productService: e.target.value })} required />
                    </label>
                    <div className="cd-actions">
                      <button type="button" className="btn-modal-cancel" onClick={() => setIsEditing(false)}>ยกเลิก</button>
                      <button type="submit" className="btn-modal-save">บันทึก</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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