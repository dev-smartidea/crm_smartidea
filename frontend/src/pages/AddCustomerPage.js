import React, { useState } from 'react';
import axios from 'axios';
import { PersonPlusFill, TelephoneFill, Globe, BriefcaseFill, CheckCircleFill, ArrowCounterclockwise, Building, CreditCard, EnvelopeFill, TagFill } from 'react-bootstrap-icons';
import './AddCustomerPage.css';
import './ImageGalleryPage.css'; // reuse gradient blue button style

export default function AddCustomerPage() {
  const customerTypeOptions = ['บุคคลธรรมดา', 'บริษัทจำกัด', 'หจก.'];
  const businessSizeOptions = ['ธุรกิจขนาดเล็ก', 'ธุรกิจขนาดกลาง'];
  const initialFormState = {
    customerCode: '',
    name: '',
    customerType: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    businessSize: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [touched, setTouched] = useState({});
  // Local UI state for combo-style dropdowns (match Image Gallery pattern)
  const [typeQuery, setTypeQuery] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [sizeQuery, setSizeQuery] = useState('');
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  const calculateProgress = () => {
    const requiredFields = ['customerCode', 'name', 'customerType', 'address', 'phone', 'email', 'taxId', 'businessSize'];
    const filled = requiredFields.filter((field) => String(formData[field] || '').trim()).length;
    return Math.round((filled / requiredFields.length) * 100);
  };

  const progress = calculateProgress();

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitSuccess(false);
    setTouched({});
    setTypeQuery('');
    setSizeQuery('');
    setShowTypeDropdown(false);
    setShowSizeDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${process.env.REACT_APP_API_URL}/api/customers`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        handleReset();
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      console.error(error);
      const status = error?.response?.status;
      const message = error?.response?.data?.error;
      if (status === 409) {
        alert(message || 'รหัสลูกค้าซ้ำ กรุณาใช้รหัสอื่น');
      } else {
        alert(message || 'เกิดข้อผิดพลาดในการเพิ่มลูกค้า');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-customer-page">
      <div className="form-container">
        <div className="form-header">
          <div className="header-content">
            <PersonPlusFill className="form-header-icon" />
            <div>
              <h2 className="form-header-title">เพิ่มข้อมูลลูกค้าใหม่</h2>
              <p className="form-header-subtitle">กรอกข้อมูลลูกค้าเพื่อเพิ่มเข้าสู่ระบบ</p>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-info">
              <span className="progress-label">ความสมบูรณ์ของข้อมูล</span>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {submitSuccess && (
          <div className="success-message">
            <CheckCircleFill className="success-icon" />
            <div className="success-text">
              <h4>บันทึกข้อมูลสำเร็จ!</h4>
              <p>เพิ่มข้อมูลลูกค้าเข้าสู่ระบบเรียบร้อยแล้ว</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-card">
            <div className="card-header">
              <PersonPlusFill className="card-icon" />
              <h3 className="card-title">ข้อมูลลูกค้า (หลัก)</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customerCode">
                    <TagFill /> รหัสลูกค้า <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="customerCode"
                    className={`form-input ${touched.customerCode && formData.customerCode ? 'valid' : ''} ${touched.customerCode && !formData.customerCode ? 'invalid' : ''}`}
                    name="customerCode"
                    value={formData.customerCode}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="เช่น CUST-0001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="name">
                    <PersonPlusFill /> ชื่อลูกค้า <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    className={`form-input ${touched.name && formData.name ? 'valid' : ''} ${touched.name && !formData.name ? 'invalid' : ''}`}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="ชื่อลูกค้า"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customerType">
                    <Building /> ประเภทลูกค้า <span className="required">*</span>
                  </label>
                  <div className="combo">
                    <input
                      type="text"
                      id="customerType"
                      name="customerType"
                      className={`form-control combo-input ${touched.customerType && !formData.customerType ? 'invalid' : ''}`}
                      placeholder="เลือกประเภทลูกค้า..."
                      value={typeQuery}
                      onFocus={() => setShowTypeDropdown(true)}
                      onChange={(e) => { setTypeQuery(e.target.value); setShowTypeDropdown(true); }}
                      onBlur={handleBlur}
                      required
                    />
                    {showTypeDropdown && (
                      <div className="combo-panel" onMouseLeave={() => setShowTypeDropdown(false)}>
                        {customerTypeOptions
                          .filter(opt => opt.toLowerCase().includes((typeQuery || '').toLowerCase()))
                          .map(opt => (
                            <div
                              key={opt}
                              className="combo-item"
                              onMouseDown={() => {
                                setFormData({ ...formData, customerType: opt });
                                setTypeQuery(opt);
                                setShowTypeDropdown(false);
                                setTouched({ ...touched, customerType: true });
                              }}
                            >
                              {opt}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="businessSize">
                    <BriefcaseFill /> ขนาดธุรกิจ <span className="required">*</span>
                  </label>
                  <div className="combo">
                    <input
                      type="text"
                      id="businessSize"
                      name="businessSize"
                      className={`form-control combo-input ${touched.businessSize && !formData.businessSize ? 'invalid' : ''}`}
                      placeholder="เลือกขนาดธุรกิจ..."
                      value={sizeQuery}
                      onFocus={() => setShowSizeDropdown(true)}
                      onChange={(e) => { setSizeQuery(e.target.value); setShowSizeDropdown(true); }}
                      onBlur={handleBlur}
                      required
                    />
                    {showSizeDropdown && (
                      <div className="combo-panel" onMouseLeave={() => setShowSizeDropdown(false)}>
                        {businessSizeOptions
                          .filter(opt => opt.toLowerCase().includes((sizeQuery || '').toLowerCase()))
                          .map(opt => (
                            <div
                              key={opt}
                              className="combo-item"
                              onMouseDown={() => {
                                setFormData({ ...formData, businessSize: opt });
                                setSizeQuery(opt);
                                setShowSizeDropdown(false);
                                setTouched({ ...touched, businessSize: true });
                              }}
                            >
                              {opt}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="address">
                    <Globe /> ที่อยู่ <span className="required">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    className={`form-input ${touched.address && formData.address ? 'valid' : ''} ${touched.address && !formData.address ? 'invalid' : ''}`}
                    value={formData.address}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={3}
                    placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">
                    <TelephoneFill /> เบอร์โทรศัพท์ <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="phone"
                    className={`form-input ${touched.phone && formData.phone ? 'valid' : ''} ${touched.phone && !formData.phone ? 'invalid' : ''}`}
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="0XX-XXX-XXXX"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">
                    <EnvelopeFill /> Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    className={`form-input ${touched.email && formData.email ? 'valid' : ''} ${touched.email && !formData.email ? 'invalid' : ''}`}
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="taxId">
                    <CreditCard /> Tax ID <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="taxId"
                    className={`form-input ${touched.taxId && formData.taxId ? 'valid' : ''} ${touched.taxId && !formData.taxId ? 'invalid' : ''}`}
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="เลขประจำตัวผู้เสียภาษี"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleReset} disabled={isSubmitting}>
              <ArrowCounterclockwise /> ล้างข้อมูล
            </button>
            <button type="submit" className="btn-header-upload" disabled={isSubmitting}>
              {isSubmitting ? <>กำลังบันทึก...</> : (<><CheckCircleFill /> บันทึกข้อมูล</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
