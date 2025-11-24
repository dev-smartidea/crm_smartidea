import React, { useState, useEffect, useRef } from 'react';
import { EyeFill, CheckCircle, TrashFill, ThreeDotsVertical } from 'react-bootstrap-icons';
import './ActivityList.css';
import '../pages/CustomerListPage.css'; // reuse dropdown styles

const ActivityList = ({ activities, onEdit, onDelete, onComplete }) => {
  // Track a single open dropdown menu by activity id
  const [openMenuId, setOpenMenuId] = useState(null);
  const listRef = useRef(null);

  // Close menu when clicking outside any dropdown-container inside this list
  useEffect(() => {
    const handleOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);
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
    if (status === 'เสร็จสิ้น') return 'badge-status-completed';
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
            <tr key={activity._id} className={openMenuId === activity._id ? 'has-open-dropdown' : ''}>
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
                <ActivityRowMenu
                  activity={activity}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onComplete={onComplete}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityList;

// Row-level dropdown menu component
const ActivityRowMenu = ({ activity, onEdit, onDelete, onComplete, openMenuId, setOpenMenuId }) => {
  const isOpen = openMenuId === activity._id;
  const toggle = (e) => {
    // ป้องกัน event จากการวิ่งไปถึง document และไปปิด dropdown ทิ้งก่อนที่ toggle จะทำงาน
    e.stopPropagation();
    // ใช้ functional update เพื่อหลีกเลี่ยงค่า state เก่าจาก closure
    setOpenMenuId((prev) => (prev === activity._id ? null : activity._id));
  };
  const close = () => setOpenMenuId(null);
  const handleComplete = () => {
    if (activity.projectStatus === 'เสร็จสิ้น') return;
    onComplete(activity._id);
    close();
  };
  return (
    <div className="dropdown-container">
      <button 
        className="btn-dropdown-toggle" 
        onClick={toggle}
      >
        <ThreeDotsVertical />
      </button>
      {isOpen && (
        <div className="dropdown-menu-custom">
          <button className="dropdown-item" onClick={() => { onEdit(activity); close(); }}>
            <EyeFill /> ดูรายละเอียด / แก้ไข
          </button>
          <button
            className="dropdown-item"
            onClick={handleComplete}
            disabled={activity.projectStatus === 'เสร็จสิ้น'}
            style={{ opacity: activity.projectStatus === 'เสร็จสิ้น' ? 0.5 : 1 }}
          >
            {activity.projectStatus === 'เสร็จสิ้น' ? (
              <><CheckCircle /> เสร็จสิ้นแล้ว</>
            ) : (
              <><CheckCircle /> ทำเครื่องหมายเสร็จสิ้น</>
            )}
          </button>
          <button className="dropdown-item danger" onClick={() => { onDelete(activity._id); close(); }}>
            <TrashFill /> ลบ
          </button>
        </div>
      )}
    </div>
  );
};
