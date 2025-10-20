import React, { useState } from 'react';
import axios from 'axios';
import { PersonPlusFill, TelephoneFill, Line, Facebook, Globe, BriefcaseFill, CheckCircleFill, ArrowCounterclockwise } from 'react-bootstrap-icons';
import './AddCustomerPage.css';

export default function AddCustomerPage() {

  const initialFormState = {
    name: '',
    phone: '',
    lineId: '',
    facebook: '',
    website: '',
    service: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [touched, setTouched] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBlur = (e) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  // Calculate form completion percentage
  const calculateProgress = () => {
    const requiredFields = ['name', 'phone', 'service'];
    const optionalFields = ['lineId', 'facebook', 'website'];
    const allFields = [...requiredFields, ...optionalFields];
    
    const filledFields = allFields.filter(field => formData[field]?.trim()).length;
    return Math.round((filledFields / allFields.length) * 100);
  };

  const progress = calculateProgress();

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitSuccess(false);
    setTouched({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${process.env.REACT_APP_API_URL}/api/customers`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        handleReset();
        setIsSubmitting(false);
      }, 2000); // Reset form after 2 seconds
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการเพิ่มลูกค้า');
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
          
          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-info">
              <span className="progress-label">ความสมบูรณ์ของข้อมูล</span>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
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
              <h3 className="card-title">ข้อมูลส่วนตัว</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">
                    <PersonPlusFill /> ชื่อ-นามสกุล <span className="required">*</span>
                  </label>
                  <input 
                    type="text" 
                    id="name" 
                    className={`form-input ${touched.name && formData.name ? 'valid' : ''} ${touched.name && !formData.name ? 'invalid' : ''}`}
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="กรอกชื่อ-นามสกุล"
                    required 
                  />
                </div>
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
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="card-header">
              <Globe className="card-icon" />
              <h3 className="card-title">ช่องทางการติดต่อ</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="lineId">
                    <Line /> Line ID
                  </label>
                  <input 
                    type="text" 
                    id="lineId" 
                    className={`form-input ${formData.lineId ? 'valid' : ''}`}
                    name="lineId" 
                    value={formData.lineId} 
                    onChange={handleChange}
                    placeholder="Line ID"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="facebook">
                    <Facebook /> Facebook
                  </label>
                  <input 
                    type="text" 
                    id="facebook" 
                    className={`form-input ${formData.facebook ? 'valid' : ''}`}
                    name="facebook" 
                    value={formData.facebook} 
                    onChange={handleChange}
                    placeholder="Facebook URL หรือ Username"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="website">
                  <Globe /> เว็บไซต์
                </label>
                <input 
                  type="text" 
                  id="website" 
                  className={`form-input ${formData.website ? 'valid' : ''}`}
                  name="website" 
                  value={formData.website} 
                  onChange={handleChange}
                  placeholder="https://www.example.com"
                />
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="card-header">
              <BriefcaseFill className="card-icon" />
              <h3 className="card-title">ข้อมูลธุรกิจ</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label htmlFor="service">
                  <BriefcaseFill /> สินค้า / บริการที่สนใจ <span className="required">*</span>
                </label>
                <input 
                  type="text" 
                  id="service" 
                  className={`form-input ${touched.service && formData.service ? 'valid' : ''} ${touched.service && !formData.service ? 'invalid' : ''}`}
                  name="service" 
                  value={formData.service} 
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="ระบุสินค้าหรือบริการที่ลูกค้าสนใจ"
                  required 
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleReset} disabled={isSubmitting}>
              <ArrowCounterclockwise /> ล้างข้อมูล
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>กำลังบันทึก...</>
              ) : (
                <><CheckCircleFill /> บันทึกข้อมูล</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
