import React, { useState, useEffect, useRef } from 'react';
import { XCircle } from 'react-bootstrap-icons';
import PropTypes from 'prop-types';
import toast from '../utils/toast';
import './ActivityForm.css';

const ActivityForm = ({ activity = null, onSave = () => {}, onCancel = () => {} }) => {
  const formRef = useRef(null);
  const [formData, setFormData] = useState({
    serviceCode: '',
    activityType: '',
    projectName: '',
    projectStatus: '',
    dueDate: ''
  });
  const today = new Date().toISOString().split('T')[0];

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (activity) {
      // Edit mode - populate form with existing activity data
      setFormData({
        serviceCode: activity.serviceCode || '',
        activityType: activity.activityType || '',
        projectName: activity.projectName || '',
        projectStatus: activity.projectStatus || '',
        dueDate: activity.dueDate ? activity.dueDate.split('T')[0] : ''
      });
    }
  }, [activity]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate
    if (!formData.activityType || !formData.projectName || !formData.projectStatus || !formData.dueDate || !formData.serviceCode) {
      toast.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // ตรวจสอบวันที่ครบกำหนดไม่ให้เป็นวันที่ผ่านมาแล้ว
    if (formData.dueDate < today) {
      toast.warning('ไม่สามารถกำหนดวันที่แล้วเสร็จเป็นวันที่ผ่านมาแล้วได้');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="activity-form" ref={formRef} role="dialog" aria-modal="true" aria-label={activity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0 }}>{activity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}</h3>
        <button onClick={onCancel} type="button" style={{ background: 'none', border: '1px solid #e2e8f0', width: '34px', height: '34px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }} aria-label="ปิด">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="svc-form">
        <label>
          รหัสบริการ <span className="required">*</span>
          <input
            type="text"
            name="serviceCode"
            value={formData.serviceCode}
            onChange={handleChange}
            placeholder="กรอกรหัสบริการ"
            required
            aria-required="true"
          />
        </label>

        <label>
          ประเภทงาน <span className="required">*</span>
          <select
            name="activityType"
            value={formData.activityType}
            onChange={handleChange}
            required
          >
            <option value="">-- เลือกประเภทงาน --</option>
            <option value="งานใหม่">งานใหม่</option>
            <option value="งานแก้ไข / ปรับปรุงบัญชี">งานแก้ไข / ปรับปรุงบัญชี</option>
          </select>
        </label>

        <label>
          ชื่อ Project <span className="required">*</span>
          <input
            type="text"
            name="projectName"
            value={formData.projectName}
            onChange={handleChange}
            placeholder="กรอกชื่อโครงการ"
            required
          />
        </label>

        <label>
          สถานะ Project <span className="required">*</span>
          <select
            name="projectStatus"
            value={formData.projectStatus}
            onChange={handleChange}
            required
          >
            <option value="">-- เลือกสถานะ --</option>
            <option value="รอข้อมูล / รูปภาพ ลูกค้า">รอข้อมูล / รูปภาพ ลูกค้า</option>
            <option value="อยู่ระหว่างทำกราฟฟิก">อยู่ระหว่างทำกราฟฟิก</option>
            <option value="อยู่ระหว่างสร้างบัญชี">อยู่ระหว่างสร้างบัญชี</option>
          </select>
        </label>

        <label>
          กำหนดแล้วเสร็จ <span className="required">*</span>
          <input
            type="date"
            name="dueDate"
            min={today}
            value={formData.dueDate}
            onChange={handleChange}
            required
          />
        </label>

        <div className="svc-actions">
          <button type="button" className="btn-modal btn-modal-cancel" onClick={onCancel}>
            <XCircle /> ยกเลิก
          </button>
          <button type="submit" className="btn-modal btn-modal-save">
            {activity ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
};

ActivityForm.propTypes = {
  activity: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func
};

export default ActivityForm;
