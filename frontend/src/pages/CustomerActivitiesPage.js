import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ClipboardCheckFill, Plus, ArrowLeftCircle, ExclamationTriangleFill, XCircle } from 'react-bootstrap-icons';
import ActivityForm from '../components/ActivityForm';
import ActivityList from '../components/ActivityList';
import './CustomerActivitiesPage.css';

const CustomerActivitiesPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomerData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/customers/${customerId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCustomer(response.data);
    } catch (error) {
      console.error('Error fetching customer:', error);
      alert('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/customers/${customerId}/activities`,
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
    fetchCustomerData();
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleAddActivity = () => {
    setEditingActivity(null);
    setShowForm(true);
  };

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setShowForm(true);
  };

  const handleSaveActivity = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      
      if (editingActivity) {
        // Update existing activity
        await axios.put(
          `${process.env.REACT_APP_API_URL}/api/activities/${editingActivity._id}`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        alert('อัปเดตกิจกรรมสำเร็จ');
      } else {
        // Create new activity
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/customers/${customerId}/activities`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        alert('เพิ่มกิจกรรมสำเร็จ');
      }

      setShowForm(false);
      setEditingActivity(null);
      fetchActivities();
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกกิจกรรม');
    }
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
      fetchActivities();
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

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingActivity(null);
  };

  return (
    <div className="customer-activities-page">
      {showDeleteConfirm && <DeleteConfirmModal />}
      <div className="activities-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                <ClipboardCheckFill />
              </div>
              <div className="customer-info">
                <h1>จัดการกิจกรรม</h1>
                {customer && (
                  <p className="customer-name">
                    ลูกค้า: {customer.name}
                  </p>
                )}
              </div>
            </div>
            <div className="header-buttons">
              <button className="btn-back" onClick={() => navigate(-1)}>
                <ArrowLeftCircle size={18} /> กลับ
              </button>
              <button className="btn-add-activity" onClick={handleAddActivity}>
                <Plus size={20} /> เพิ่มกิจกรรม
              </button>
            </div>
          </div>
        </div>

        {/* Modal Popup for Activity Form */}
        {showForm && (
          <div className="activity-modal-overlay" onClick={handleCancelForm}>
            <div className="activity-modal-card" onClick={e => e.stopPropagation()}>
              <ActivityForm
                activity={editingActivity}
                onSave={handleSaveActivity}
                onCancel={handleCancelForm}
              />
            </div>
          </div>
        )}

        <div className="activities-section">
          {loading ? (
            <div className="loading">กำลังโหลด...</div>
          ) : (
            <ActivityList
              activities={activities}
              onEdit={handleEditActivity}
              onDelete={handleDeleteActivity}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerActivitiesPage;
