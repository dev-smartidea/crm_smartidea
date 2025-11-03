import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BellFill, CheckCircleFill, ClockFill, ExclamationTriangleFill, PersonPlusFill, CashCoin, TrashFill, XCircle, ArrowClockwise } from 'react-bootstrap-icons';
import { Link } from 'react-router-dom';
import './NotificationPage.css';

export default function NotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, service, customer, transaction, unread, read
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState('single'); // 'single' or 'all'
  const itemsPerPage = 20;

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;
  const DUE_SOON_WINDOW_DAYS = 1; // ปรับจำนวนวันสำหรับ "ใกล้ครบกำหนด" (ฝั่งหน้าเว็บ)

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await axios.get(`${api}/api/notifications?windowDays=${DUE_SOON_WINDOW_DAYS}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [api, token, DUE_SOON_WINDOW_DAYS]);

  // โหลดข้อมูลเมื่อเปิดหน้าและทุกครั้งที่กลับมาดูหน้านี้
  useEffect(() => {
    fetchNotifications();

    // Auto-refresh ทุก 30 วินาทีเมื่ออยู่ในหน้านี้
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    // Cleanup interval เมื่อออกจากหน้า
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh เมื่อกลับมาที่หน้า (window focus)
  useEffect(() => {
    const handleFocus = () => {
      fetchNotifications();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${api}/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const notificationIds = notifications.map(n => n._id);
      await axios.put(`${api}/api/notifications/read-all`, 
        { notificationIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    setNotificationToDelete(notificationId);
    setDeleteType('single');
    setShowDeleteConfirm(true);
  };

  const deleteAllRead = async () => {
    const readNotifications = notifications.filter(n => n.isRead);
    
    if (readNotifications.length === 0) {
      alert('⚠️ ไม่มีการแจ้งเตือนที่อ่านแล้วให้ลบ');
      return;
    }

    setDeleteType('all');
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteType === 'single') {
        setNotifications(notifications.filter(n => n._id !== notificationToDelete));
        // Note: If backend supports DELETE endpoint, uncomment below
        // await axios.delete(`${api}/api/notifications/${notificationToDelete}`, {
        //   headers: { Authorization: `Bearer ${token}` }
        // });
      } else {
        setNotifications(notifications.filter(n => !n.isRead));
        // Note: If backend supports batch DELETE, uncomment below
        // const readIds = notifications.filter(n => n.isRead).map(n => n._id);
        // await axios.delete(`${api}/api/notifications/batch`, {
        //   data: { notificationIds: readIds },
        //   headers: { Authorization: `Bearer ${token}` }
        // });
      }
      setShowDeleteConfirm(false);
      setNotificationToDelete(null);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      alert('เกิดข้อผิดพลาดในการลบการแจ้งเตือน');
      fetchNotifications();
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
          {deleteType === 'single' 
            ? 'คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนนี้? การกระทำนี้ไม่สามารถย้อนกลับได้'
            : `คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนที่อ่านแล้วทั้งหมด (${notifications.filter(n => n.isRead).length} รายการ)? การกระทำนี้ไม่สามารถย้อนกลับได้`
          }
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

  const getIcon = (type) => {
    switch (type) {
      case 'service_due_soon':
      case 'service_overdue':
        return <ClockFill className="notif-icon warning" />;
      case 'new_customer':
        return <PersonPlusFill className="notif-icon success" />;
      case 'new_transaction':
        return <CashCoin className="notif-icon info" />;
      default:
        return <BellFill className="notif-icon" />;
    }
  };

  const getPriority = (type) => {
    if (type === 'service_overdue') return 'high';
    if (type === 'service_due_soon') return 'medium';
    return 'low';
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    if (filter === 'service') return n.type.includes('service');
    if (filter === 'customer') return n.type.includes('customer');
    if (filter === 'transaction') return n.type.includes('transaction');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const readCount = notifications.length - unreadCount;

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotifications = filteredNotifications.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="notification-page">
        <div className="notification-container">
          <div className="loading-text">กำลังโหลดการแจ้งเตือน...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-page fade-up">
      {showDeleteConfirm && <DeleteConfirmModal />}
      <div className="notification-container">
        {/* Header */}
        <div className="notification-header">
          <div className="header-left">
            <BellFill className="header-icon" />
            <h2 className="header-title">การแจ้งเตือน</h2>
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </div>
          <div className="header-actions">
            <button 
              className="btn-refresh" 
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              title="รีเฟรชข้อมูล"
            >
              <ArrowClockwise className={refreshing ? 'spinning' : ''} /> 
              {refreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
            {unreadCount > 0 && (
              <button className="btn-mark-all" onClick={markAllAsRead}>
                <CheckCircleFill /> ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
              </button>
            )}
            {readCount > 0 && (
              <button className="btn-delete-all" onClick={deleteAllRead}>
                <TrashFill /> ลบที่อ่านแล้วทั้งหมด
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="notification-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            ทั้งหมด {notifications.length > 0 && `(${notifications.length})`}
          </button>
          <button 
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => handleFilterChange('unread')}
          >
            ยังไม่ได้อ่าน {`(${unreadCount})`}
          </button>
          <button 
            className={`filter-btn ${filter === 'read' ? 'active' : ''}`}
            onClick={() => handleFilterChange('read')}
          >
            อ่านแล้ว {`(${readCount})`}
          </button>
          <button 
            className={`filter-btn ${filter === 'service' ? 'active' : ''}`}
            onClick={() => handleFilterChange('service')}
          >
            บริการ
          </button>
          <button 
            className={`filter-btn ${filter === 'customer' ? 'active' : ''}`}
            onClick={() => handleFilterChange('customer')}
          >
            ลูกค้า
          </button>
          <button 
            className={`filter-btn ${filter === 'transaction' ? 'active' : ''}`}
            onClick={() => handleFilterChange('transaction')}
          >
            การเงิน
          </button>
        </div>

        {/* Notification List */}
        <div className="notification-list">
          {currentNotifications.length > 0 ? (
            currentNotifications.map((notif) => (
              <div 
                key={notif._id} 
                className={`notification-item ${!notif.isRead ? 'unread' : ''} priority-${getPriority(notif.type)}`}
              >
                <div className="notif-icon-wrapper">
                  {getIcon(notif.type)}
                  {!notif.isRead && <span className="unread-dot"></span>}
                </div>
                <div className="notif-content">
                  <h4 className="notif-title">{notif.title}</h4>
                  <p className="notif-message">{notif.message}</p>
                  <div className="notif-footer">
                    <span className="notif-time">
                      {new Date(notif.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {notif.link && (
                      <Link to={notif.link} className="notif-link">
                        ดูรายละเอียด →
                      </Link>
                    )}
                  </div>
                </div>
                <div className="notif-actions">
                  {!notif.isRead && (
                    <button 
                      className="btn-mark-read"
                      onClick={() => markAsRead(notif._id)}
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                    >
                      <CheckCircleFill />
                    </button>
                  )}
                  {notif.isRead && (
                    <button 
                      className="btn-delete-notif"
                      onClick={() => deleteNotification(notif._id)}
                      title="ลบการแจ้งเตือน"
                    >
                      <TrashFill />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-notifications">
              <BellFill size={64} className="empty-icon" />
              <h3>ไม่มีการแจ้งเตือน</h3>
              <p>คุณไม่มีการแจ้งเตือนใหม่ในขณะนี้</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← ก่อนหน้า
            </button>
            
            <div className="pagination-info">
              <span className="page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`page-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </span>
            </div>

            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
