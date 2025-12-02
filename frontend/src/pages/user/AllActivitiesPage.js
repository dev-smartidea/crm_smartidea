import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ClipboardCheckFill, Search, Calendar, Person, ArrowLeftCircle, ExclamationTriangleFill, XCircle } from 'react-bootstrap-icons';
import './AllActivitiesPage.css';

const AllActivitiesPage = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    activityType: '',
    projectStatus: '',
    dueDate: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const fetchAllActivities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/activities`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
      alert('ไม่สามารถโหลดกิจกรรมได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllActivities();
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
    return '';
  };

  const handleDeleteActivity = async (activityId) => {
    setActivityToDelete(activityId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/activities/${activityToDelete}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowDeleteConfirm(false);
      setActivityToDelete(null);
      fetchAllActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('ไม่สามารถลบกิจกรรมได้');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setEditForm({
      projectName: activity.projectName || '',
      activityType: activity.activityType || '',
      projectStatus: activity.projectStatus || '',
      dueDate: activity.dueDate ? new Date(activity.dueDate).toISOString().split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingActivity) return;
    
    // ตรวจสอบวันที่ครบกำหนดไม่ให้เป็นวันที่ผ่านมาแล้ว
    if (editForm.dueDate && editForm.dueDate < today) {
      alert('ไม่สามารถกำหนดวันที่แล้วเสร็จเป็นวันที่ผ่านมาแล้วได้');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/activities/${editingActivity._id}`,
        editForm,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowEditModal(false);
      setEditingActivity(null);
      fetchAllActivities();
    } catch (error) {
      console.error('Error updating activity:', error);
      alert('ไม่สามารถอัพเดทกิจกรรมได้');
    } finally {
      setIsSaving(false);
    }
  };

  const DeleteConfirmModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <ExclamationTriangleFill />
          <h3>ยืนยันการลบ</h3>
        </div>
        <div className="modal-body">
          คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรมนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
          </button>
        </div>
      </div>
    </div>
  );

  const EditActivityModal = () => (
    <div className="modal-backdrop">
      <div className="modal-content edit-modal">
        <div className="modal-header">
          <h3>แก้ไขกิจกรรม</h3>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>ชื่อ Project</label>
            <input
              type="text"
              value={editForm.projectName}
              onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
              placeholder="ระบุชื่อโครงการ"
            />
          </div>
          
          <div className="form-group">
            <label>ประเภทงาน</label>
            <select
              value={editForm.activityType}
              onChange={(e) => setEditForm({ ...editForm, activityType: e.target.value })}
            >
              <option value="งานใหม่">งานใหม่</option>
              <option value="งานแก้ไข / ปรับปรุงบัญชี">งานแก้ไข / ปรับปรุงบัญชี</option>
            </select>
          </div>

          <div className="form-group">
            <label>สถานะ</label>
            <select
              value={editForm.projectStatus}
              onChange={(e) => setEditForm({ ...editForm, projectStatus: e.target.value })}
            >
              <option value="รอข้อมูล / รูปภาพ ลูกค้า">รอข้อมูล / รูปภาพ ลูกค้า</option>
              <option value="อยู่ระหว่างทำกราฟฟิก">อยู่ระหว่างทำกราฟฟิก</option>
              <option value="อยู่ระหว่างสร้างบัญชี">อยู่ระหว่างสร้างบัญชี</option>
            </select>
          </div>

          <div className="form-group">
            <label>วันที่กำหนดเสร็จ</label>
            <input
              type="date"
              min={today}
              value={editForm.dueDate}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={isSaving}>
            <XCircle /> ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={handleSaveEdit} disabled={isSaving}>
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = 
      activity.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.serviceCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.customerId?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || activity.activityType === filterType;
    const matchesStatus = filterStatus === 'all' || activity.projectStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="all-activities-page">
      {showDeleteConfirm && <DeleteConfirmModal />}
      {showEditModal && <EditActivityModal />}
      <div className="activities-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <ClipboardCheckFill />
              </div>
              <div>
                <h1>กิจกรรมทั้งหมด</h1>
                <p className="subtitle">รายการกิจกรรมทั้งหมดของคุณ</p>
              </div>
            </div>
            <div className="header-buttons">
              <button className="btn-back" onClick={() => navigate('/dashboard')}>
                <ArrowLeftCircle size={18} /> กลับ
              </button>
            </div>
          </div>
        </div>

        {/* Filter Section - 3 column grid */}
        <div className="filter-section">
          <div className="filter-item">
            <div className="field-label">ค้นหาลูกค้า</div>
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ Project, รหัสบริการ, ลูกค้า..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-item">
            <div className="field-label">ประเภทงาน</div>
            <select
              className="select-field"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="งานใหม่">งานใหม่</option>
              <option value="งานแก้ไข / ปรับปรุงบัญชี">งานแก้ไข / ปรับปรุงบัญชี</option>
            </select>
          </div>

          <div className="filter-item">
            <div className="field-label">สถานะ</div>
            <select
              className="select-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="รอข้อมูล / รูปภาพ ลูกค้า">รอข้อมูล / รูปภาพ ลูกค้า</option>
              <option value="อยู่ระหว่างทำกราฟฟิก">อยู่ระหว่างทำกราฟฟิก</option>
              <option value="อยู่ระหว่างสร้างบัญชี">อยู่ระหว่างสร้างบัญชี</option>
            </select>
          </div>
        </div>

        {/* Activities Count */}
        <div className="activities-count">
          <strong>ทั้งหมด {filteredActivities.length} กิจกรรม</strong>
        </div>

        {/* Activities Table */}
        <div className="activities-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="no-activities">
              <ClipboardCheckFill size={64} />
              <p>ไม่พบกิจกรรมที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="activities-table">
                <thead>
                  <tr>
                    <th>ลูกค้า</th>
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
                  {filteredActivities.map((activity) => (
                    <tr key={activity._id}>
                      <td>
                        <div className="customer-cell">
                          <Person size={16} />
                          <span>{activity.customerId?.name || '-'}</span>
                        </div>
                      </td>
                      <td>{activity.serviceCode || '-'}</td>
                      <td>
                        <span className={`badge ${getTypeBadgeClass(activity.activityType)}`}>
                          {activity.activityType}
                        </span>
                      </td>
                      <td className="project-name">{activity.projectName}</td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(activity.projectStatus)}`}>
                          {activity.projectStatus}
                        </span>
                      </td>
                      <td>
                        <div className="date-cell">
                          <Calendar size={14} />
                          {formatDate(activity.dueDate)}
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          <Calendar size={14} />
                          {formatDate(activity.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-view"
                            onClick={() => navigate(`/dashboard/customers/${activity.customerId?._id}/activities`)}
                            title="ดูรายละเอียด"
                          >
                            ดู
                          </button>
                          <button
                            className="btn-edit-small"
                            onClick={() => handleEditActivity(activity)}
                            title="แก้ไข"
                          >
                            แก้ไข
                          </button>
                          <button
                            className="btn-delete-small"
                            onClick={() => handleDeleteActivity(activity._id)}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AllActivitiesPage;
