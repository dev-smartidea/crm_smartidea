import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Image as ImageIcon, Search, Upload, Trash, Eye, X } from 'react-bootstrap-icons';
import './ImageGalleryPage.css';

export default function ImageGalleryPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerServices, setCustomerServices] = useState([]);
  const [serviceFilter, setServiceFilter] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    customerName: '',
    service: 'Google Ads',
    imageFile: null,
    description: ''
  });
  // Upload modal combobox states
  const [uploadSelectedCustomerId, setUploadSelectedCustomerId] = useState('');
  const [uploadCustomerQuery, setUploadCustomerQuery] = useState('');
  const [uploadShowCustomerDropdown, setUploadShowCustomerDropdown] = useState(false);
  const [uploadCustomerServices, setUploadCustomerServices] = useState([]);
  const [uploadServiceQuery, setUploadServiceQuery] = useState('');
  const [uploadShowServiceDropdown, setUploadShowServiceDropdown] = useState(false);

  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  // ดึงรายชื่อลูกค้าทั้งหมด
  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${api}/api/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  // ดึงบริการของลูกค้าที่เลือก
  const fetchCustomerServices = async (customerId) => {
    if (!customerId) {
      setCustomerServices([]);
      return;
    }
    try {
      const res = await axios.get(`${api}/api/customers/${customerId}/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomerServices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch customer services:', err);
      setCustomerServices([]);
    }
  };
  // ดึงบริการของลูกค้าที่เลือก (สำหรับ Upload Modal)
  const fetchUploadCustomerServices = async (customerId) => {
    if (!customerId) {
      setUploadCustomerServices([]);
      return;
    }
    try {
      const res = await axios.get(`${api}/api/customers/${customerId}/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadCustomerServices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch upload customer services:', err);
      setUploadCustomerServices([]);
    }
  };

  const fetchImages = async (override) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const effectiveCustomerId = override?.customerId ?? selectedCustomerId;
      const effectiveService = override?.serviceName ?? serviceFilter;
      if (effectiveCustomerId) {
        const customer = customers.find(c => c._id === effectiveCustomerId);
        if (customer) {
          params.append('customer', customer.name);
        }
      }
      if (effectiveService) params.append('service', effectiveService);
      
      const res = await axios.get(`${api}/api/images?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImages(res.data || []);
    } catch (err) {
      console.error('Failed to fetch images:', err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchImages();
  }, []);

  useEffect(() => {
    fetchCustomerServices(selectedCustomerId);
    setServiceFilter(''); // รีเซ็ตตัวกรองบริการเมื่อเปลี่ยนลูกค้า
    setServiceQuery('');  // เคลียร์ข้อความที่พิมพ์ในช่องบริการด้วย
  }, [selectedCustomerId]);

  const handleSearch = (e) => {
    e.preventDefault();
    // Map typed customer text to ID if not explicitly selected
    let customerId = selectedCustomerId;
    if (!customerId && customerQuery) {
      const match = customers.find(c => {
        const shortId = (c._id || '').toString().slice(-6).toUpperCase();
        const label = `${shortId} : ${c.name}`;
        return label.toLowerCase() === customerQuery.toLowerCase();
      });
      if (match) customerId = match._id;
    }
    // Map typed service text to name if not explicitly selected
    let serviceName = serviceFilter;
    if (!serviceName && serviceQuery) {
      const matchSvc = customerServices.find(svc => {
        const idText = (svc.customerIdField || '-');
        const pageText = (svc.pageUrl || '-');
        const label = `${svc.name} — ${idText} — ${pageText}`;
        return label.toLowerCase() === serviceQuery.toLowerCase();
      });
      if (matchSvc) serviceName = matchSvc.name;
    }
    fetchImages({ customerId, serviceName });
  };

  const handleCustomerChange = (customerId) => {
    setSelectedCustomerId(customerId);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.imageFile) {
      alert('กรุณาเลือกรูปภาพ');
      return;
    }

    const formData = new FormData();
    formData.append('image', uploadForm.imageFile);
    formData.append('customerName', uploadForm.customerName);
    formData.append('service', uploadForm.service);
    formData.append('description', uploadForm.description);

    try {
      await axios.post(`${api}/api/images`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setShowUploadModal(false);
      setUploadForm({
        customerName: '',
        service: 'Google Ads',
        imageFile: null,
        description: ''
      });
      fetchImages();
    } catch (err) {
      alert('อัปโหลดรูปภาพไม่สำเร็จ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพนี้?')) return;
    
    try {
      await axios.delete(`${api}/api/images/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchImages();
    } catch (err) {
      alert('ลบรูปภาพไม่สำเร็จ');
    }
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  return (
    <div className="image-gallery-page fade-up">
      <div className="gallery-container">
        <div className="gallery-header">
          <div className="gallery-header-title">
            <ImageIcon className="gallery-icon" />
            <h2>คลังรูปภาพ</h2>
          </div>
          <button className="btn-header-upload" onClick={() => setShowUploadModal(true)}>
            <Upload /> อัปโหลดรูปภาพ
          </button>
        </div>

        {/* Search and Filter */}
        <form onSubmit={handleSearch} className="gallery-filters">
          <div className="filter-group">
            <label>รายชื่อลูกค้า</label>
            <div className="combo">
              <input
                type="text"
                className="form-control combo-input"
                placeholder="พิมพ์ชื่อลูกค้า..."
                value={customerQuery}
                onFocus={() => setShowCustomerDropdown(true)}
                onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true); }}
              />
              {showCustomerDropdown && (
                <div className="combo-panel" onMouseLeave={() => setShowCustomerDropdown(false)}>
                  <div
                    className="combo-item"
                    onMouseDown={() => { setSelectedCustomerId(''); setCustomerQuery('ทั้งหมด'); setShowCustomerDropdown(false); setCustomerServices([]); setServiceQuery(''); setServiceFilter(''); }}
                  >ทั้งหมด</div>
                  {customers
                    .filter(c => {
                      const shortId = (c._id || '').toString().slice(-6).toUpperCase();
                      const label = `${shortId} : ${c.name}`;
                      return label.toLowerCase().includes(customerQuery.toLowerCase());
                    })
                    .slice(0, 50)
                    .map(c => {
                      const shortId = (c._id || '').toString().slice(-6).toUpperCase();
                      const label = `${shortId} : ${c.name}`;
                      return (
                        <div
                          key={c._id}
                          className="combo-item"
                          onMouseDown={() => { 
                            setSelectedCustomerId(c._id); 
                            setCustomerQuery(label); 
                            setShowCustomerDropdown(false);
                            setServiceQuery('');
                            setServiceFilter('');
                          }}
                        >
                          {label}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          <div className="filter-group">
            <label>บริการ</label>
            <div className="combo">
              <input
                type="text"
                className="form-control combo-input"
                placeholder={selectedCustomerId ? 'พิมพ์ชื่อบริการ...' : 'เลือกชื่อลูกค้าก่อน'}
                value={serviceQuery}
                disabled={!selectedCustomerId}
                onFocus={() => { if (selectedCustomerId) setShowServiceDropdown(true); }}
                onChange={(e) => { setServiceQuery(e.target.value); if (selectedCustomerId) setShowServiceDropdown(true); }}
              />
              {showServiceDropdown && selectedCustomerId && (
                <div className="combo-panel" onMouseLeave={() => setShowServiceDropdown(false)}>
                  {customerServices
                    .filter(svc => {
                      const idText = (svc.customerIdField || '-');
                      const pageText = (svc.pageUrl || '-');
                      const label = `${svc.name} — ${idText} — ${pageText}`;
                      return label.toLowerCase().includes(serviceQuery.toLowerCase());
                    })
                    .slice(0, 50)
                    .map(svc => {
                      const idText = (svc.customerIdField || '-');
                      const pageText = (svc.pageUrl || '-');
                      const label = `${svc.name} — ${idText} — ${pageText}`;
                      return (
                        <div
                          key={svc._id}
                          className="combo-item"
                          onMouseDown={() => { setServiceQuery(label); setServiceFilter(svc.name); setShowServiceDropdown(false); }}
                        >
                          {label}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="btn btn-search">
            <Search /> ค้นหา
          </button>
        </form>

        {/* Gallery Grid */}
        <div className="gallery-content">
          {loading ? (
            <div className="gallery-loading">กำลังโหลดรูปภาพ...</div>
          ) : images.length > 0 ? (
            <div className="gallery-grid">
              {images.map((img) => (
                <div key={img._id} className="gallery-item">
                  <div className="gallery-item-image" onClick={() => handleImageClick(img)}>
                    <img src={`${api}${img.imageUrl}`} alt={img.customerName} />
                    <div className="gallery-item-overlay">
                      <Eye size={24} />
                    </div>
                  </div>
                  <div className="gallery-item-info">
                    <div className="gallery-item-details">
                      <h4>{img.customerName}</h4>
                      <span className={`badge ${img.service === 'Google Ads' ? 'badge-google' : 'badge-facebook'}`}>
                        {img.service}
                      </span>
                    </div>
                    <button 
                      className="btn-icon-delete" 
                      onClick={() => handleDelete(img._id)}
                      title="ลบ"
                    >
                      <Trash />
                    </button>
                  </div>
                  {img.description && (
                    <p className="gallery-item-desc">{img.description}</p>
                  )}
                  <p className="gallery-item-date">
                    {new Date(img.createdAt).toLocaleDateString('th-TH')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="gallery-empty">
              <ImageIcon size={64} />
              <p>ยังไม่มีรูปภาพในคลัง</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>อัปโหลดรูปภาพ</h3>
              <button className="btn-close" onClick={() => setShowUploadModal(false)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleUpload} className="upload-form">
              <div className="form-group">
                <label>ชื่อลูกค้า</label>
                <div className="combo">
                  <input
                    type="text"
                    className="form-control combo-input"
                    placeholder="พิมพ์ชื่อลูกค้า..."
                    value={uploadCustomerQuery}
                    onFocus={() => setUploadShowCustomerDropdown(true)}
                    onChange={(e) => { setUploadCustomerQuery(e.target.value); setUploadShowCustomerDropdown(true); }}
                    required
                  />
                  {uploadShowCustomerDropdown && (
                    <div className="combo-panel" onMouseLeave={() => setUploadShowCustomerDropdown(false)}>
                      {customers
                        .filter(c => {
                          const shortId = (c._id || '').toString().slice(-6).toUpperCase();
                          const label = `${shortId} : ${c.name}`;
                          return label.toLowerCase().includes(uploadCustomerQuery.toLowerCase());
                        })
                        .slice(0, 50)
                        .map(c => {
                          const shortId = (c._id || '').toString().slice(-6).toUpperCase();
                          const label = `${shortId} : ${c.name}`;
                          return (
                            <div
                              key={c._id}
                              className="combo-item"
                              onMouseDown={() => {
                                setUploadSelectedCustomerId(c._id);
                                setUploadCustomerQuery(label);
                                setUploadShowCustomerDropdown(false);
                                setUploadForm({ ...uploadForm, customerName: c.name });
                                // refresh services for upload modal
                                fetchUploadCustomerServices(c._id);
                                setUploadServiceQuery('');
                                setUploadForm(f => ({ ...f, service: '' }));
                              }}
                            >
                              {label}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>บริการ</label>
                <div className="combo">
                  <input
                    type="text"
                    className="form-control combo-input"
                    placeholder={uploadSelectedCustomerId ? 'พิมพ์ชื่อบริการ...' : 'เลือกชื่อลูกค้าก่อน'}
                    value={uploadServiceQuery}
                    disabled={!uploadSelectedCustomerId}
                    onFocus={() => { if (uploadSelectedCustomerId) setUploadShowServiceDropdown(true); }}
                    onChange={(e) => { setUploadServiceQuery(e.target.value); if (uploadSelectedCustomerId) setUploadShowServiceDropdown(true); }}
                  />
                  {uploadShowServiceDropdown && uploadSelectedCustomerId && (
                    <div className="combo-panel" onMouseLeave={() => setUploadShowServiceDropdown(false)}>
                      {uploadCustomerServices
                        .filter(svc => {
                          const idText = (svc.customerIdField || '-');
                          const pageText = (svc.pageUrl || '-');
                          const label = `${svc.name} — ${idText} — ${pageText}`;
                          return label.toLowerCase().includes(uploadServiceQuery.toLowerCase());
                        })
                        .slice(0, 50)
                        .map(svc => {
                          const idText = (svc.customerIdField || '-');
                          const pageText = (svc.pageUrl || '-');
                          const label = `${svc.name} — ${idText} — ${pageText}`;
                          return (
                            <div
                              key={svc._id}
                              className="combo-item"
                              onMouseDown={() => {
                                setUploadServiceQuery(label);
                                setUploadShowServiceDropdown(false);
                                setUploadForm(f => ({ ...f, service: svc.name }));
                              }}
                            >
                              {label}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>รูปภาพ</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => setUploadForm({ ...uploadForm, imageFile: e.target.files[0] })}
                  required
                />
              </div>
              <div className="form-group">
                <label>คำอธิบาย (ไม่บังคับ)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-modal btn-modal-cancel" onClick={() => setShowUploadModal(false)}>
                  ยกเลิก
                </button>
                <button type="submit" className="btn-modal btn-modal-save">
                  <Upload /> อัปโหลด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image View Modal */}
      {showImageModal && selectedImage && (
        <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
          <div className="modal-content image-view-modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-image" onClick={() => setShowImageModal(false)}>
              <X size={32} />
            </button>
            <img src={`${api}${selectedImage.imageUrl}`} alt={selectedImage.customerName} />
            <div className="image-view-info">
              <h3>{selectedImage.customerName}</h3>
              <span className={`badge ${selectedImage.service === 'Google Ads' ? 'badge-google' : 'badge-facebook'}`}>
                {selectedImage.service}
              </span>
              {selectedImage.description && <p>{selectedImage.description}</p>}
              <p className="image-view-date">{new Date(selectedImage.createdAt).toLocaleDateString('th-TH')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
