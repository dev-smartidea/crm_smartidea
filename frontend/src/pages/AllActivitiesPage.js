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
