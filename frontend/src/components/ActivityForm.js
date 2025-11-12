import React, { useState, useEffect } from 'react';
import { XCircle } from 'react-bootstrap-icons';
import './ActivityForm.css';

const ActivityForm = ({ activity, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    serviceCode: '',
    activityType: '',
    projectName: '',
    projectStatus: '',
    dueDate: ''
  });

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
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="activity-form">
      <h3 style={{ marginTop: 0 }}>{activity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}</h3>
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

export default ActivityForm;
