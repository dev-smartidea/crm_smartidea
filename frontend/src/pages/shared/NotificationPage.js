import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, BellSlash, Check, CheckAll, Trash, Trash2, 
  Clock, Person, CurrencyDollar, ExclamationCircle
} from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import './NotificationPage.css';

export default function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${api}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchNotifications();
  }, [api, token]);

  // Actions
  const handleMarkAsRead = async (id) => {
    try {
      await axios.put(`${api}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Mark as read failed:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(`${api}/api/notifications/read-all`, 
        { notificationIds: notifications.map(n => n._id) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Mark all as read failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ต้องการลบการแจ้งเตือนนี้?')) return;
    
    try {
      await axios.delete(`${api}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n._id !== id));
      setSelectedIds(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`ต้องการลบ ${selectedIds.size} รายการ?`)) return;
    
    try {
      await axios.delete(`${api}/api/notifications/batch`, {
        data: { notificationIds: Array.from(selectedIds) },
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => !selectedIds.has(n._id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n._id)));
    }
  };

  const handleClickNotification = (notif) => {
    if (!notif.isRead) handleMarkAsRead(notif._id);
    if (notif.link) navigate(notif.link);
  };

  // Filter
  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedNotifications = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    read: notifications.filter(n => n.isRead).length
  };

  // Icon mapping
  const getNotificationIcon = (type) => {
    const icons = {
      'service_overdue': { icon: ExclamationCircle, color: '#ef4444' },
      'service_due_soon': { icon: Clock, color: '#f59e0b' },
      'new_customer': { icon: Person, color: '#10b981' },
      'new_transaction': { icon: CurrencyDollar, color: '#3b82f6' }
    };
    return icons[type] || { icon: Bell, color: '#6b7280' };
  };

  const formatDate = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    
    return notifDate.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: notifDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (loading) {
    return (
      <div className="notif-page">
        <div className="notif-loading">
          <div className="spinner"></div>
          <p>กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notif-page">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <Bell size={28} className="notif-header-icon" />
          <div>
            <h1 className="notif-title">การแจ้งเตือน</h1>
            <p className="notif-subtitle">
              {stats.total} รายการ • {stats.unread} ยังไม่ได้อ่าน
            </p>
          </div>
        </div>

        <div className="notif-header-actions">
          {stats.unread > 0 && (
            <button className="notif-btn notif-btn-primary" onClick={handleMarkAllAsRead}>
              <CheckAll size={18} />
              <span>อ่านทั้งหมด</span>
            </button>
          )}
          {selectedIds.size > 0 && (
            <button className="notif-btn notif-btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={18} />
              <span>ลบที่เลือก ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notif-tabs">
        <button 
          className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span>ทั้งหมด</span>
          <span className="notif-tab-badge">{stats.total}</span>
        </button>
        <button 
          className={`notif-tab ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          <span>ยังไม่ได้อ่าน</span>
          {stats.unread > 0 && <span className="notif-tab-badge primary">{stats.unread}</span>}
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {filtered.length > 0 && (
        <div className="notif-bulk-bar">
          <label className="notif-checkbox-label">
            <input 
              type="checkbox" 
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={handleSelectAll}
            />
            <span>เลือกทั้งหมด</span>
          </label>
          <span className="notif-bulk-info">
            {selectedIds.size > 0 ? `เลือกแล้ว ${selectedIds.size} รายการ` : `${filtered.length} รายการ`}
          </span>
        </div>
      )}

      {/* Notification List */}
      <div className="notif-list">
        {filtered.length === 0 ? (
          <div className="notif-empty">
            <BellSlash size={64} className="notif-empty-icon" />
            <h3>ไม่มีการแจ้งเตือน</h3>
            <p>คุณไม่มีการแจ้งเตือน{filter === 'unread' ? 'ที่ยังไม่ได้อ่าน' : ''}ในขณะนี้</p>
          </div>
        ) : (
          paginatedNotifications.map(notif => {
            const iconData = getNotificationIcon(notif.type);
            const IconComponent = iconData.icon;
            
            return (
              <div 
                key={notif._id} 
                className={`notif-item ${!notif.isRead ? 'unread' : ''} ${selectedIds.has(notif._id) ? 'selected' : ''}`}
              >
                <div className="notif-item-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(notif._id)}
                    onChange={() => handleToggleSelect(notif._id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div 
                  className="notif-item-content"
                  onClick={() => handleClickNotification(notif)}
                  style={{ cursor: notif.link ? 'pointer' : 'default' }}
                >
                  <div 
                    className="notif-item-icon" 
                    style={{ backgroundColor: iconData.color + '15', color: iconData.color }}
                  >
                    <IconComponent size={20} />
                  </div>

                  <div className="notif-item-body">
                    <div className="notif-item-header">
                      <h4 className="notif-item-title">{notif.title}</h4>
                      <span className="notif-item-time">{formatDate(notif.createdAt)}</span>
                    </div>
                    <p className="notif-item-message">{notif.message}</p>
                  </div>

                  {!notif.isRead && <div className="notif-item-dot"></div>}
                </div>

                <div className="notif-item-actions">
                  {!notif.isRead && (
                    <button 
                      className="notif-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif._id);
                      }}
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                    >
                      <Check size={18} />
                    </button>
                  )}
                  <button 
                    className="notif-action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notif._id);
                    }}
                    title="ลบ"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="notif-pagination">
          <button 
            className="notif-page-btn"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            ก่อนหน้า
          </button>
          
          <div className="notif-page-numbers">
            {[...Array(totalPages)].map((_, index) => {
              const pageNum = index + 1;
              // Show first, last, current, and adjacent pages
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    className={`notif-page-num ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              } else if (
                pageNum === currentPage - 2 ||
                pageNum === currentPage + 2
              ) {
                return <span key={pageNum} className="notif-page-dots">...</span>;
              }
              return null;
            })}
          </div>

          <button 
            className="notif-page-btn"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            ถัดไป
          </button>
          
          <span className="notif-page-info">
            หน้า {currentPage} จาก {totalPages} ({filtered.length} รายการ)
          </span>
        </div>
      )}
    </div>
  );
}
