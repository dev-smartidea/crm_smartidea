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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitSuccess(false);
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
          <PersonPlusFill className="form-header-icon" />
          <h2 className="form-header-title">เพิ่มข้อมูลลูกค้าใหม่</h2>
        </div>

        {submitSuccess && (
          <div className="alert alert-success d-flex align-items-center" role="alert">
            <CheckCircleFill className="me-2" />
            <div>
              เพิ่มข้อมูลลูกค้าเรียบร้อยแล้ว!
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="form-section-title">ข้อมูลส่วนตัว</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name"><PersonPlusFill /> ชื่อ-นามสกุล <span className="required-star">*</span></label>
                <input type="text" id="name" className="form-control" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="phone"><TelephoneFill /> เบอร์โทรศัพท์ <span className="required-star">*</span></label>
                <input type="text" id="phone" className="form-control" name="phone" value={formData.phone} onChange={handleChange} required />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">ช่องทางการติดต่อ</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="lineId"><Line /> Line ID</label>
                <input type="text" id="lineId" className="form-control" name="lineId" value={formData.lineId} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="facebook"><Facebook /> Facebook</label>
                <input type="text" id="facebook" className="form-control" name="facebook" value={formData.facebook} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="website"><Globe /> เว็บไซต์</label>
                <input type="text" id="website" className="form-control" name="website" value={formData.website} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">ข้อมูลธุรกิจ</h3>
            <div className="form-group">
              <label htmlFor="service"><BriefcaseFill /> สินค้า / บริการที่สนใจ <span className="required-star">*</span></label>
              <input type="text" id="service" className="form-control" name="service" value={formData.service} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-reset" onClick={handleReset} disabled={isSubmitting}>
              <ArrowCounterclockwise /> ล้างข้อมูล
            </button>
            <button type="submit" className="btn btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังบันทึก...' : <><CheckCircleFill /> บันทึกข้อมูล</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
