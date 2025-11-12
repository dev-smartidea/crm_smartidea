import React from 'react';
import './ActivityList.css';

const ActivityList = ({ activities, onEdit, onDelete }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeBadgeClass = (type) => {
    if (type === 'งานใหม่') return 'badge-type-new';
    if (type === 'งานแก้ไข / ปรับปรุงบัญชี') return 'badge-type-edit';
    return '';
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'รอข้อมูล / รูปภาพ ลูกค้า') return 'badge-status-waiting';
    if (status === 'อยู่ระหว่างทำกราฟฟิก') return 'badge-status-designing';
    if (status === 'อยู่ระหว่างสร้างบัญชี') return 'badge-status-creating';
    return '';
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="no-activities">
        <p>ยังไม่มีกิจกรรมสำหรับลูกค้านี้</p>
      </div>
    );
  }

  return (
    <div className="activity-list">
      <table>
        <thead>
          <tr>
            <th>รหัสบริการ</th>
            <th>ประเภทงาน</th>
            <th>ชื่อ Project</th>
            <th>สถานะ</th>
            <th>กำหนดเสร็จ</th>
            <th>สร้างเมื่อ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={activity._id}>
              <td>{activity.serviceCode || '-'}</td>
              <td>
                <span className={`badge ${getTypeBadgeClass(activity.activityType)}`}>
                  {activity.activityType}
                </span>
              </td>
              <td>{activity.projectName}</td>
              <td>
                <span className={`badge ${getStatusBadgeClass(activity.projectStatus)}`}>
                  {activity.projectStatus}
                </span>
              </td>
              <td>{formatDate(activity.dueDate)}</td>
              <td>{formatDate(activity.createdAt)}</td>
              <td>
                <div className="action-buttons">
                  <button
                    className="btn-edit"
                    onClick={() => onEdit(activity)}
                    title="แก้ไข"
                  >
                    แก้ไข
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => onDelete(activity._id)}
                    title="ลบ"
                  >
                    ลบ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityList;
